ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "service_listing_id" uuid
REFERENCES "service_listings"("id")
ON DELETE set null
ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_service_listing_id_idx"
ON "messages" USING btree ("service_listing_id");
