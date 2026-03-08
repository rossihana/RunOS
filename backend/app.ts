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

// CORS — allow requests from the frontend domain
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
];

// Add any FRONTEND_URL from env (supports comma-separated list for multiple URLs)
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').map(u => u.trim()).forEach(u => allowedOrigins.push(u));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, SSR) or from the allowed list
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      // Return false (block) instead of throwing — avoids a 500 Internal Server Error
      callback(null, false);
    }
  },
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

