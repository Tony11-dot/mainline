ALTER TABLE "push_subs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "reminder_time" text DEFAULT '19:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "last_review_day" text;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "last_nudge_on" text;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "last_weekly_on" text;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;