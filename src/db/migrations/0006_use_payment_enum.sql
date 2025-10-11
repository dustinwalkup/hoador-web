-- Convert rental_requests.payment_status to use the payment_status enum
-- This is separate from adding enum values due to PostgreSQL transaction limitations
ALTER TABLE "rental_requests" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::"public"."payment_status";
ALTER TABLE "rental_requests" ALTER COLUMN "payment_status" SET DATA TYPE "public"."payment_status" USING "payment_status"::"public"."payment_status";

