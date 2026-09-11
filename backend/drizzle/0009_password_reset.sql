-- RunOS: reset password — token satu-pakai, TTL 1 jam

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires timestamptz;
