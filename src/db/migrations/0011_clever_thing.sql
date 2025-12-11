CREATE TYPE "public"."user_type" AS ENUM('standard', 'admin', 'superadmin');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "user_type" "user_type" DEFAULT 'standard' NOT NULL;