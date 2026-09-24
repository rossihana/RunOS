import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AuthRequest } from './auth.js';

/**
 * Rate limiter persisten (DB) — akurat lintas restart, instance, dan load balancer.
 * Slide window: hitung baris < window; bersihkan baris lawas saat INSERT.
 */

// ── Login limiter (in-memory per IP & per account) ──
// Login belum punya user id, jadi limiter DB per-user tidak bisa dipakai.
// In-memory cukup untuk single-instance; kalau multi-instance, naikkan ke Redis. // ponytail: pindah ke Redis saat deploy >1 instance
const loginAttempts = new Map<string, number[]>();
const ipAttempts = new Map<string, number[]>();
const LOGIN_ACCOUNT_LIMIT = 5;       // max 5 attempt gagal per akun per IP
const LOGIN_IP_LIMIT = 20;           // max 20 attempt gagal total per IP
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // per 15 menit

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { email } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const now = Date.now();

  // 1. Cek limit global per-IP (mencegah spraying banyak akun dari 1 IP)
  const ipArr = (ipAttempts.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  if (ipArr.length >= LOGIN_IP_LIMIT) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan login dari IP ini. Coba lagi dalam 15 menit.' });
  }

  // 2. Cek limit per-akun dari IP ini
  if (cleanEmail) {
    const key = `${ip}:${cleanEmail}`;
    const accArr = (loginAttempts.get(key) || []).filter(t => now - t < LOGIN_WINDOW_MS);
    if (accArr.length >= LOGIN_ACCOUNT_LIMIT) {
      return res.status(429).json({ error: 'Terlalu banyak percobaan login untuk akun ini. Coba lagi dalam 15 menit.' });
    }
  }

  next();
}

/** Login sukses → hapus hitungan attempt GAGAL HANYA untuk akun ini (bukan seluruh IP). */
export function loginAttemptSucceeded(req: Request, email?: string) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (email) {
    loginAttempts.delete(`${ip}:${email.trim().toLowerCase()}`);
  }
}

/** Login gagal → catat 1 hit pada akun dan IP (dipanggil dari route sebelum mengirim 401). */
export function loginAttemptFailed(req: Request, email?: string) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Catat ke total IP
  const ipArr = (ipAttempts.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  ipArr.push(now);
  ipAttempts.set(ip, ipArr);

  // Catat ke akun spesifik
  if (email) {
    const key = `${ip}:${email.trim().toLowerCase()}`;
    const accArr = (loginAttempts.get(key) || []).filter(t => now - t < LOGIN_WINDOW_MS);
    accArr.push(now);
    loginAttempts.set(key, accArr);
  }

  // bersihkan entry lawas biar Map tidak bocor memori
  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts) {
      if (!v.some(t => now - t < LOGIN_WINDOW_MS)) loginAttempts.delete(k);
    }
  }
  if (ipAttempts.size > 1000) {
    for (const [k, v] of ipAttempts) {
      if (!v.some(t => now - t < LOGIN_WINDOW_MS)) ipAttempts.delete(k);
    }
  }
}

// ── IP window limiter generik: dipakai forgot-password & register ──
// (dulu blok forgotPasswordRateLimit manual — didedup jadi pabrik)
function ipWindowLimiter(name: string, limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
    if (arr.length >= limit) {
      return res.status(429).json({
        error: `Terlalu banyak permintaan ${name}. Coba lagi dalam ${Math.round(windowMs / 60000)} menit.`,
      });
    }
    arr.push(now);
    hits.set(ip, arr);
    if (hits.size > 1000) {
      for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
    }
    next();
  };
}

export const forgotPasswordRateLimit = ipWindowLimiter('reset password', 5, 15 * 60 * 1000);
// Register dulunya TANPA limit → bisa mass-create akun + spam email verifikasi Resend.
// Hitung semua attempt (termasuk payload invalid) — 10/IP/15m.
export const registerRateLimit = ipWindowLimiter('registrasi', 10, 15 * 60 * 1000);

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
