-- RunOS: per-feature AI model + custom provider (BYOK)
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_settings jsonb;
