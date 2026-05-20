-- Add `expires_at` to rental_requests and service_bookings, with a partial index
-- on pending rows so the expiry cron's lookup stays cheap. Existing rows are
-- backfilled from created_at + 72h so the NOT NULL constraint is safe on a
-- non-empty table. Also extends cancellation_reason enum with the
-- 'expired_no_acceptance' value used by the cron when it auto-cancels.

ALTER TYPE "public"."cancellation_reason" ADD VALUE 'expired_no_acceptance';--> statement-breakpoint

ALTER TABLE "rental_requests" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
UPDATE "rental_requests" SET "expires_at" = "created_at" + interval '72 hours' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "rental_requests" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "service_bookings" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
UPDATE "service_bookings" SET "expires_at" = "created_at" + interval '72 hours' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "service_bookings" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint

CREATE INDEX "rental_requests_pending_expires_at_idx" ON "rental_requests" USING btree ("expires_at") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "sb_pending_expires_at_idx" ON "service_bookings" USING btree ("expires_at") WHERE status = 'pending';
