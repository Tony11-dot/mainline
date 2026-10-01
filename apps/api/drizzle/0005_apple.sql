ALTER TABLE "users" ADD COLUMN "apple_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub");