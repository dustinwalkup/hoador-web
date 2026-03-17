CREATE TABLE "cron_run_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" varchar(100) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"status" varchar(20) NOT NULL,
	"records_eligible" integer,
	"records_succeeded" integer,
	"records_failed" integer,
	"error_message" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "crh_job_name_idx" ON "cron_run_history" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX "crh_started_at_idx" ON "cron_run_history" USING btree ("started_at");