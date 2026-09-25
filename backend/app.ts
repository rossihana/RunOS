import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
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

// Serve frontend build — deploy single-domain (Render/CF): /api = Express, sisanya SPA.
// ponytail: dist tak ada (dev lokal: vite terpisah, cwd=backend/) → blok dilewati otomatis.
const distDir = path.resolve(process.cwd(), 'frontend/dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

// Global Error Handler - must be defined last
app.use(globalErrorHandler);

export default app;

// In local development, start the server
// Vercel sets the VERCEL environment variable, so this won't run on Vercel
// ponytail: dulu NODE_ENV=production = TIDAK listen (khusus Vercel) → deploy di PaaS (Render/dsb)
// jadi diam. Sekarang: listen selama bukan serverless; PORT diisi platform (Render: PORT=10000).
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

