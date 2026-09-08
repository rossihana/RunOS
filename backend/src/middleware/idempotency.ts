import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { AuthRequest } from './auth.js';

/**
 * Idempotency guard untuk POST AI: klien kirim header X-Idempotency-Key
 * (UUID per "niat kirim"). Request ulang dengan key sama -> 409 tanpa
 * memanggil LLM. Lock kedaluwarsa 2 menit (panggilan gagal boleh diulang).
 * Tanpa header = lewat (backward compatible).
 */
export function aiIdempotency(endpoint: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const key = req.headers['x-idempotency-key'];
    if (typeof key !== 'string' || !key || key.length > 100) return next();
    const userId = req.user?.id;
    if (!userId) return next();

    try {
      // Bersihkan lock lawas (best-effort)
      query(`DELETE FROM ai_request_locks WHERE created_at < now() - interval '2 minutes'`).catch(() => {});
      const ins = await query(
        `INSERT INTO ai_request_locks (user_id, endpoint, key) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, endpoint, key) DO NOTHING`,
        [userId, endpoint, key]
      );
      if (!ins.rowCount) {
        return res.status(409).json({
          error: 'Request ini sedang/sudah diproses. Tunggu hasilnya atau refresh halaman.'
        });
      }
      res.setHeader('X-Idempotency-Accepted', 'true');
      next();
    } catch (e: any) {
      // Tabel/route bermasalah -> jangan blokir traffic
      console.error(`[idempotency] ${endpoint}:`, (e as Error).message);
      next();
    }
  };
}

/** Helper FE-side (juga dipakai test): UUID v4. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
