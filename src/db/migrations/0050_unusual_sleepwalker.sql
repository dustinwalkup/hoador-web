ALTER TYPE "public"."dispute_reason_code" ADD VALUE 'requester_no_show' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."dispute_reason_code" ADD VALUE 'provider_no_show' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."dispute_role" ADD VALUE 'requester';--> statement-breakpoint
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_rental_id_unique";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('rental_request_created', 'rental_approved', 'rental_denied', 'rental_started', 'rental_ended', 'rental_cancelled', 'rental_overdue', 'rental_reminder', 'payment_succeeded', 'payment_failed', 'payment_refunded', 'review_received', 'message_received', 'listing_approved', 'listing_rejected', 'system', 'dispute_created', 'dispute_evidence_requested', 'dispute_evidence_deadline_approaching', 'dispute_evidence_deadline_expired', 'dispute_resolved', 're_engagement', 'service_booking_requested', 'service_booking_accepted', 'service_booking_declined', 'service_booking_completed', 'service_payout_sent', 'service_listing_approved', 'service_listing_rejected', 'service_listing_pending');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "rental_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "service_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_service_booking_id_service_bookings_id_fk" FOREIGN KEY ("service_booking_id") REFERENCES "public"."service_bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_rental_id_unique" ON "disputes" USING btree ("rental_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_service_booking_id_unique" ON "disputes" USING btree ("service_booking_id");--> statement-breakpoint
CREATE INDEX "disputes_service_booking_id_idx" ON "disputes" USING btree ("service_booking_id");--> statement-breakpoint
CREATE INDEX "disputes_service_booking_id_status_idx" ON "disputes" USING btree ("service_booking_id","status");--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_rental_xor_service_booking_ck" CHECK (("disputes"."rental_id" IS NOT NULL AND "disputes"."service_booking_id" IS NULL) OR ("disputes"."rental_id" IS NULL AND "disputes"."service_booking_id" IS NOT NULL));