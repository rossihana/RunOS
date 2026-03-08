import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './src/routes/auth.js';
import activitiesRoutes from './src/routes/activities.js';
import racesRoutes from './src/routes/races.js';
import analyticsRoutes from './src/routes/analytics.js';
import { initDb, pool } from './src/db.js';


const app = express();

// CORS — allow all origins (data is protected by JWT auth, not by CORS)
// origin: true echoes back the requesting origin, required for credentials: true
app.use(cors({
  origin: true,
  credentials: true,
}));

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

// Initialize DB — must succeed before routes work.
// In serverless, this runs per cold-start. We catch errors so the function
// can still respond (e.g. with a 503) rather than crashing entirely.
let dbReady = false;
initDb()
  .then(() => { dbReady = true; })
  .catch((err) => { console.error('initDb failed:', err); });

app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/races', racesRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: true });
  } catch (e: any) {
    res.json({ status: 'ok', db: false, error: e.message });
  }
});

export default app;

