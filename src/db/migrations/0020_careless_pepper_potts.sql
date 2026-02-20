CREATE TYPE "public"."notification_category" AS ENUM('bookings', 'payments', 'messages', 'disputes', 'reminders');--> statement-breakpoint
CREATE TYPE "public"."push_subscription_platform" AS ENUM('web', 'ios', 'android');--> statement-breakpoint
CREATE TABLE "notification_category_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" "notification_category" NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"push" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_notification_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subscription_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"platform" "push_subscription_platform" DEFAULT 'web' NOT NULL,
	"token" text,
	"user_agent" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_category_preferences" ADD CONSTRAINT "notification_category_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notification_audit" ADD CONSTRAINT "push_notification_audit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notification_audit" ADD CONSTRAINT "push_notification_audit_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_category_preferences_user_id_idx" ON "notification_category_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_category_preferences_user_category_unique" ON "notification_category_preferences" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "push_notification_audit_user_id_idx" ON "push_notification_audit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_notification_audit_sent_at_idx" ON "push_notification_audit" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "push_notification_audit_event_type_idx" ON "push_notification_audit" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_active_idx" ON "push_subscriptions" USING btree ("user_id","is_active");