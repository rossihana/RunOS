import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  // JWT: JWT_SECRET = aktif (sign). JWT_SECRETS = daftar koma untuk rotasi bertahap
  // (verify menerima semua; sign selalu pakai JWT_SECRET). Opsional.
  JWT_SECRET: z.string().min(8),
  JWT_SECRETS: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NINEROUTER_BASE_URL: z.string().url().default('http://localhost:20128/v1'),
  // Kunci registrasi: kosong = registrasi DITUTUP. Isi untuk membuka (personal app).
  INVITE_CODE: z.string().optional(),
  // Email pemilik (comma-separated): bebas memilih semua model di 9router (termasuk glm-5.3-flash).
  // User lain: hanya katalog FREE_MODELS + provider sendiri (BYOK).
  OWNER_EMAILS: z.string().optional(),
  // Kunci enkripsi AES-256-GCM untuk data sensitif di DB (API key provider, kredensial Garmin).
  // Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY harus 64 hex'),
  // Secret untuk trigger sync Garmin (header X-Sync-Secret). Kosong = endpoint sync mati.
  SYNC_SECRET: z.string().optional(),
});

const envParse = envSchema.safeParse(process.env);

if (!envParse.success) {
  console.error('❌ Invalid environment variables:', envParse.error.format());
  process.exit(1);
}

export const env = envParse.data;

// Daftar secret JWT untuk verify: aktif + legacy selama masa rotasi
export const JWT_SECRETS: string[] = [
  env.JWT_SECRET,
  ...(env.JWT_SECRETS ? env.JWT_SECRETS.split(',').map(s => s.trim()).filter(Boolean) : []),
];

export default env;
