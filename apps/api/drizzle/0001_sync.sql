ALTER TABLE "cards" ADD COLUMN "synced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "synced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "repertoire_moves" ADD COLUMN "synced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "repertoires" ADD COLUMN "synced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "synced_at" timestamp with time zone DEFAULT now() NOT NULL;