-- RunOS: AI upgrade — chat memory, coach feedback loop, model per user

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  model text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_chat_messages_user_idx ON ai_chat_messages (user_id, id DESC);

CREATE TABLE IF NOT EXISTS coach_suggestions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  workout_type text,
  details text,
  source text,
  activity_id integer,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coach_suggestions_user_idx ON coach_suggestions (user_id, workout_date DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model text;
