-- RunOS: Strava → Garmin migration
-- 1) Login email+password  2) kolom *_strava_* → *_garmin_*

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password_hash text;

-- Existing rows may have duplicate/NULL emails; add unique only if safe.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email);

-- users: drop strava identity
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_strava_athlete_id_unique;
ALTER TABLE users ALTER COLUMN strava_athlete_id DROP NOT NULL;

-- activities: rename id + unique constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_strava_activity_id_unique;
ALTER TABLE activities RENAME COLUMN strava_activity_id TO garmin_activity_id;
ALTER TABLE activities ADD CONSTRAINT activities_garmin_activity_id_unique UNIQUE (garmin_activity_id);

-- best_efforts: rename column
ALTER TABLE best_efforts RENAME COLUMN strava_activity_id TO garmin_activity_id;

-- races: rename column
ALTER TABLE races RENAME COLUMN activity_strava_id TO activity_garmin_id;
