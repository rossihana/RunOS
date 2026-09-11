-- RunOS S5: retensi chat 30 hari (keputusan user 09-09)

-- Hapus pesan chat lebih tua dari 30 hari saat migration jalan
DELETE FROM ai_chat_messages WHERE created_at < now() - interval '30 days';

-- Index untuk cleanup berkala
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON ai_chat_messages (created_at);
