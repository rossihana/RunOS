import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import { query } from '../db.js';
import { decrypt } from './crypto.js';

/**
 * S7 Opsi A: sync Garmin PER USER.
 * - Kredensial tiap user (garmin_email + garmin_password_enc) disimpan terenkripsi.
 * - Trigger: POST /api/activities/garmin/connect (simpan kred) dan /garmin/sync (jalankan, via JWT).
 * - Antrean global: satu proses sync pada satu waktu (Garmin membenci login paralel).
 * - Script menerima env GARMIN_EMAIL/GARMIN_PASSWORD + GARMIN_TOKENSTORE per user.
 * ponytail: antrean in-memory (single process lokal); pindah ke DB queue saat multi-instance.
 */

const VENV_PY = 'D:/tools/garmin-hermes/Scripts/python.exe';
const SCRIPT = 'D:/PROJECT/RunOS/scripts/garmin_sync.py';
const LOG_DIR = 'D:/PROJECT/RunOS/backend/tmp';

let running = false;

export interface SyncJob {
  userId: number;
  startedAt: string;
  status: 'running' | 'done' | 'failed';
  detail?: string;
}
const lastByUser = new Map<number, SyncJob>();
const queue: number[] = [];
let processing = false;

export async function garminConnected(userId: number): Promise<boolean> {
  const r = await query('SELECT garmin_email IS NOT NULL AS connected FROM users WHERE id = $1', [userId]);
  return !!r.rows[0]?.connected;
}

/** Simpan kredensial Garmin user (password dienkripsi). */
export async function saveGarminCredentials(userId: number, email: string, password: string): Promise<void> {
  const { encrypt } = await import('./crypto.js');
  await query(
    `UPDATE users SET garmin_email = $1, garmin_password_enc = $2, garmin_connected_at = now() WHERE id = $3`,
    [email.trim().toLowerCase(), encrypt(password), userId]
  );
}

/** Ambil & dekripsi kredensial user. */
async function loadCredentials(userId: number): Promise<{ email: string; password: string } | null> {
  const r = await query('SELECT garmin_email, garmin_password_enc FROM users WHERE id = $1', [userId]);
  const row = r.rows[0];
  if (!row?.garmin_email || !row?.garmin_password_enc) return null;
  return { email: row.garmin_email, password: decrypt(row.garmin_password_enc) };
}

function runPython(userId: number, args: string[], env: Record<string, string>) {
  return new Promise<void>((resolve) => {
    const logFile = `${LOG_DIR}/sync_user_${userId}.log`;
    const child = spawn(VENV_PY, [SCRIPT, ...args], {
      windowsHide: true,
      cwd: 'D:/PROJECT/RunOS/scripts',
      env: { ...process.env, ...env, GARMIN_TOKENSTORE_DIR: `${LOG_DIR}/tokens/${userId}` },
    });
    let out = '';
    child.stdout?.on('data', (d: Buffer) => { out += d; });
    child.stderr?.on('data', (d: Buffer) => { out += d; });
    child.on('close', (code) => {
      fs.appendFile(logFile, `\n--- ${new Date().toISOString()} exit=${code} ---\n${out.slice(-4000)}`, () => {});
      const job = lastByUser.get(userId);
      if (job) {
        job.status = code === 0 ? 'done' : 'failed';
        job.detail = out.slice(-1500);
      }
      resolve();
    });
  });
}

/** Clamp days ke [1, 365] di batas service. ponytail: ceiling 365; naikkan kalau perlu full-history sync. */
export function clampDays(d?: number): number | undefined {
  if (d == null) return undefined;
  const n = Number(d);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

/** Entri utama: jalankan sync untuk satu user (diantrekan global). */
export function queueSync(userId: number, days?: number, details = false, health = false): void {
  days = clampDays(days);
  if (!queue.includes(userId)) queue.push(userId);
  lastByUser.set(userId, { userId, startedAt: new Date().toISOString(), status: 'running' });
  processQueue(days, details, health);
}

function processQueue(defaultDays?: number, defaultDetails = false, defaultHealth = false): void {
  if (processing) return;
  const userId = queue.shift();
  if (!userId) return;
  processing = true;
  (async () => {
    const creds = await loadCredentials(userId);
    if (!creds) {
      lastByUser.set(userId, { userId, startedAt: new Date().toISOString(), status: 'failed', detail: 'Kredensial Garmin belum dihubungkan' });
      return;
    }
    const args: string[] = ['--user-id', String(userId)];
    if (defaultDays) args.push('--days', String(defaultDays));
    if (defaultDetails) args.push('--details', '--max-detail', '30');
    if (defaultHealth) args.push('--health');
    const tokenDir = `${LOG_DIR}/tokens/${userId}`;
    fs.mkdirSync(tokenDir, { recursive: true });
    await runPython(userId, args, {
      GARMIN_EMAIL: creds.email,
      GARMIN_PASSWORD: creds.password,
      GARMIN_TOKENSTORE_DIR: tokenDir,
    });
  })()
    .catch((e) => {
      lastByUser.set(userId, { userId, startedAt: new Date().toISOString(), status: 'failed', detail: String(e?.message || e) });
    })
    .finally(() => {
      processing = false;
      if (queue.length) processQueue(defaultDays, defaultDetails, defaultHealth);
    });
}

export function syncStatusFor(userId: number): SyncJob | null {
  return lastByUser.get(userId) || null;
}

/** Cron: antrekan sync untuk SEMUA user yang terhubung (jalankan via /activities/cron-sync-all + SYNC_SECRET). */
export async function queueAllConnected(days?: number, details = false, health = false): Promise<number> {
  const r = await query('SELECT id FROM users WHERE garmin_email IS NOT NULL');
  for (const row of r.rows) queueSync(row.id, days, details, health);
  return r.rows.length;
}

/** Verifikasi kredensial Garmin dengan login beneran (spawn --verify-only). ~5-15 dtk. */
async function verifyGarminCredentials(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { encrypt } = await import('./crypto.js');
  return new Promise((resolve) => {
    const child = spawn(VENV_PY, [SCRIPT, '--verify-only'], {
      windowsHide: true,
      cwd: 'D:/PROJECT/RunOS/scripts',
      env: {
        ...process.env,
        GARMIN_EMAIL: email,
        GARMIN_PASSWORD: password,
        GARMIN_TOKENSTORE_DIR: `${LOG_DIR}/tokens/verify_${Date.now()}`, // throwaway: jangan pakai tokenstore user
      },
    });
    let out = '';
    child.stdout?.on('data', (d: Buffer) => { out += d; });
    child.stderr?.on('data', (d: Buffer) => { out += d; });
    const t = setTimeout(() => { child.kill(); resolve({ ok: false, error: 'Verifikasi terlalu lama (timeout). Coba lagi.' }); }, 60_000);
    child.on('close', (code) => {
      clearTimeout(t);
      if (code === 0 && out.includes('VERIFY_OK')) return resolve({ ok: true });
      const msg = /403|too many|rate/i.test(out)
        ? 'Garmin menolak login terlalu sering (rate-limit). Tunggu beberapa menit lalu coba lagi.'
        : 'Email atau password Garmin salah.';
      resolve({ ok: false, error: msg });
    });
  });
}

/** Handler: simpan kredensial Garmin user (JWT auth). GATE: ToS wajib disetujui dulu. */
export const TERMS_VERSION = '2026-09-12';

export async function connectHandler(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const { email, password, acceptTerms } = req.body || {};
  if (acceptTerms !== true) {
    return res.status(403).json({ error: 'Kamu harus menyetujui Terms of Service & Privacy Policy dulu.' });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Email Garmin tidak valid' });
  }
  if (typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Password Garmin tidak valid' });
  }
  // BUG-6 fix: kredensial diverifikasi ke Garmin SEBELUM disimpan — tidak ada lagi "terhubung palsu"
  const v = await verifyGarminCredentials(email.trim().toLowerCase(), password);
  if (!v.ok) {
    return res.status(400).json({ error: v.error });
  }
  await saveGarminCredentials(userId, email, password);
  // catat persetujuan ToS (idempoten untuk user lama yang re-connect)
  await query(
    `UPDATE users SET terms_accepted_at = now(), terms_version = $1 WHERE id = $2`,
    [TERMS_VERSION, userId]
  );
  res.json({ success: true, message: 'Kredensial Garmin valid & tersimpan terenkripsi. Silakan sync.' });
}

/** Handler: status sync user (JWT auth). */
export async function statusHandler(req: Request, res: Response) {
  res.json({ status: syncStatusFor((req as any).user?.id), connected: await garminConnected((req as any).user?.id) });
}

// Legacy export dibiarkan agar import lama tidak rusak
export const syncAuthorized = (_req: Request) => false;
export async function runGarminSync(): Promise<void> {
  throw new Error('Gunakan queueSync per user (S7)');
}
export function syncStatus() { return { running, lastResult: null }; }
