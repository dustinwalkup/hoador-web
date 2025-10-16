-- Convert column to text first
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint

-- Update existing values to match new enum names
UPDATE "notifications" SET "type" = 'rental_request_created' WHERE "type" = 'rental_request';--> statement-breakpoint
UPDATE "notifications" SET "type" = 'payment_succeeded' WHERE "type" = 'payment';--> statement-breakpoint
UPDATE "notifications" SET "type" = 'review_received' WHERE "type" = 'review';--> statement-breakpoint

-- Drop old enum and create new one
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('rental_request_created', 'rental_approved', 'rental_denied', 'rental_started', 'rental_ended', 'rental_cancelled', 'rental_overdue', 'rental_reminder', 'payment_succeeded', 'payment_failed', 'payment_refunded', 'review_received', 'system');--> statement-breakpoint

-- Convert column back to enum
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";