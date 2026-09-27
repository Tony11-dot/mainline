ALTER TABLE "users" ALTER COLUMN "lichess_username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "chesscom_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_chesscom_id_unique" UNIQUE("chesscom_id");