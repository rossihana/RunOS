#!/usr/bin/env node
/**
 * Rotasi ENCRYPTION_KEY (sekali jalan):
 *   ENCRYPTION_KEY=<lama> NEW_ENCRYPTION_KEY=<baru> node scripts/rotate_key.mjs
 * Re-encrypt SEMUA baris `v1:` pada kolom terproteksi di SATU transaksi;
 * verifikasi decrypt(kunci baru) di dalam transaksi → COMMIT, kegagalan → ROLLBACK (data tak berubah).
 * ponytail: kolom baru yang ter-encrypt (mis. provider AI) ditambahkan di SELECT/UPDATE bawah.
 */
import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const OLD = process.env.ENCRYPTION_KEY || '';
const NEW = process.env.NEW_ENCRYPTION_KEY || '';
const HEX64 = /^[0-9a-f]{64}$/i;
if (!HEX64.test(OLD) || !HEX64.test(NEW)) { console.error('ENCRYPTION_KEY / NEW_ENCRYPTION_KEY harus 64-hex'); process.exit(1); }

const decryptWith = (stored, k) => {
  const [v, ivHex, tagHex, dataHex] = stored.split(':');
  if (v !== 'v1') throw new Error('format bukan v1');
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(k, 'hex'), Buffer.from(ivHex, 'hex'));
  d.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([d.update(Buffer.from(dataHex, 'hex')), d.final()]).toString('utf8');
};
const encryptWith = (text, k) => {
  const iv = crypto.randomBytes(12);
  const ci = crypto.createCipheriv('aes-256-gcm', Buffer.from(k, 'hex'), iv);
  const enc = Buffer.concat([ci.update(text, 'utf8'), ci.final()]);
  return `v1:${iv.toString('hex')}:${ci.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
};

const dsn = (process.env.DATABASE_URL || '').split('?')[0] + '?sslmode=require&uselibpqcompat=true';
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL kosong'); process.exit(1); }
const pool = new pg.Pool({ connectionString: dsn });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  const { rows } = await c.query("SELECT id, garmin_password_enc FROM users WHERE garmin_password_enc LIKE 'v1:%'");
  for (const r of rows) {
    const plain = decryptWith(r.garmin_password_enc, OLD);   // gagal di sini → data lama utuh
    await c.query('UPDATE users SET garmin_password_enc = $1 WHERE id = $2', [encryptWith(plain, NEW), r.id]);
  }
  // verifikasi: semua baris harus bisa didekripsi dengan kunci BARU (masih dalam transaksi)
  const chk = await c.query("SELECT id, garmin_password_enc FROM users WHERE garmin_password_enc LIKE 'v1:%'");
  for (const r of chk.rows) decryptWith(r.garmin_password_enc, NEW);
  await c.query('COMMIT');
  console.log(`ROTASI OK: ${rows.length} baris re-encrypt, ${chk.rows.length} terverifikasi decrypt(kunci baru)`);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ROLLBACK — data TIDAK berubah:', e.message);
  process.exit(1);
} finally { c.release(); await pool.end(); }
