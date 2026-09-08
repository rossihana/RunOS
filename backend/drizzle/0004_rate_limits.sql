-- RunOS: rate limiter persisten (DB-based — tahan restart & multi-instance/LB)

CREATE TABLE IF NOT EXISTS ai_rate_limits (
  user_id integer NOT NULL,
  endpoint text NOT NULL,
  hit_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_rate_limits_lookup ON ai_rate_limits (user_id, endpoint, hit_at);
