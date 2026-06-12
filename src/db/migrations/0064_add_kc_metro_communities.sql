-- Add 13 KC Metro communities (Kansas City, MO + Leawood, KS) to the
-- "kansas-city-metro" network and re-run the visibility backfill so existing
-- KC Metro members get community_visibility rows for the new communities.
-- Idempotent — safe to re-run. Drizzle's migrator wraps each migration file
-- in a transaction, so no explicit BEGIN/COMMIT is needed here.

-- 1. Ensure the KC Metro network exists (created by 0059; guard for safety).
INSERT INTO "community_networks" ("name", "slug", "description")
VALUES (
  'Kansas City Metro',
  'kansas-city-metro',
  'Connected neighborhood marketplace network across the Kansas City metro area.'
)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- 2. Insert the 13 new communities. communities.name has no unique index, so
-- we guard with WHERE NOT EXISTS scoped to the KC Metro network (same pattern
-- as 0059 step 2). zip included where known, NULL otherwise.
INSERT INTO "communities" ("name", "city", "state", "zip", "network_id", "is_active")
SELECT new_communities.name, new_communities.city, new_communities.state, new_communities.zip, kc.id, true
FROM (SELECT id FROM "community_networks" WHERE "slug" = 'kansas-city-metro') AS kc
CROSS JOIN (VALUES
  ('Sommerset Valley',   'Kansas City', 'MO', '64145'),
  ('Woods of Sommerset', 'Kansas City', 'MO', '64146'),
  ('Wellington Green',   'Kansas City', 'MO', NULL),
  ('Huntington Place',   'Kansas City', 'MO', NULL),
  ('Innsbrook',          'Kansas City', 'MO', NULL),
  ('Newcastle',          'Kansas City', 'MO', '64145'),
  ('Red Bridge Gardens', 'Kansas City', 'MO', NULL),
  ('Pembroke Court',     'Leawood',     'KS', '66209'),
  ('Oxford Hills',       'Leawood',     'KS', NULL),
  ('Oxford Hills West',  'Leawood',     'KS', NULL),
  ('Bradford Place',     'Leawood',     'KS', NULL),
  ('Hunter''s Ridge',    'Leawood',     'KS', NULL),
  ('Foxborough',         'Leawood',     'KS', NULL)
) AS new_communities(name, city, state, zip)
WHERE NOT EXISTS (
  SELECT 1 FROM "communities" c
  WHERE c."name" = new_communities.name
    AND c."network_id" = kc.id
);
--> statement-breakpoint

-- 3. Re-run the visibility backfill (same query as 0059 step 4 / 0060 step 3 /
-- 0061 step 3). Idempotent via the (user_id, community_id) unique index: a
-- no-op for rows already present, and it now issues rows for every existing
-- primary KC Metro member across each new active community.
INSERT INTO "community_visibility" ("user_id", "community_id", "is_visible")
SELECT m."user_id", c."id", true
  FROM "community_memberships" m
  JOIN "communities" mc ON mc."id" = m."community_id"
  JOIN "communities" c  ON c."network_id" = mc."network_id" AND c."is_active" = true
 WHERE m."is_primary" = true
   AND mc."network_id" IS NOT NULL
ON CONFLICT ("user_id", "community_id") DO NOTHING;
