import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(8),
  GEMINI_API_KEY: z.string().optional(),
  NINEROUTER_BASE_URL: z.string().url().default('http://localhost:20128/v1'),
  // Kunci registrasi: kosong = registrasi DITUTUP. Isi untuk membuka (personal app).
  INVITE_CODE: z.string().optional(),
  // Secret untuk trigger sync Garmin (header X-Sync-Secret). Kosong = endpoint sync mati.
  SYNC_SECRET: z.string().optional(),
});

const envParse = envSchema.safeParse(process.env);

if (!envParse.success) {
  console.error('❌ Invalid environment variables:', envParse.error.format());
  process.exit(1);
}

export const env = envParse.data;
export default env;
