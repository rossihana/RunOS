import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();
const JWT_SECRET = env.JWT_SECRET;
const isProduction = env.NODE_ENV === 'production';

// ─── Password hashing: Node stdlib scrypt (salt stored with hash) ───

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

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

router.post('/register', catchAsync(async (req: Request, res: Response) => {
  const { email, password, name } = req.body || {};
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

  const token = issueSession(res, user.id, user);
  res.status(201).json({ token, user });
}));

router.post('/login', catchAsync(async (req: Request, res: Response) => {
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
    return res.status(401).json({ error: 'Email atau password salah' });
  }

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

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
