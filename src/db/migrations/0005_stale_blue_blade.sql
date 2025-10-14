ALTER TABLE "rental_requests" RENAME COLUMN "rejected_at" TO "denied_at";--> statement-breakpoint
ALTER TABLE "rental_requests" RENAME COLUMN "rejection_reason" TO "denial_reason";--> statement-breakpoint
ALTER TABLE "rental_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "rental_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DEFAULT 'approved'::text;--> statement-breakpoint
UPDATE "rental_requests" SET "status" = 'denied' WHERE "status" = 'rejected';--> statement-breakpoint
UPDATE "rentals" SET "status" = 'denied' WHERE "status" = 'rejected';--> statement-breakpoint
DROP TYPE "public"."rental_status";--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('pending', 'approved', 'active', 'completed', 'cancelled', 'overdue', 'denied');--> statement-breakpoint
ALTER TABLE "rental_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."rental_status";--> statement-breakpoint
ALTER TABLE "rental_requests" ALTER COLUMN "status" SET DATA TYPE "public"."rental_status" USING "status"::"public"."rental_status";--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DEFAULT 'approved'::"public"."rental_status";--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DATA TYPE "public"."rental_status" USING "status"::"public"."rental_status";--> statement-breakpoint
DROP TYPE "public"."verification_status";--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'denied');