ALTER TABLE "service_payment_lifecycle" ADD COLUMN "provider_payout" numeric(10, 2);--> statement-breakpoint
UPDATE "service_payment_lifecycle" AS spl
SET "provider_payout" = ROUND(
  sb."service_price"::numeric * (1 - 0.2), 2
)
FROM "service_bookings" AS sb
WHERE spl."booking_id" = sb."id"
  AND spl."provider_payout" IS NULL;
