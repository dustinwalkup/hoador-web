CREATE TYPE "public"."need_close_reason" AS ENUM('manual', 'booking', 'admin');--> statement-breakpoint
CREATE TYPE "public"."need_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."need_type" AS ENUM('rental', 'service');--> statement-breakpoint
CREATE TABLE "neighborhood_need_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"neighborhood_need_id" uuid NOT NULL,
	"listing_type" "need_type" NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neighborhood_needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"community_id" uuid NOT NULL,
	"type" "need_type" NOT NULL,
	"category_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"needed_start_date" date,
	"needed_end_date" date,
	"status" "need_status" DEFAULT 'open' NOT NULL,
	"close_reason" "need_close_reason",
	"closed_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "neighborhood_need_listings" ADD CONSTRAINT "neighborhood_need_listings_neighborhood_need_id_neighborhood_needs_id_fk" FOREIGN KEY ("neighborhood_need_id") REFERENCES "public"."neighborhood_needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_needs" ADD CONSTRAINT "neighborhood_needs_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_needs" ADD CONSTRAINT "neighborhood_needs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "neighborhood_need_listings_need_idx" ON "neighborhood_need_listings" USING btree ("neighborhood_need_id");--> statement-breakpoint
CREATE UNIQUE INDEX "neighborhood_need_listings_listing_idx" ON "neighborhood_need_listings" USING btree ("listing_type","listing_id");--> statement-breakpoint
CREATE INDEX "neighborhood_needs_community_status_idx" ON "neighborhood_needs" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "neighborhood_needs_creator_idx" ON "neighborhood_needs" USING btree ("created_by_user_id");