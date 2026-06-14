import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(8),
  STRAVA_CLIENT_ID: z.string(),
  STRAVA_CLIENT_SECRET: z.string(),
  STRAVA_REDIRECT_URI: z.string().url(),
  GEMINI_API_KEY: z.string().optional(),
  NINEROUTER_BASE_URL: z.string().url().default('http://localhost:20128/v1'),
});

const envParse = envSchema.safeParse(process.env);

if (!envParse.success) {
  console.error('❌ Invalid environment variables:', envParse.error.format());
  process.exit(1);
}

export const env = envParse.data;
export default env;
