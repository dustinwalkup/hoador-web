CREATE TYPE "public"."cancellation_reason" AS ENUM('renter_cancellation', 'owner_cancellation', 'renter_no_show', 'owner_no_show');--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN "cancellation_reason" "cancellation_reason";--> statement-breakpoint
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;