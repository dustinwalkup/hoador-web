CREATE TYPE "public"."deposit_hold_status" AS ENUM('scheduled', 'held', 'released', 'expired', 'release_failed', 'failed', 'captured', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."owner_transfer_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'frozen');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('rental_charge', 'security_deposit_hold');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "rental_payment_lifecycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"rental_charge_id" varchar(255),
	"deposit_hold_status" "deposit_hold_status" DEFAULT 'scheduled' NOT NULL,
	"deposit_hold_placed_at" timestamp,
	"deposit_released_at" timestamp,
	"owner_transfer_status" "owner_transfer_status" DEFAULT 'pending' NOT NULL,
	"payout_status" "payout_status" DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" varchar(255),
	"owner_transferred_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_type" "payment_type" DEFAULT 'rental_charge' NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "rental_payment_lifecycle" ADD CONSTRAINT "rental_payment_lifecycle_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rpl_rental_id_idx" ON "rental_payment_lifecycle" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rpl_payout_status_idx" ON "rental_payment_lifecycle" USING btree ("payout_status");--> statement-breakpoint
CREATE INDEX "rpl_deposit_hold_status_idx" ON "rental_payment_lifecycle" USING btree ("deposit_hold_status");--> statement-breakpoint
CREATE INDEX "rentals_return_confirmed_at_idx" ON "rentals" USING btree ("return_confirmed_at");