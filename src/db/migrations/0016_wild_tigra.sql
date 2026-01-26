CREATE TYPE "public"."audit_action_type" AS ENUM('dispute_created', 'state_change', 'evidence_uploaded', 'evidence_deleted', 'financial_operation', 'note_created', 'note_updated', 'note_deleted', 'resolution');--> statement-breakpoint
CREATE TYPE "public"."dispute_reason_code" AS ENUM('damage', 'non_delivery', 'quality_issue', 'cancellation', 'payment_issue', 'other');--> statement-breakpoint
CREATE TYPE "public"."dispute_resolution_outcome" AS ENUM('favor_renter', 'favor_provider', 'partial_renter', 'partial_provider', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."dispute_role" AS ENUM('renter', 'provider');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'evidence_requested', 'under_review', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('image', 'text');--> statement-breakpoint
CREATE TYPE "public"."financial_operation_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."financial_operation_type" AS ENUM('hold_payout', 'refund_partial', 'refund_full', 'capture_deposit');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'dispute_created';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'dispute_evidence_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'dispute_evidence_deadline_approaching';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'dispute_evidence_deadline_expired';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'dispute_resolved';--> statement-breakpoint
CREATE TABLE "dispute_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"action_type" "audit_action_type" NOT NULL,
	"user_id" text,
	"previous_state" "dispute_status",
	"new_state" "dispute_status",
	"details" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_by_role" "dispute_role" NOT NULL,
	"evidence_type" "evidence_type" NOT NULL,
	"content" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_financial_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"operation_type" "financial_operation_type" NOT NULL,
	"amount" numeric(10, 2),
	"stripe_operation_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"stripe_transfer_id" varchar(255),
	"status" "financial_operation_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"performed_by" text NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"admin_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_by_role" "dispute_role" NOT NULL,
	"reason_code" "dispute_reason_code" NOT NULL,
	"description" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"policy_version" varchar(50) NOT NULL,
	"evidence_deadline" timestamp,
	"additional_evidence_deadline" timestamp,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_outcome" "dispute_resolution_outcome",
	"resolution_reason" text,
	"stripe_chargeback_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_rental_id_unique" UNIQUE("rental_id")
);
--> statement-breakpoint
ALTER TABLE "dispute_audit_logs" ADD CONSTRAINT "dispute_audit_logs_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_audit_logs" ADD CONSTRAINT "dispute_audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_financial_operations" ADD CONSTRAINT "dispute_financial_operations_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_financial_operations" ADD CONSTRAINT "dispute_financial_operations_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_internal_notes" ADD CONSTRAINT "dispute_internal_notes_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_internal_notes" ADD CONSTRAINT "dispute_internal_notes_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_audit_logs_dispute_id_idx" ON "dispute_audit_logs" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_audit_logs_user_id_idx" ON "dispute_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dispute_audit_logs_action_type_idx" ON "dispute_audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "dispute_audit_logs_created_at_idx" ON "dispute_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dispute_evidence_dispute_id_idx" ON "dispute_evidence" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_evidence_uploaded_by_idx" ON "dispute_evidence" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "dispute_evidence_uploaded_at_idx" ON "dispute_evidence" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "dispute_financial_operations_dispute_id_idx" ON "dispute_financial_operations" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_financial_operations_stripe_operation_id_idx" ON "dispute_financial_operations" USING btree ("stripe_operation_id");--> statement-breakpoint
CREATE INDEX "dispute_financial_operations_status_idx" ON "dispute_financial_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dispute_internal_notes_dispute_id_idx" ON "dispute_internal_notes" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_internal_notes_admin_id_idx" ON "dispute_internal_notes" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "dispute_internal_notes_created_at_idx" ON "dispute_internal_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "disputes_rental_id_idx" ON "disputes" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "disputes_created_by_idx" ON "disputes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_reason_code_idx" ON "disputes" USING btree ("reason_code");--> statement-breakpoint
CREATE INDEX "disputes_created_at_idx" ON "disputes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "disputes_rental_id_status_idx" ON "disputes" USING btree ("rental_id","status");