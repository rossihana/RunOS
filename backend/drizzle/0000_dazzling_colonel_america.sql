CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"strava_activity_id" bigint NOT NULL,
	"name" text,
	"distance" real,
	"moving_time" integer,
	"elapsed_time" integer,
	"average_speed" real,
	"average_pace" text,
	"max_speed" real,
	"average_heartrate" real,
	"max_heartrate" real,
	"elevation_gain" real,
	"cadence" real,
	"start_date" timestamp,
	"map_polyline" text,
	"details_fetched" boolean DEFAULT false,
	"splits" jsonb,
	"streams" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "activities_strava_activity_id_unique" UNIQUE("strava_activity_id")
);
--> statement-breakpoint
CREATE TABLE "best_efforts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"distance" real NOT NULL,
	"elapsed_time" integer NOT NULL,
	"moving_time" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"strava_activity_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "best_efforts_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"race_name" text NOT NULL,
	"distance" real NOT NULL,
	"race_date" date NOT NULL,
	"target_time" text,
	"target_pace" text,
	"prediction" jsonb,
	"training_plan" jsonb,
	"linked_activity_id" integer,
	"activity_strava_id" bigint,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"strava_athlete_id" bigint NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" bigint,
	"first_name" text,
	"last_name" text,
	"profile_picture" text,
	"lab_config" jsonb,
	"master_training_plan" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_strava_athlete_id_unique" UNIQUE("strava_athlete_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "best_efforts" ADD CONSTRAINT "best_efforts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_linked_activity_id_activities_id_fk" FOREIGN KEY ("linked_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;