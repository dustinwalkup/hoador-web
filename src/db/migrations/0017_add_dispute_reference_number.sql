-- Add reference_number column as INTEGER first (will convert to SERIAL after backfill)
ALTER TABLE "disputes" ADD COLUMN "reference_number" INTEGER;--> statement-breakpoint

-- Backfill existing disputes with sequential numbers based on creation order
UPDATE "disputes" d SET "reference_number" = sub.row_num
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at") as row_num 
  FROM "disputes"
) sub
WHERE d."id" = sub."id";--> statement-breakpoint

-- Make the column NOT NULL
ALTER TABLE "disputes" ALTER COLUMN "reference_number" SET NOT NULL;--> statement-breakpoint

-- Create sequence for future auto-increment
CREATE SEQUENCE "disputes_reference_number_seq" OWNED BY "disputes"."reference_number";--> statement-breakpoint

-- Set sequence to start from the highest existing value
SELECT setval('disputes_reference_number_seq', COALESCE((SELECT MAX("reference_number") FROM "disputes"), 0), true);--> statement-breakpoint

-- Set the column default to use the sequence
ALTER TABLE "disputes" ALTER COLUMN "reference_number" SET DEFAULT nextval('disputes_reference_number_seq');--> statement-breakpoint

-- Create unique index on reference_number
CREATE UNIQUE INDEX "disputes_reference_number_idx" ON "disputes"("reference_number");--> statement-breakpoint
