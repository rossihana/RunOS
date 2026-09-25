import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { env } from '../config/env.js';

/**
 * Memanggil scripts/garmin_sync.py via venv garmin-hermes (spawn, fire-and-forget
 * dengan log). Trigger dari tombol UI maupun cron memakai SHARED_SECRET di header
 * X-Sync-Secret supaya endpoint tidak bisa dipanggil sembarangan orang.
 *
 * Mengapa spawn Python, bukan port ke Node: garminconnect 0.3.2 + tokenstore sudah
 * proven di venv D:\tools\garmin-hermes (login cascade + anti rate-limit); port
 * berisiko regresi. ponytail: satu server ini Windows-local; kalau nanti deploy
 * Vercel, ganti dengan queue worker yang bisa menjalankan Python.
 */

const SYNC_SECRET = env.SYNC_SECRET || '';
// ponytail: default = venv Windows utk dev lokal; server isi env GARMIN_PYTHON/GARMIN_SCRIPT/GARMIN_TMP
// (Docker Linux: GARMIN_PYTHON=/opt/venv/bin/python GARMIN_SCRIPT=/app/scripts/garmin_sync.py GARMIN_TMP=/tmp/runos).
const VENV_PY = process.env.GARMIN_PYTHON || 'D:/tools/garmin-hermes/Scripts/python.exe';
const SCRIPT = process.env.GARMIN_SCRIPT || 'D:/PROJECT/RunOS/scripts/garmin_sync.py';
const LOG = process.env.GARMIN_LOG || 'D:/PROJECT/RunOS/backend/tmp/sync.log';

let running = false; // satu sync pada satu waktu per instance (Garmin rate-limit)
let lastResult: { startedAt: string; status: string; detail?: string } | null = null;

export function syncAuthorized(req: Request): boolean {
  const provided = (req.headers['x-sync-secret'] || req.query.secret) as string | undefined;
  if (!SYNC_SECRET) return false; // tanpa secret = endpoint mati
  if (!provided || provided.length !== SYNC_SECRET.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(SYNC_SECRET));
}

export async function runGarminSync(days?: number, details = false): Promise<void> {
  if (running) throw new Error('Sync sudah berjalan');
  running = true;
  lastResult = { startedAt: new Date().toISOString(), status: 'running' };
  const args = [SCRIPT];
  if (days) args.push('--days', String(days));
  if (details) args.push('--details', '--max-detail', '30');
  const child = require('child_process').spawn(VENV_PY, args, {
    windowsHide: true,
    cwd: require('path').dirname(SCRIPT),
  });
  let out = '';
  child.stdout?.on('data', (d: Buffer) => { out += d; });
  child.stderr?.on('data', (d: Buffer) => { out += d; });
  child.on('close', (code: number | null) => {
    running = false;
    lastResult = {
      startedAt: lastResult?.startedAt || new Date().toISOString(),
      status: code === 0 ? 'done' : 'failed',
      detail: out.slice(-2000),
    };
    require('fs').appendFile(LOG, `\n--- ${new Date().toISOString()} exit=${code} ---\n${out.slice(-4000)}`, () => {});
  });
}

export function syncStatus() {
  return { running, lastResult };
}

// Handler untuk POST /api/activities/sync — auth user + secret
export async function syncHandler(req: Request, res: Response, _next: NextFunction) {
  if (!syncAuthorized(req)) {
    return res.status(403).json({ error: 'Sync secret tidak valid / tidak diset' });
  }
  const { days, details } = req.body || {};
  try {
    await runGarminSync(days ? Number(days) : undefined, Boolean(details));
    res.json({ success: true, message: 'Sync Garmin dimulai di background. Data muncul dalam ~1-2 menit.' });
  } catch (e: any) {
    res.status(409).json({ error: e.message });
  }
}
