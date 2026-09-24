CREATE TABLE "ai_explanations" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"facts_json" jsonb NOT NULL,
	"text_md" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"day" text PRIMARY KEY NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"user_id" uuid NOT NULL,
	"color" text NOT NULL,
	"epd" text NOT NULL,
	"kind" text DEFAULT 'repertoire' NOT NULL,
	"fsrs_state_json" jsonb NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"last_review" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "cards_user_id_color_epd_kind_pk" PRIMARY KEY("user_id","color","epd","kind")
);
--> statement-breakpoint
CREATE TABLE "engine_evals" (
	"epd" text PRIMARY KEY NOT NULL,
	"depth" integer NOT NULL,
	"multipv_json" jsonb NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explorer_cache" (
	"source" text NOT NULL,
	"epd" text NOT NULL,
	"params_hash" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explorer_cache_source_epd_params_hash_pk" PRIMARY KEY("source","epd","params_hash")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"sort_index" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_deviations" (
	"game_id" uuid NOT NULL,
	"ply" integer NOT NULL,
	"epd" text NOT NULL,
	"kind" text NOT NULL,
	"played_uci" text,
	"expected_uci" text[] DEFAULT '{}' NOT NULL,
	"repertoire_id" uuid,
	CONSTRAINT "game_deviations_game_id_pk" PRIMARY KEY("game_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site" text NOT NULL,
	"external_id" text NOT NULL,
	"pgn" text NOT NULL,
	"color" text NOT NULL,
	"result" text NOT NULL,
	"speed" text,
	"opponent" text,
	"played_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openings" (
	"epd" text NOT NULL,
	"eco" text NOT NULL,
	"name" text NOT NULL,
	"pgn" text NOT NULL,
	"uci" text NOT NULL,
	CONSTRAINT "openings_epd_name_pk" PRIMARY KEY("epd","name")
);
--> statement-breakpoint
CREATE TABLE "push_subs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"keys_json" jsonb NOT NULL,
	"due_count" integer DEFAULT 0 NOT NULL,
	"last_notified_on" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subs_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "repertoire_moves" (
	"user_id" uuid NOT NULL,
	"repertoire_id" uuid NOT NULL,
	"from_epd" text NOT NULL,
	"uci" text NOT NULL,
	"san" text NOT NULL,
	"to_epd" text NOT NULL,
	"is_mainline" boolean DEFAULT true NOT NULL,
	"note" text,
	"shapes_json" jsonb,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "repertoire_moves_repertoire_id_from_epd_uci_pk" PRIMARY KEY("repertoire_id","from_epd","uci")
);
--> statement-breakpoint
CREATE TABLE "repertoires" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"folder_id" uuid,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"root_epd" text NOT NULL,
	"root_moves_uci" text[] DEFAULT '{}' NOT NULL,
	"sort_index" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"card_epd" text NOT NULL,
	"color" text NOT NULL,
	"rating" smallint NOT NULL,
	"played_uci" text,
	"expected_uci" text[] DEFAULT '{}' NOT NULL,
	"mode" text NOT NULL,
	"ms_taken" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lichess_username" text NOT NULL,
	"lichess_token_enc" text,
	"chesscom_username" text,
	"rating" integer DEFAULT 1500 NOT NULL,
	"rating_speed" text DEFAULT 'blitz' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"reminder_time" text DEFAULT '19:00' NOT NULL,
	"daily_new_limit" integer DEFAULT 10 NOT NULL,
	"settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_lichess_username_unique" UNIQUE("lichess_username")
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_deviations" ADD CONSTRAINT "game_deviations_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subs" ADD CONSTRAINT "push_subs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoire_moves" ADD CONSTRAINT "repertoire_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoires" ADD CONSTRAINT "repertoires_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_user_due_idx" ON "cards" USING btree ("user_id","due");--> statement-breakpoint
CREATE INDEX "cards_user_upd_idx" ON "cards" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "folders_user_upd_idx" ON "folders" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "games_user_idx" ON "games" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE INDEX "games_ext_idx" ON "games" USING btree ("user_id","site","external_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "openings_name_idx" ON "openings" USING btree ("name");--> statement-breakpoint
CREATE INDEX "rmoves_user_upd_idx" ON "repertoire_moves" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "repertoires_user_upd_idx" ON "repertoires" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "review_log_user_idx" ON "review_log" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_log_upd_idx" ON "review_log" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");