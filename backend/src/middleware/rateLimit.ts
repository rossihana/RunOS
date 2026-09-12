import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AuthRequest } from './auth.js';

/**
 * Rate limiter persisten (DB) — akurat lintas restart, instance, dan load balancer.
 * Slide window: hitung baris < window; bersihkan baris lawas saat INSERT.
 */

// ── Login limiter (in-memory per IP) ──
// Login belum punya user id, jadi limiter DB per-user tidak bisa dipakai.
// In-memory cukup untuk single-instance; kalau multi-instance, naikkan ke Redis. // ponytail: pindah ke Redis saat deploy >1 instance
const loginAttempts = new Map<string, number[]>();
const LOGIN_LIMIT = 10;          // max attempt
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // per 15 menit

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const arr = (loginAttempts.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  if (arr.length >= LOGIN_LIMIT) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' });
  }
  next();
}

/** Login sukses → hapus hitungan attempt IP ini (hanya attempt GAGAL yang dihitung). */
export function loginAttemptSucceeded(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  loginAttempts.delete(ip);
}

/** Login gagal → catat 1 hit (dipanggil dari route sebelum mengirim 401). */
export function loginAttemptFailed(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const arr = (loginAttempts.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  arr.push(now);
  loginAttempts.set(ip, arr);
  // bersihkan entry lawas biar Map tidak bocor memori
  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts) {
      if (!v.some(t => now - t < LOGIN_WINDOW_MS)) loginAttempts.delete(k);
    }
  }
}

export function aiRateLimit(endpoint: string, limit: number, windowSec = 60) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return next(); // authenticate selalu dipasang sebelum middleware ini

    try {
      const ins = await query(
        `INSERT INTO ai_rate_limits (user_id, endpoint, hit_at) VALUES ($1, $2, now())`,
        [userId, endpoint]
      );
      // Bersihkan hit lawas (best-effort, jangan gagalkan request)
      if (ins.rowCount) {
        query(`DELETE FROM ai_rate_limits WHERE hit_at < now() - interval '10 minutes'`).catch(() => {});
      }
      const c = await query(
        `SELECT count(*)::int AS n FROM ai_rate_limits
         WHERE user_id = $1 AND endpoint = $2 AND hit_at > now() - ($3 || ' seconds')::interval`,
        [userId, endpoint, String(windowSec)]
      );
      if (c.rows[0].n > limit) {
        return res.status(429).json({
          error: `Batas ${limit} request/menit untuk ${endpoint} terlampaui. Tunggu sebentar.`
        });
      }
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - c.rows[0].n)));
      next();
    } catch (e) {
      // DB limiter bermasalah -> jangan blokir traffic, tapi catat
      console.error(`[rate-limit] ${endpoint}:`, (e as Error).message);
      next();
    }
  };
}
