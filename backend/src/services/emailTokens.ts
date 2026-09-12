// Token link verifikasi/reset: dipakai untuk verifikasi email saat register + reset password.
// Token disimpan sebagai SHA-256 (DB bocor ≠ token bocor), TTL 1 jam, sekali pakai.
import crypto from 'crypto';
import { query } from '../db.js';
import { sendMail } from './mail.js';
import { env } from '../config/env.js';

const TOKEN_TTL_HOURS = 1;

function newToken(): string {
  return crypto.randomBytes(24).toString('hex');
}
function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
}

/** Kirim email verifikasi; simpan hash token. Return raw token (untuk fallback tanpa email infra). */
export async function sendVerificationEmail(userId: number, email: string): Promise<string> {
  const token = newToken();
  await query(
    `UPDATE users SET email_verify_token_hash = $1, email_verify_token_expires = now() + interval '1 hour' WHERE id = $2`,
    [sha256(token), userId]
  );
  const link = `${env.APP_URL}/verify-email?token=${token}`;
  const sent = await sendMail({
    to: email,
    subject: 'Verifikasi akun RunOS',
    html: `
      <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#111">Selamat datang di RunOS 🎉</h2>
        <p style="color:#444;font-size:14px">Klik tombol di bawah untuk verifikasi email-mu. Link berlaku 1 jam.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">Verifikasi Email</a>
        </p>
        <p style="color:#999;font-size:12px">Kalau tombol tak berfungsi, salin link ini ke browser:<br><span style="color:#666">${link}</span></p>
      </div>`,
  });
  return sent ? token : token; // raw token tetap dikembalikan untuk mode tanpa email (fallback personal)
}

/** Verifikasi link email. Return true jika valid. */
export async function verifyEmailToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const r = await query(
    `SELECT id, email_verify_token_expires FROM users WHERE email_verify_token_hash = $1`,
    [sha256(token)]
  );
  const row = r.rows[0];
  if (!row) return { ok: false, error: 'Token tidak valid atau sudah dipakai.' };
  if (new Date(row.email_verify_token_expires) < hoursAgo(0)) {
    return { ok: false, error: 'Token kedaluwarsa. Minta email verifikasi baru.' };
  }
  await query(
    `UPDATE users SET email_verified_at = now(), email_verify_token_hash = NULL, email_verify_token_expires = NULL WHERE id = $1`,
    [row.id]
  );
  return { ok: true };
}

/** Cek apakah email user sudah terverifikasi. */
export async function emailVerified(userId: number): Promise<boolean> {
  const r = await query('SELECT email_verified_at FROM users WHERE id = $1', [userId]);
  return !!r.rows[0]?.email_verified_at;
}

/** Kirim email reset password (link berbasis). Return raw token. */
export async function sendResetEmail(email: string, userId: number): Promise<string> {
  const token = newToken();
  await query(
    `UPDATE users SET reset_token_hash = $1, reset_token_expires = now() + interval '1 hour' WHERE id = $2`,
    [sha256(token), userId]
  );
  const link = `${env.APP_URL}/reset-password?token=${token}`;
  const sent = await sendMail({
    to: email,
    subject: 'Reset password RunOS',
    html: `
      <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#111">Reset password RunOS</h2>
        <p style="color:#444;font-size:14px">Klik tombol di bawah untuk set password baru. Link berlaku 1 jam & hanya sekali pakai.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">Set Password Baru</a>
        </p>
        <p style="color:#999;font-size:12px">Kalau kamu tidak meminta reset ini, abaikan email ini.</p>
      </div>`,
  });
  return token;
}

export const TOKEN_TTL = TOKEN_TTL_HOURS;
