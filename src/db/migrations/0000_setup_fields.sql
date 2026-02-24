-- Add setup fields to existing schema (no-op if listings does not exist yet).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "setup_fee" numeric(10,2) DEFAULT '0' NOT NULL;
    ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "setup_available" boolean DEFAULT false NOT NULL;
  END IF;
END $$;
