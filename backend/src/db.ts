import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema.js';

import { env } from './config/env.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Batasi koneksi per instance — cegah connection exhaustion Supabase saat
  // scale-out (LB/serverless menambah instance). 5 × beberapa instance aman di pooler.
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

// Shorthand query helper for legacy code
export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function initDb() {
  try {
    // Run migrations automatically on startup
    console.log('Running migrations...');
    await migrate(db, { 
      migrationsFolder: './drizzle',
      migrationsTable: '__drizzle_migrations',
      migrationsSchema: 'drizzle'
    });
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    // Fallback or exit depending on criticality
  }
}


