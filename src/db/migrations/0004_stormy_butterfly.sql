ALTER TABLE "rental_requests" ADD COLUMN "payment_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN "payment_failure_reason" text;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN "security_deposit_auth_id" varchar(255);--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "rental_payment_intent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "security_deposit_auth_id" varchar(255);