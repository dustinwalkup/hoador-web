-- Multi-community marketplace expansion: attach existing-no-network
-- communities to a "Test Network" so their members can be issued
-- community_visibility rows.
--
-- Why this exists: Migration 0059 inserts the KC Metro network and 8 new
-- communities, but pre-existing communities (the 3 dev seeds) had
-- network_id = NULL. Migration 0059 step 4 only backfills visibility for
-- memberships whose primary community has network_id IS NOT NULL, so
-- those members got zero visibility rows and search would fail-closed
-- for them.
--
-- This migration is idempotent and prod-safe: any community currently
-- without a network gets attached to a "Test Network" placeholder. Admins
-- can later move communities to a different network via the admin UI
-- (tasks 8.8 / 10.9).

-- 1. Ensure Test Network exists.
INSERT INTO "community_networks" ("name", "slug", "description")
VALUES (
  'Test Network',
  'test-network',
  'Default network for communities not yet assigned to a public marketplace network.'
)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- 2. Attach any community currently at network_id IS NULL to Test Network.
UPDATE "communities"
   SET "network_id" = (SELECT "id" FROM "community_networks" WHERE "slug" = 'test-network'),
       "updated_at" = now()
 WHERE "network_id" IS NULL;
--> statement-breakpoint

-- 3. Re-run the visibility backfill from 0059 step 4. Idempotent via the
-- (user_id, community_id) unique index, so this is a no-op for users
-- whose visibility was already populated by 0059.
INSERT INTO "community_visibility" ("user_id", "community_id", "is_visible")
SELECT m."user_id", c."id", true
  FROM "community_memberships" m
  JOIN "communities" mc ON mc."id" = m."community_id"
  JOIN "communities" c  ON c."network_id" = mc."network_id" AND c."is_active" = true
 WHERE m."is_primary" = true
   AND mc."network_id" IS NOT NULL
ON CONFLICT ("user_id", "community_id") DO NOTHING;
