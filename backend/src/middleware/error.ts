import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log selalu di server (dengan detail) — klien hanya dapat pesan ringkas
  console.error(`[${req.method} ${req.path}] ${err.statusCode}:`, err.message);

  // K6: stack trace JANGAN dikirim ke klien, di dev maupun production.
  // Pesan detail hanya untuk error operasional (AppError). Error tak terduga
  // (termasuk error internal Postgres) → generik, agar tidak bocor ke klien.
  const isDbError = /invalid input syntax|relation .* does not exist|syntax error/i.test(String(err.message || ''));
  const message =
    err.isOperational || (env.NODE_ENV === 'development' && !isDbError)
      ? err.message
      : 'Terjadi kesalahan pada server.';

  res.status(err.statusCode).json({
    status: err.status,
    message,
  });
};
