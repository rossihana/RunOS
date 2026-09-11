-- RunOS S7 Opsi A: kredensial Garmin per user + reset password

-- 1) Kredensial Garmin per user (email+password Garmin, TERENKRIPSI via services/crypto)
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_password_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_connected_at timestamptz;

-- 2) Reset password: token satu-pakai, TTL 1 jam
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires timestamptz;
