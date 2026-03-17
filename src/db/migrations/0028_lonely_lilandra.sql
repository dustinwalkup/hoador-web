ALTER TYPE "public"."dispute_reason_code" ADD VALUE 'renter_no_show' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."dispute_reason_code" ADD VALUE 'owner_no_show' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "rental_payment_lifecycle" ADD COLUMN "deposit_captured_at" timestamp;