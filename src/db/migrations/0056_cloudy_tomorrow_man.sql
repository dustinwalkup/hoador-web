CREATE TABLE "blind_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid,
	"service_booking_id" uuid,
	"reviewer_id" text NOT NULL,
	"reviewee_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"review_window_end_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booking_ref_check" CHECK (num_nonnulls("blind_reviews"."rental_id", "blind_reviews"."service_booking_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "review_aggregate_rating" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "blind_reviews" ADD CONSTRAINT "blind_reviews_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_reviews" ADD CONSTRAINT "blind_reviews_service_booking_id_service_bookings_id_fk" FOREIGN KEY ("service_booking_id") REFERENCES "public"."service_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_reviews" ADD CONSTRAINT "blind_reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_reviews" ADD CONSTRAINT "blind_reviews_reviewee_id_user_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blind_reviews_reviewer_rental_idx" ON "blind_reviews" USING btree ("reviewer_id","rental_id") WHERE "blind_reviews"."rental_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "blind_reviews_reviewer_service_booking_idx" ON "blind_reviews" USING btree ("reviewer_id","service_booking_id") WHERE "blind_reviews"."service_booking_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "blind_reviews_rental_id_idx" ON "blind_reviews" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "blind_reviews_service_booking_id_idx" ON "blind_reviews" USING btree ("service_booking_id");--> statement-breakpoint
CREATE INDEX "blind_reviews_reviewee_id_idx" ON "blind_reviews" USING btree ("reviewee_id");--> statement-breakpoint
CREATE INDEX "blind_reviews_released_at_idx" ON "blind_reviews" USING btree ("released_at");--> statement-breakpoint
CREATE INDEX "blind_reviews_pending_release_idx" ON "blind_reviews" USING btree ("review_window_end_at") WHERE "blind_reviews"."released_at" IS NULL;