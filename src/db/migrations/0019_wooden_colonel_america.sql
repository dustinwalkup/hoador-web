CREATE TABLE "rental_agreement_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_request_id" uuid NOT NULL,
	"pdf_url" varchar(500) NOT NULL,
	"template_version" varchar(50) NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rental_agreement_documents_rental_request_id_unique" UNIQUE("rental_request_id")
);
--> statement-breakpoint
ALTER TABLE "rental_agreement_documents" ADD CONSTRAINT "rental_agreement_documents_rental_request_id_rental_requests_id_fk" FOREIGN KEY ("rental_request_id") REFERENCES "public"."rental_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_agreement_documents_rental_request_id_idx" ON "rental_agreement_documents" USING btree ("rental_request_id");