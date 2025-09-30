-- Baseline migration: Add setup fields to existing schema
ALTER TABLE "listings" ADD COLUMN "setup_fee" numeric(10,2) DEFAULT '0' NOT NULL;
ALTER TABLE "listings" ADD COLUMN "setup_available" boolean DEFAULT false NOT NULL;