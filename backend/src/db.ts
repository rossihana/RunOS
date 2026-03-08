import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Shorthand query helper
export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      strava_athlete_id BIGINT UNIQUE NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at BIGINT,
      first_name TEXT,
      last_name TEXT,
      profile_picture TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strava_activity_id BIGINT UNIQUE NOT NULL,
      name TEXT,
      distance REAL,
      moving_time INTEGER,
      elapsed_time INTEGER,
      average_speed REAL,
      average_pace TEXT,
      max_speed REAL,
      average_heartrate REAL,
      max_heartrate REAL,
      elevation_gain REAL,
      cadence REAL,
      start_date TIMESTAMP,
      map_polyline TEXT,
      details_fetched BOOLEAN DEFAULT FALSE,
      splits JSONB,
      streams JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS races (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      race_name TEXT NOT NULL,
      distance REAL NOT NULL,
      race_date DATE NOT NULL,
      target_time TEXT,
      target_pace TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS best_efforts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      distance REAL NOT NULL,
      elapsed_time INTEGER NOT NULL,
      moving_time INTEGER NOT NULL,
      start_date TIMESTAMP NOT NULL,
      strava_activity_id BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
    );
  `);

  // Add columns to existing tables if they don't exist — each in its own try/catch
  // so one failure doesn't block the others
  const alterations = [
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS details_fetched BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS splits JSONB`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS streams JSONB`,
  ];
  for (const sql of alterations) {
    try {
      await pool.query(sql);
    } catch (e) {
      // Column might already exist with right type — safe to ignore
      console.warn('ALTER TABLE skipped:', e instanceof Error ? e.message : e);
    }
  }

  console.log('Database initialized');
}

