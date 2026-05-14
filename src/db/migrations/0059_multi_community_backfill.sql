-- Multi-community marketplace expansion: data backfill.
-- Idempotent — safe to re-run.
-- Design: specs/multi-community-marketplace/2-design.md §5.2.
-- Drizzle's migrator wraps each migration file in a transaction, so no
-- explicit BEGIN/COMMIT is needed here.

-- 1. Insert KC Metro network (idempotent on slug).
INSERT INTO "community_networks" ("name", "slug", "description")
VALUES (
  'Kansas City Metro',
  'kansas-city-metro',
  'Connected neighborhood marketplace network across the Kansas City metro area.'
)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- 2. Insert the 8 KC Metro communities. communities.name has no unique
-- index, so we guard with WHERE NOT EXISTS scoped to the KC Metro network.
INSERT INTO "communities" ("name", "city", "state", "network_id", "is_active")
SELECT new_communities.name, new_communities.city, new_communities.state, kc.id, true
FROM (SELECT id FROM "community_networks" WHERE "slug" = 'kansas-city-metro') AS kc
CROSS JOIN (VALUES
  ('Glen Arbor Estates',  'Kansas City',     'MO'),
  ('Foxcroft',            'Kansas City',     'MO'),
  ('Timber Trace',        'Kansas City',     'MO'),
  ('Blue Hills Estates',  'Kansas City',     'MO'),
  ('Redbridge North',     'Kansas City',     'MO'),
  ('Verona Gardens',      'Leawood',         'KS'),
  ('Redbridge Estates',   'Kansas City',     'MO'),
  ('Leawood Estates',     'Leawood',         'KS')
) AS new_communities(name, city, state)
WHERE NOT EXISTS (
  SELECT 1 FROM "communities" c
  WHERE c."name" = new_communities.name
    AND c."network_id" = kc.id
);
--> statement-breakpoint

-- 3. Backfill existing memberships: mark as primary + verified. Gated on
-- (is_primary = false AND verification_status = 'pending') so a re-run
-- after backfill is a no-op.
UPDATE "community_memberships"
   SET "is_primary" = true,
       "verification_status" = 'verified',
       "verified_at" = COALESCE("verified_at", "created_at")
 WHERE "is_primary" = false
   AND "verification_status" = 'pending';
--> statement-breakpoint

-- 4. Backfill community_visibility for every primary membership × every
-- active community in that membership's network. Idempotent via the
-- (user_id, community_id) unique index.
INSERT INTO "community_visibility" ("user_id", "community_id", "is_visible")
SELECT m."user_id", c."id", true
  FROM "community_memberships" m
  JOIN "communities" mc ON mc."id" = m."community_id"
  JOIN "communities" c  ON c."network_id" = mc."network_id" AND c."is_active" = true
 WHERE m."is_primary" = true
   AND mc."network_id" IS NOT NULL
ON CONFLICT ("user_id", "community_id") DO NOTHING;
