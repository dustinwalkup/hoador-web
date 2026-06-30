-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in Postgres.
-- This migration must remain outside any BEGIN/COMMIT wrapper.
ALTER TYPE "public"."notification_category" ADD VALUE IF NOT EXISTS 'neighborhood_needs';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'neighborhood_need_created';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'neighborhood_need_listing_created';
