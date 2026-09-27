#!/usr/bin/env node
/**
 * Backup database RunOS → JSON terenkripsi AES-256-GCM (stdlib node, tanpa pg_dump).
 *
 *   node scripts/backup_db.mjs dump    [--out FILE]          # aman (default: D:/RunOS-backups)
 *   node scripts/backup_db.mjs selftest                       # roundtrip + drill restore ke skema backup_drill
 *   node scripts/backup_db.mjs restore --file FILE [--into S] # S default 'public' → TRUNCATE+INSERT (DESTRUKTIF)
 *
 * Env: DATABASE_URL, ENCRYPTION_KEY (64-hex). GHA pakai secret RUNOS_* yang dipetakan di bawah.
 * Skema tabel datang dari migrasi drizzle — file backup berisi DATA saja, bukan DDL.
 * ponytail: upgrade ke pg_dump/pg_restore kalau suatu saat butuh backup DDL mandiri.
 */
import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const cmd = args[0];

// Nilai secret GHA memakai nama RUNOS_*; lokal memakai nama polos.
process.env.DATABASE_URL ||= process.env.RUNOS_DATABASE_URL;
process.env.ENCRYPTION_KEY ||= process.env.RUNOS_ENCRYPTION_KEY;
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL kosong'); process.exit(1); }
const KEY_HEX = process.env.ENCRYPTION_KEY || '';
if (!/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) { console.error('ENCRYPTION_KEY harus 64-hex'); process.exit(1); }

// Normalisasi DSN: paksa TLS (client flavor node: require tanpa verifikasi CA — pooler self-signed)
const dsn = process.env.DATABASE_URL.split('?')[0] + '?sslmode=require&uselibpqcompat=true';
const pool = new Pool({ connectionString: dsn });

async function listTables(client, schema = 'public') {
  const r = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY 1`, [schema]);
  return r.rows.map(x => x.table_name);
}

// Ortop: orang tua (parent) lebih dulu — edge dari pg_constraint skema target
async function insertOrder(client, schema, tables) {
  const set = new Set(tables);
  const r = await client.query(
    `SELECT child.nspname || '.' || ch.relname AS c, parent.nspname || '.' || pa.relname AS p
     FROM pg_constraint con
     JOIN pg_class ch ON ch.oid = con.conrelid
     JOIN pg_namespace child ON child.oid = ch.relnamespace
     JOIN pg_class pa ON pa.oid = con.confrelid
     JOIN pg_namespace parent ON parent.oid = pa.relnamespace
     WHERE con.contype = 'f' AND child.nspname = $1`, [schema]);
  const children = new Map();
  const indeg = new Map(tables.map(t => [t, 0]));
  for (const { c, p } of r.rows) {
    const child = c.split('.')[1], parent = p.split('.')[1];
    if (set.has(child) && set.has(parent)) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(child);
      indeg.set(child, indeg.get(child) + 1);
    }
  }
  const ord = [], placed = new Set();
  const ready = tables.filter(t => indeg.get(t) === 0);
  while (ready.length) {
    const t = ready.shift(); if (placed.has(t)) continue;
    placed.add(t); ord.push(t);
    for (const ch of children.get(t) || []) {
      indeg.set(ch, indeg.get(ch) - 1);
      if (indeg.get(ch) === 0) ready.push(ch);
    }
  }
  for (const t of tables) if (!placed.has(t)) ord.push(t); // fallback: sisanya apa adanya
  return ord;
}

function encrypt(text) {
  const key = Buffer.from(KEY_HEX, 'hex');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'),
    tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function decrypt(json) {
  const o = JSON.parse(json);
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(KEY_HEX, 'hex'), Buffer.from(o.iv, 'base64'));
  d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(o.data, 'base64')), d.final()]).toString('utf8');
}

async function doDump(client) {
  const tables = await listTables(client);
  const data = {};
  for (const t of tables) data[t] = (await client.query(`SELECT * FROM public."${t}"`)).rows;
  return { created_at: new Date().toISOString(), tables: data };
}

async function doRestore(client, payload, schema) {
  const tables = Object.keys(payload.tables);
  if (schema === 'public') {
    await client.query(`TRUNCATE ${tables.map(t => `public."${t}"`).join(', ')} RESTART IDENTITY`);
  }
  const order = await insertOrder(client, schema, tables);
  for (const t of order) {
    const rows = payload.tables[t];
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const colSql = cols.map(c => `"${c.replace(/"/g, '""')}"`).join(', ');
    await client.query('BEGIN');
    try {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const vals = [];
        // jsonb: kirim sebagai string JSON eksplisit — pg menganggap JS array sebagai literal array Postgres
        const norm = v => (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
        chunk.forEach(row => vals.push(...cols.map(c => norm(row[c] ?? null))));
        const placeholders = chunk.map((_, ri) =>
          '(' + cols.map((__, ci) => `$${ri * cols.length + ci + 1}`).join(', ') + ')').join(', ');
        await client.query(
          `INSERT INTO ${schema}."${t}" (${colSql}) VALUES ${placeholders}`, vals);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw new Error(`insert ${t}: ${e.message}`); }
  }
  // verifikasi jumlah baris
  for (const t of tables) {
    const r = await client.query(`SELECT count(*)::int AS n FROM ${schema}."${t}"`);
    const want = payload.tables[t].length;
    if (r.rows[0].n !== want) throw new Error(`count ${t}: dapat ${r.rows[0].n}, harap ${want}`);
  }
  return tables.length;
}

async function selftest() {
  const client = await pool.connect();
  try {
    const live = await doDump(client);
    const rt = JSON.parse(decrypt(encrypt(JSON.stringify(live))));
    const nTables = Object.keys(live.tables).length;
    const nRows = Object.values(live.tables).reduce((a, r) => a + r.length, 0);
    for (const t of Object.keys(live.tables))
      if (rt.tables[t].length !== live.tables[t].length) throw new Error(`roundtrip count beda: ${t}`);
    console.log(`dump+crypt roundtrip OK (${nTables} tabel, ${nRows} baris)`);

    // drill restore: skema cetakan (tanpa FK) → uji jalur INSERT sesungguhnya → buang
    await client.query('DROP SCHEMA IF EXISTS backup_drill CASCADE');
    await client.query('CREATE SCHEMA backup_drill');
    for (const t of Object.keys(live.tables))
      await client.query(`CREATE TABLE backup_drill."${t}" (LIKE public."${t}")`);
    const n = await doRestore(client, rt, 'backup_drill');
    console.log(`drill restore OK (${n} tabel, count cocok)`);
    await client.query('DROP SCHEMA backup_drill CASCADE');
    console.log('SELFTEST LULUS');
  } finally { client.release(); }
}

async function main() {
  if (cmd === 'dump') {
    const out = opt('--out', path.join('D:', 'RunOS-backups',
      `runos-backup-${new Date().toISOString().slice(0, 10)}.enc`));
    const client = await pool.connect();
    let payload; try { payload = await doDump(client); } finally { client.release(); }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, encrypt(JSON.stringify(payload)));
    const rows = Object.values(payload.tables).reduce((a, r) => a + r.length, 0);
    console.log(`OK ${out} (${Object.keys(payload.tables).length} tabel, ${rows} baris, ${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
  } else if (cmd === 'selftest') {
    await selftest();
  } else if (cmd === 'restore') {
    const file = opt('--file', null), schema = opt('--into', 'public');
    if (!file) { console.error('butuh --file'); process.exit(1); }
    const payload = JSON.parse(decrypt(fs.readFileSync(file, 'utf8')));
    const client = await pool.connect();
    let n; try { n = await doRestore(client, payload, schema); } finally { client.release(); }
    console.log(`RESTORE OK → ${schema} (${n} tabel)`);
  } else {
    console.error('pakai: dump | selftest | restore --file FILE [--into S]'); process.exit(1);
  }
  await pool.end();
}

main().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
