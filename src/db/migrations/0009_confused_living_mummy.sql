ALTER TABLE "rentals" ADD COLUMN "application_fee_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_connected_account_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "connect_onboarding_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "connect_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "connect_payouts_enabled" boolean DEFAULT false NOT NULL;