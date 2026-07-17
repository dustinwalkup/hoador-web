CREATE TYPE "public"."push_receipt_status" AS ENUM('pending', 'ok', 'error');--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "p256dh" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "auth" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_notification_audit" ADD COLUMN "expo_ticket_id" text;--> statement-breakpoint
ALTER TABLE "push_notification_audit" ADD COLUMN "receipt_status" "push_receipt_status";--> statement-breakpoint
CREATE INDEX "push_notification_audit_pending_receipt_idx" ON "push_notification_audit" USING btree ("sent_at") WHERE "push_notification_audit"."receipt_status" = 'pending';--> statement-breakpoint
-- Hand-added, not drizzle-kit generated. The two unique indexes below cannot
-- build if any device already has more than one *active* row. Subscription
-- dedup has always been a read-then-write in the DAL with no constraint behind
-- it, so concurrent subscribes could leave exactly that. Collapse duplicates to
-- the newest row per device first, which is what the DAL's own self-healing
-- path does on the next subscribe anyway — this just does it now, so the index
-- build is deterministic instead of dependent on production data.
-- Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md (F37).
UPDATE "push_subscriptions" SET "is_active" = false, "updated_at" = now()
WHERE "is_active" AND "platform" = 'web' AND "id" NOT IN (
  SELECT DISTINCT ON ("endpoint") "id" FROM "push_subscriptions"
  WHERE "is_active" AND "platform" = 'web'
  ORDER BY "endpoint", "updated_at" DESC, "id"
);--> statement-breakpoint
UPDATE "push_subscriptions" SET "is_active" = false, "updated_at" = now()
WHERE "is_active" AND "platform" IN ('ios', 'android') AND "token" IS NOT NULL AND "id" NOT IN (
  SELECT DISTINCT ON ("token") "id" FROM "push_subscriptions"
  WHERE "is_active" AND "platform" IN ('ios', 'android') AND "token" IS NOT NULL
  ORDER BY "token", "updated_at" DESC, "id"
);--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_web_active_uniq" ON "push_subscriptions" USING btree ("endpoint") WHERE "push_subscriptions"."platform" = 'web' and "push_subscriptions"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_token_native_active_uniq" ON "push_subscriptions" USING btree ("token") WHERE "push_subscriptions"."platform" in ('ios', 'android') and "push_subscriptions"."is_active";