ALTER TABLE "user_legal_acceptances" DROP CONSTRAINT "user_legal_acceptances_rental_request_id_rental_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_rental_id_rentals_id_fk";
--> statement-breakpoint
ALTER TABLE "rental_agreement_documents" DROP CONSTRAINT "rental_agreement_documents_rental_request_id_rental_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "rental_payment_lifecycle" DROP CONSTRAINT "rental_payment_lifecycle_rental_id_rentals_id_fk";
--> statement-breakpoint
ALTER TABLE "dispute_financial_operations" ALTER COLUMN "performed_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "user_legal_acceptances_rental_request_id_rental_requests_id_fk" FOREIGN KEY ("rental_request_id") REFERENCES "public"."rental_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreement_documents" ADD CONSTRAINT "rental_agreement_documents_rental_request_id_rental_requests_id_fk" FOREIGN KEY ("rental_request_id") REFERENCES "public"."rental_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_lifecycle" ADD CONSTRAINT "rental_payment_lifecycle_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;