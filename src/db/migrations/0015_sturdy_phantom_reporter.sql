ALTER TABLE "legal_documents" DROP CONSTRAINT "legal_documents_pkey";--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_id_version_pk" PRIMARY KEY("id","version");