import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { catchAsync } from '../utils/catchAsync.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { createResetToken, resetPassword } from '../services/passwordReset.js';
import { sendVerificationEmail, verifyEmailToken, sendResetEmail } from '../services/emailTokens.js';
import { loginRateLimit, loginAttemptFailed, loginAttemptSucceeded } from '../middleware/rateLimit.js';

const router = Router();
const JWT_SECRET = env.JWT_SECRET;
const isProduction = env.NODE_ENV === 'production';

// ─── Password hashing dipindah ke services/password.js (dipakai juga reset password) ───

// ─── Shared: issue JWT + cookie ───

function issueSession(res: Response, userId: number, user: object): string {
  const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

// ─── Auth endpoints ───

// Publik: konfigurasi form login (apakah registrasi butuh kode undangan)
router.get('/config', (req: Request, res: Response) => {
  res.json({ inviteRequired: !!env.INVITE_CODE });
});

router.post('/register', catchAsync(async (req: Request, res: Response) => {
  // Registrasi terbuka kecuali INVITE_CODE diset — kalau diset, wajib cocok (S1)
  const { email, password, name, inviteCode } = req.body || {};
  if (env.INVITE_CODE) {
    if (typeof inviteCode !== 'string' ||
        inviteCode.length !== env.INVITE_CODE.length ||
        !crypto.timingSafeEqual(Buffer.from(inviteCode), Buffer.from(env.INVITE_CODE))) {
      return res.status(403).json({ error: 'Kode undangan salah' });
    }
  }
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Email tidak valid' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email sudah terdaftar' });
  }

  const passwordHash = hashPassword(password);
  const [first = '', ...rest] = (typeof name === 'string' ? name.trim() : '').split(' ');
  const result = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name`,
    [cleanEmail, passwordHash, first || null, rest.join(' ') || null]
  );
  const user = result.rows[0];

  // Kirim email verifikasi (link berbasis). Kalau RESEND_API_KEY tak diset,
  // mode personal: token tetap dikembalikan via response agar alur tetap bisa dipakai.
  const rawToken = await sendVerificationEmail(user.id, cleanEmail);
  const token = issueSession(res, user.id, user);
  if (env.RESEND_API_KEY) {
    res.status(201).json({ token, user, verificationSent: true });
  } else {
    res.status(201).json({ token, user, verificationSent: false, verificationToken: rawToken });
  }
}));

router.post('/login', loginRateLimit, catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanEmail || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  const result = await query(
    'SELECT id, email, first_name, last_name, password_hash FROM users WHERE email = $1',
    [cleanEmail]
  );
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    loginAttemptFailed(req); // hitung hanya attempt GAGAL
    return res.status(401).json({ error: 'Email atau password salah' });
  }
  loginAttemptSucceeded(req); // reset hitungan gagal untuk IP ini

  const safeUser = { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name };
  const token = issueSession(res, user.id, safeUser);
  res.json({ token, user: safeUser });
}));

router.get('/me', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const result = await query(
    'SELECT id, email, first_name, last_name, profile_picture FROM users WHERE id = $1',
    [req.user?.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(result.rows[0]);
}));

// ─── Verifikasi email (link berbasis) ───

router.get('/verify-email', catchAsync(async (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'Token kosong' });
  const result = await verifyEmailToken(token);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ success: true, message: 'Email terverifikasi! Kamu bisa lanjut pakai RunOS.' });
}));

router.post('/resend-verification', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const r = await query('SELECT id, email, email_verified_at FROM users WHERE id = $1', [req.user?.id]);
  const u = r.rows[0];
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (u.email_verified_at) return res.json({ success: true, message: 'Email sudah terverifikasi.' });
  const token = await sendVerificationEmail(u.id, u.email);
  if (env.RESEND_API_KEY) {
    res.json({ success: true, message: 'Email verifikasi dikirim ulang.' });
  } else {
    res.json({ success: true, message: 'Email verifikasi dikirim ulang.', verificationToken: token });
  }
}));

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// ─── Reset password ───
// Dengan email infra (RESEND_API_KEY): link dikirim ke email user — token TIDAK muncul di layar.
// Tanpa infra (mode personal): token dikembalikan via response (pemilik = admin). Jangan dipakai publik.

router.post('/forgot-password', catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') return res.status(400).json({ error: 'Email wajib diisi' });
  const r = await query('SELECT id, email FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  const u = r.rows[0];
  if (env.RESEND_API_KEY) {
    if (u) await sendResetEmail(u.email, u.id);
    // Respons samar anti-enumeration: selalu sukses meski email tak terdaftar
    return res.json({ success: true, message: 'Kalau email terdaftar, link reset sudah dikirim. Cek inbox (dan folder spam).' });
  }
  // Fallback personal (tanpa email infra)
  if (!u) return res.status(404).json({ error: 'Email tidak terdaftar' });
  const token = await sendResetEmail(u.email, u.id);
  res.json({ resetToken: token, expiresIn: '1 hour' });
}));

router.post('/reset-password', catchAsync(async (req: Request, res: Response) => {
  const { token, password } = req.body || {};
  const result = await resetPassword(token, password);
  if ('error' in result) return res.status(400).json({ error: result.error });
  res.json({ success: true, message: 'Password berhasil direset. Silakan login.' });
}));

export default router;
