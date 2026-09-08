-- RunOS: idempotency untuk POST AI (retry LB / double-click tidak memanggil LLM 2×)

CREATE TABLE IF NOT EXISTS ai_request_locks (
  user_id integer NOT NULL,
  endpoint text NOT NULL,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_request_locks_unique UNIQUE (user_id, endpoint, key)
);
CREATE INDEX IF NOT EXISTS ai_request_locks_cleanup ON ai_request_locks (created_at);
