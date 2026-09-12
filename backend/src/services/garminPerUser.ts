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

/** Entri utama: jalankan sync untuk satu user (diantrekan global). */
export function queueSync(userId: number, days?: number, details = false): void {
  if (!queue.includes(userId)) queue.push(userId);
  lastByUser.set(userId, { userId, startedAt: new Date().toISOString(), status: 'running' });
  processQueue(days, details);
}

function processQueue(defaultDays?: number, defaultDetails = false): void {
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
    const args: string[] = [];
    if (defaultDays) args.push('--days', String(defaultDays));
    if (defaultDetails) args.push('--details', '--max-detail', '30');
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
      if (queue.length) processQueue(defaultDays, defaultDetails);
    });
}

export function syncStatusFor(userId: number): SyncJob | null {
  return lastByUser.get(userId) || null;
}

/** Cron: antrekan sync untuk SEMUA user yang terhubung (jalankan via /activities/cron-sync-all + SYNC_SECRET). */
export async function queueAllConnected(days?: number, details = false): Promise<number> {
  const r = await query('SELECT id FROM users WHERE garmin_email IS NOT NULL');
  for (const row of r.rows) queueSync(row.id, days, details);
  return r.rows.length;
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
  await saveGarminCredentials(userId, email, password);
  // catat persetujuan ToS (idempoten untuk user lama yang re-connect)
  await query(
    `UPDATE users SET terms_accepted_at = now(), terms_version = $1 WHERE id = $2`,
    [TERMS_VERSION, userId]
  );
  res.json({ success: true, message: 'Garmin terhubung. Sync bisa dijalankan dari Dashboard.' });
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
