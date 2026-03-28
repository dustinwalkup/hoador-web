ALTER TYPE "public"."payment_type" ADD VALUE 'service_charge';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "rental_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "service_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_service_booking_id_service_bookings_id_fk" FOREIGN KEY ("service_booking_id") REFERENCES "public"."service_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_service_booking_id_idx" ON "payments" USING btree ("service_booking_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_xor_service_booking_chk" CHECK (
  (rental_id IS NOT NULL AND service_booking_id IS NULL) OR
  (rental_id IS NULL AND service_booking_id IS NOT NULL)
);