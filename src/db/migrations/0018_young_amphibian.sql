ALTER TABLE "disputes" ADD COLUMN "reference_number" serial NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_reference_number_idx" ON "disputes" USING btree ("reference_number");