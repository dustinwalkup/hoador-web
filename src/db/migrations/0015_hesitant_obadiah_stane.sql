CREATE TYPE "public"."approval_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'listing_approved' BEFORE 'system';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'listing_rejected' BEFORE 'system';--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "approval_status" "approval_status" DEFAULT 'pending_review';--> statement-breakpoint
-- Grandfather existing listings: set all existing listings to 'approved'
-- Note: When adding a column with DEFAULT, existing rows get the default value ('pending_review'), not NULL
-- At migration time, all existing listings should be grandfathered as 'approved'
-- New listings created AFTER this migration will correctly get 'pending_review' as the default
UPDATE "listings" SET "approval_status" = 'approved' WHERE "approval_status" = 'pending_review';--> statement-breakpoint
-- Now set NOT NULL constraint after updating existing records
ALTER TABLE "listings" ALTER COLUMN "approval_status" SET NOT NULL;--> statement-breakpoint
-- Ensure default is set for future rows
ALTER TABLE "listings" ALTER COLUMN "approval_status" SET DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_approval_status_idx" ON "listings" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "listings_status_approval_status_idx" ON "listings" USING btree ("status","approval_status");--> statement-breakpoint
CREATE INDEX "listings_reviewed_at_idx" ON "listings" USING btree ("reviewed_at");