CREATE TYPE "public"."user_activity_type" AS ENUM('login', 'logout', 'password_change', 'listing_created', 'listing_updated', 'listing_deleted', 'listing_published', 'rental_requested', 'rental_approved', 'rental_rejected', 'rental_completed', 'rental_cancelled', 'profile_updated', 'settings_updated', 'payment_made', 'payout_received', 'review_created', 'review_responded');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 're_engagement';--> statement-breakpoint
CREATE TABLE "user_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"activity_type" "user_activity_type" NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_activity_log" ADD CONSTRAINT "user_activity_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_activity_log_user_id_created_at_idx" ON "user_activity_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_activity_log_created_at_idx" ON "user_activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_last_active_at_idx" ON "user" USING btree ("last_active_at");