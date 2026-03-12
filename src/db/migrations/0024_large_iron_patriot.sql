ALTER TABLE "rental_requests" ADD COLUMN IF NOT EXISTS "service_fee" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN IF NOT EXISTS "application_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN IF NOT EXISTS "owner_payout" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN IF NOT EXISTS "platform_net_revenue" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_images_listing_id_idx" ON "listing_images" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_images_listing_id_order_idx" ON "listing_images" USING btree ("listing_id","order_index");
