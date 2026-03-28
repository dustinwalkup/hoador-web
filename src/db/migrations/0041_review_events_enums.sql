CREATE TYPE "public"."review_entity_kind" AS ENUM('service_listing', 'tool_listing');--> statement-breakpoint
CREATE TYPE "public"."review_event_type" AS ENUM('provider_resubmitted', 'rejected', 'approved');--> statement-breakpoint
ALTER TABLE "review_events" ALTER COLUMN "entity_kind" SET DATA TYPE "public"."review_entity_kind" USING "entity_kind"::"public"."review_entity_kind";--> statement-breakpoint
ALTER TABLE "review_events" ALTER COLUMN "event_type" SET DATA TYPE "public"."review_event_type" USING "event_type"::"public"."review_event_type";
