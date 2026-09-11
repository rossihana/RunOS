-- RunOS S4/S5: kualitas data + retention

-- 1) S4: isi average_pace yang NULL dari average_speed (format m:ss, sama dengan sync Strava lama)
UPDATE activities
SET average_pace = to_char(
      (1000 / average_speed) * interval '1 second',
      'mi:ss')
WHERE average_pace IS NULL
  AND average_speed IS NOT NULL
  AND average_speed > 0;

-- 2) S4: index penunjang analytics (form/readiness membaca per user + tanggal)
CREATE INDEX IF NOT EXISTS idx_activities_user_start ON activities (user_id, start_date);

-- 3) S5 retention: index cleanup untuk chat lawas (fungsi purge manual/cron, bukan auto-delete)
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON ai_chat_messages (created_at);
