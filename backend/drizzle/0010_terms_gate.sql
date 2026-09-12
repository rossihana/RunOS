-- 0010: Terms of Service acceptance (Opsi 2: ToS gate)
-- user harus setujui ToS+Privacy Policy sebelum connect Garmin / pakai fitur sync.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version text;
