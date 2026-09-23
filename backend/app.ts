import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './src/routes/auth.js';
import activitiesRoutes from './src/routes/activities.js';
import racesRoutes from './src/routes/races.js';
import analyticsRoutes from './src/routes/analytics.js';
import aiRoutes from './src/routes/ai.js';
import { initDb, pool } from './src/db.js';
import { globalErrorHandler } from './src/middleware/error.js';


const app = express();

// CORS allowlist (perbaikan pasca pentest 23-09): origin liar tidak lagi mendapat header CORS.
// Auth tetap JWT via localStorage (bukan cookie); credentials hanya berlaku utk origin terizinkan.
// ponytail: daftar via env CORS_ORIGINS (dipasah koma); domain baru = edit env, bukan kode.
const corsAllowed = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3001')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || corsAllowed.includes(origin)),
  credentials: true,
}));

// Trust proxy HANYA di belakang proxy tepercaya. Pentest 23-09: trust proxy=1 membuat rate-limit
// login bisa dibobol X-Forwarded-For saat backend diakses langsung (req.ip ikut header klien).
// ponytail: set TRUST_PROXY=1 saat deploy di belakang reverse proxy (nginx/Cloudflare).
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(express.json());
app.use(cookieParser());

// Initialize DB — must succeed before routes work.
// In serverless, this runs per cold-start. We catch errors so the function
// can still respond (e.g. with a 503) rather than crashing entirely.
let dbReady = false;
initDb()
  .then(() => {
    dbReady = true;
    // S5 retensi: bersihkan chat > 30 hari saat boot (best-effort)
    import('./src/services/retention.js')
      .then(m => m.purgeOldChats(30))
      .catch((e) => console.error('[retention]', e.message));
  })
  .catch((err) => { console.error('initDb failed:', err); });

app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/races', racesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: true });
  } catch (e: any) {
    // DB down = instance tidak siap melayani trafik → 503 (LB akan mengeluarkannya dari rotasi)
    res.status(503).json({ status: 'degraded', db: false, error: e.message });
  }
});

// Global Error Handler - must be defined last
app.use(globalErrorHandler);

export default app;

// In local development, start the server
// Vercel sets the VERCEL environment variable, so this won't run on Vercel
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

