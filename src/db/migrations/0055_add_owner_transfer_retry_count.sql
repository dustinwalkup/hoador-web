ALTER TABLE "rental_payment_lifecycle"
ADD COLUMN "owner_transfer_retry_count" integer DEFAULT 0 NOT NULL;
