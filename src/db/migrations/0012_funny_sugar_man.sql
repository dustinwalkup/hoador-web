CREATE TABLE "legal_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"version" varchar(50) NOT NULL,
	"published_at" timestamp NOT NULL,
	"url" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"version" varchar(50) NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"method" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tos_version" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tos_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "privacy_version" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "privacy_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "community_version" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "community_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "user_legal_acceptances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_legal_acceptances_user_id_idx" ON "user_legal_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_legal_acceptances_document_id_idx" ON "user_legal_acceptances" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "user_legal_acceptances_user_document_idx" ON "user_legal_acceptances" USING btree ("user_id","document_id");