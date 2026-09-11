import crypto from 'crypto';
import { query } from '../db.js';
import { env } from '../config/env.js';

/**
 * Reset password tanpa email infra: token di-generate server dan DIKEMBALIKAN
 * langsung ke pemilik app (personal deployment — tidak dikirim ke user).
 * Token disimpan sebagai SHA-256 hash, satu-pakai, TTL 1 jam.
 * ponytail: personal app dengan user kecil — kalau nanti multi-tenant publik,
 * ganti pengiriman ke email service (Resend/SES) dan hilangkan return token.
 */

export async function createResetToken(email: string): Promise<{ token: string } | { error: string }> {
  const clean = email.trim().toLowerCase();
  const r = await query('SELECT id FROM users WHERE email = $1', [clean]);
  if (!r.rows[0]) return { error: 'Email tidak terdaftar' };
  const userId = r.rows[0].id;

  const token = crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await query(
    `UPDATE users SET reset_token_hash = $1, reset_token_expires = now() + interval '1 hour' WHERE id = $2`,
    [hash, userId]
  );
  return { token };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: true } | { error: string }> {
  if (typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    return { error: 'Password minimal 8 karakter' };
  }
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const r = await query(
    `SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > now()`,
    [hash]
  );
  if (!r.rows[0]) return { error: 'Token reset tidak valid atau kedaluwarsa' };
  const userId = r.rows[0].id;

  const { hashPassword } = await import('./password.js');
  await query(
    `UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2`,
    [hashPassword(newPassword), userId]
  );
  return { ok: true };
}
