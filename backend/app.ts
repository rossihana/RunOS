import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './src/routes/auth.js';
import activitiesRoutes from './src/routes/activities.js';
import racesRoutes from './src/routes/races.js';
import analyticsRoutes from './src/routes/analytics.js';
import { initDb } from './src/db.js';

const app = express();

// CORS — allow requests from the frontend domain
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'https://run-os-backend.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl / Postman) or from the allowed list
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbReady });
});

export default app;

