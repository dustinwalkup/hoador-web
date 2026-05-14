-- Move the pre-existing "Verona Hills" community into the "Kansas City Metro"
-- network.
--
-- Context: migration 0059 created the KC Metro network + its 8 seeded
-- communities and marked existing memberships primary/verified; migration 0060
-- then parked every still-NULL-network community into a "Test Network"
-- placeholder. In production "Verona Hills" is the community current users
-- belong to, so it landed in "Test Network" and those users only got
-- community_visibility rows for that placeholder network (i.e. single-community
-- behaviour). This migration puts them in the metro-wide network.
--
-- Idempotent and prod-safe: a no-op in any environment that has no community
-- named "Verona Hills". Drizzle's migrator wraps the file in a transaction.

-- 1. Ensure the KC Metro network exists (created by 0059; guard for safety).
INSERT INTO "community_networks" ("name", "slug", "description")
VALUES (
  'Kansas City Metro',
  'kansas-city-metro',
  'Connected neighborhood marketplace network across the Kansas City metro area.'
)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- 2. Attach "Verona Hills" to KC Metro and make sure it is active so it shows
-- up in the /community-select dropdown and in listing search. `IS DISTINCT
-- FROM` skips a pointless write if it is already on the network.
UPDATE "communities"
   SET "network_id" = (SELECT "id" FROM "community_networks" WHERE "slug" = 'kansas-city-metro'),
       "is_active" = true,
       "updated_at" = now()
 WHERE "name" = 'Verona Hills'
   AND "network_id" IS DISTINCT FROM (SELECT "id" FROM "community_networks" WHERE "slug" = 'kansas-city-metro');
--> statement-breakpoint

-- 3. Re-run the visibility backfill (same query as 0059 step 4 / 0060 step 3).
-- Idempotent via the (user_id, community_id) unique index: a no-op for rows
-- already present, and it now also issues rows for "Verona Hills" members
-- across every active KC Metro community (and KC Metro members get a row for
-- "Verona Hills").
INSERT INTO "community_visibility" ("user_id", "community_id", "is_visible")
SELECT m."user_id", c."id", true
  FROM "community_memberships" m
  JOIN "communities" mc ON mc."id" = m."community_id"
  JOIN "communities" c  ON c."network_id" = mc."network_id" AND c."is_active" = true
 WHERE m."is_primary" = true
   AND mc."network_id" IS NOT NULL
ON CONFLICT ("user_id", "community_id") DO NOTHING;
