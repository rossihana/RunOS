import { pgTable, serial, bigint, text, integer, real, timestamp, boolean, jsonb, date, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  stravaAthleteId: bigint('strava_athlete_id', { mode: 'bigint' }),
  firstName: text('first_name'),
  lastName: text('last_name'),
  profilePicture: text('profile_picture'),
  timezone: text('timezone'),
  labConfig: jsonb('lab_config'),
  masterTrainingPlan: jsonb('master_training_plan'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  garminActivityId: bigint('garmin_activity_id', { mode: 'bigint' }).unique().notNull(),
  name: text('name'),
  distance: real('distance'),
  movingTime: integer('moving_time'),
  elapsedTime: integer('elapsed_time'),
  averageSpeed: real('average_speed'),
  averagePace: text('average_pace'),
  maxSpeed: real('max_speed'),
  averageHeartrate: real('average_heartrate'),
  maxHeartrate: real('max_heartrate'),
  elevationGain: real('elevation_gain'),
  cadence: real('cadence'),
  startDate: timestamp('start_date'),
  startDateLocal: text('start_date_local'),
  mapPolyline: text('map_polyline'),
  detailsFetched: boolean('details_fetched').default(false),
  splits: jsonb('splits'),
  streams: jsonb('streams'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const races = pgTable('races', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  raceName: text('race_name').notNull(),
  distance: real('distance').notNull(),
  raceDate: date('race_date').notNull(),
  targetTime: text('target_time'),
  targetPace: text('target_pace'),
  prediction: jsonb('prediction'),
  trainingPlan: jsonb('training_plan'),
  linkedActivityId: integer('linked_activity_id').references(() => activities.id, { onDelete: 'set null' }),
  activityGarminId: bigint('activity_garmin_id', { mode: 'bigint' }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bestEfforts = pgTable('best_efforts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  distance: real('distance').notNull(),
  elapsedTime: integer('elapsed_time').notNull(),
  movingTime: integer('moving_time').notNull(),
  startDate: timestamp('start_date').notNull(),
  startDateLocal: text('start_date_local'),
  garminActivityId: bigint('garmin_activity_id', { mode: 'bigint' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  unq: unique().on(t.userId, t.name)
}));
