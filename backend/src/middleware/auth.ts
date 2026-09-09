import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env, JWT_SECRETS } from '../config/env.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token = req.cookies.token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Rotasi: token valid jika cocok dengan secret aktif ATAU legacy (masa rotasi)
  for (const secret of JWT_SECRETS) {
    try {
      req.user = jwt.verify(token, secret) as { id: number };
      return next();
    } catch {
      // coba secret berikutnya
    }
  }
  return res.status(401).json({ error: 'Invalid token' });
};
