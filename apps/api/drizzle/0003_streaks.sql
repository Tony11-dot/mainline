ALTER TABLE "push_subs" ADD COLUMN "freezes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subs" ADD COLUMN "last_late_on" text;