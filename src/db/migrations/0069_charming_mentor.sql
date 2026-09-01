ALTER TABLE "service_bookings" ADD COLUMN "accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "declined_at" timestamp;--> statement-breakpoint
-- Backfill (mobile P-E9-4). Hand-added to the generated migration.
--
-- `updated_at` is the time of the LAST write of any kind, so it only
-- approximates the transition — and only where the transition WAS the last
-- write. That is true for a booking sitting in `accepted` or `declined`, and
-- false for every other state:
--
--   completed          → updated_at is the completion, not the acceptance
--   cancelled          → updated_at is the cancellation
--   payment_failed     → never accepted at all
--
-- Those are left NULL rather than given a number that reads as exact and is
-- not. The booking Timeline renders a stage that happened without a timestamp;
-- a wrong date on the screen a provider uses to locate themselves in a
-- transaction is worse than a missing one.
UPDATE "service_bookings" SET "accepted_at" = "updated_at"
  WHERE "status" = 'accepted' AND "accepted_at" IS NULL;--> statement-breakpoint
UPDATE "service_bookings" SET "declined_at" = "updated_at"
  WHERE "status" = 'declined' AND "declined_at" IS NULL;
