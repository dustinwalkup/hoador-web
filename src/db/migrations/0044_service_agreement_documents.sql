CREATE TABLE IF NOT EXISTS "service_agreement_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_booking_id" uuid NOT NULL,
  "pdf_url" varchar(500) NOT NULL,
  "template_version" varchar(50) NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_agreement_documents_service_booking_id_service_bookings_id_fk'
  ) THEN
    ALTER TABLE "service_agreement_documents"
    ADD CONSTRAINT "service_agreement_documents_service_booking_id_service_bookings_id_fk"
    FOREIGN KEY ("service_booking_id")
    REFERENCES "public"."service_bookings"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "service_agreement_documents_service_booking_id_idx"
ON "service_agreement_documents" USING btree ("service_booking_id");
