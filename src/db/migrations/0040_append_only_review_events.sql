CREATE TABLE IF NOT EXISTS "review_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_kind" varchar(64) NOT NULL,
  "entity_id" varchar(255) NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "actor_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_entity_kind_entity_id_idx" ON "review_events" USING btree ("entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_entity_kind_event_type_created_at_idx" ON "review_events" USING btree ("entity_kind","event_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_actor_user_id_created_at_idx" ON "review_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_created_at_idx" ON "review_events" USING btree ("created_at");

