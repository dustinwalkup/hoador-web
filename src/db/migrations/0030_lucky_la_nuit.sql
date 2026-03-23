CREATE TYPE "public"."service_booking_status" AS ENUM('pending', 'accepted', 'declined', 'payment_failed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_listing_status" AS ENUM('pending_approval', 'active', 'inactive', 'denied');--> statement-breakpoint
CREATE TYPE "public"."service_payout_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."service_pricing_type" AS ENUM('fixed', 'hourly');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_booking_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_booking_accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_booking_declined';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_booking_completed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_payout_sent';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_listing_approved';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_listing_rejected';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_listing_pending';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'service_no_show_reported';--> statement-breakpoint
CREATE TABLE "service_no_show_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"reported_by" text NOT NULL,
	"notes" text,
	"reported_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewee_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"requester_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"community_id" uuid NOT NULL,
	"proposed_date" date NOT NULL,
	"proposed_time" varchar(10) NOT NULL,
	"hours" numeric(4, 2),
	"notes" text,
	"decline_reason" text,
	"service_price" numeric(10, 2) NOT NULL,
	"service_fee" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" "service_booking_status" DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"payment_status" varchar(50),
	"refund_amount" numeric(10, 2),
	"stripe_refund_id" varchar(255),
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"cancellation_reason" text,
	"completed_at" timestamp,
	"payout_status" "service_payout_status",
	"stripe_transfer_id" varchar(255),
	"owner_transferred_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_listing_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_listing_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "service_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"pricing_type" "service_pricing_type" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"service_notes" text,
	"status" "service_listing_status" DEFAULT 'pending_approval' NOT NULL,
	"admin_note" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_provider_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bio" text,
	"aggregate_rating" numeric(3, 2),
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_provider_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "service_no_show_reports" ADD CONSTRAINT "service_no_show_reports_booking_id_service_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."service_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_no_show_reports" ADD CONSTRAINT "service_no_show_reports_reported_by_user_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_booking_id_service_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."service_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_listing_id_service_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."service_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_reviewee_id_user_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_listing_id_service_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."service_listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_provider_id_user_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_provider_id_user_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_category_id_service_listing_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_listing_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_provider_profiles" ADD CONSTRAINT "service_provider_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sr_reviewer_booking_idx" ON "service_reviews" USING btree ("booking_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "sr_reviewee_idx" ON "service_reviews" USING btree ("reviewee_id");--> statement-breakpoint
CREATE INDEX "sr_listing_idx" ON "service_reviews" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "sb_payout_status_idx" ON "service_bookings" USING btree ("payout_status");--> statement-breakpoint
CREATE INDEX "sb_completed_at_idx" ON "service_bookings" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "sb_provider_idx" ON "service_bookings" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "sb_requester_idx" ON "service_bookings" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "sl_community_status_idx" ON "service_listings" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "sl_provider_idx" ON "service_listings" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "sl_category_idx" ON "service_listings" USING btree ("category_id");