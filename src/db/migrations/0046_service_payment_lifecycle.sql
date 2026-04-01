CREATE TYPE "public"."service_owner_transfer_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'frozen');--> statement-breakpoint
CREATE TABLE "service_payment_lifecycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"charge_id" varchar(255),
	"owner_transfer_status" "service_owner_transfer_status" DEFAULT 'pending' NOT NULL,
	"payout_status" "service_payout_status" DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" varchar(255),
	"owner_transferred_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_payment_lifecycle" ADD CONSTRAINT "service_payment_lifecycle_booking_id_service_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."service_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spl_booking_id_idx" ON "service_payment_lifecycle" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "spl_payout_status_idx" ON "service_payment_lifecycle" USING btree ("payout_status");--> statement-breakpoint
CREATE INDEX "spl_owner_transfer_status_idx" ON "service_payment_lifecycle" USING btree ("owner_transfer_status");--> statement-breakpoint
INSERT INTO "service_payment_lifecycle" ("booking_id", "charge_id", "owner_transfer_status", "payout_status", "stripe_transfer_id", "owner_transferred_at", "created_at", "updated_at")
SELECT
	"id",
	"stripe_charge_id",
	CASE
		WHEN "stripe_transfer_id" IS NOT NULL THEN 'completed'::service_owner_transfer_status
		WHEN "payout_status" = 'failed'::service_payout_status THEN 'failed'::service_owner_transfer_status
		WHEN "payout_status" = 'processing'::service_payout_status THEN 'processing'::service_owner_transfer_status
		ELSE 'pending'::service_owner_transfer_status
	END,
	COALESCE("payout_status", 'pending'::service_payout_status),
	"stripe_transfer_id",
	"owner_transferred_at",
	now(),
	now()
FROM "service_bookings"
WHERE "stripe_charge_id" IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "sb_payout_status_idx";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "payout_status";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "stripe_transfer_id";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "owner_transferred_at";
