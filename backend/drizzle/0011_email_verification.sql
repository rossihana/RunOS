-- 0011: Verifikasi email saat register (link berbasis, via Resend)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token_expires timestamptz;
