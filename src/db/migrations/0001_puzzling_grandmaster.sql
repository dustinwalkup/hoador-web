CREATE TYPE "public"."delivery_mode" AS ENUM('pickup_only', 'delivery_only', 'both_available');--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "delivery_mode" "delivery_mode" DEFAULT 'pickup_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "requires_pickup";--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "delivery_available";