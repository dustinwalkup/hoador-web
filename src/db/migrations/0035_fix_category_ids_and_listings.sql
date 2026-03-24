-- Comprehensive fix for category IDs across both listing and service tables.
-- Handles all states: fresh env (empty tables), partial prior runs, already correct.
--
-- After fixing category rows, also NULLs out any listings.category_id that
-- references a UUID no longer present in listing_categories (orphaned from a
-- prior seed run that used random IDs).

-- ─── 1. Listing categories ──────────────────────────────────────────────────

DO $$
DECLARE
  cat        RECORD;
  old_id     uuid;
  temp_exists boolean;
BEGIN
  FOR cat IN
    SELECT * FROM (VALUES
      ('ce4622d8-e9cf-40c2-8fbc-d99495aad651'::uuid, 'Power Tools',      'Electric and battery-powered tools for construction and woodworking', 'drill',  1),
      ('3c0d8ccb-2545-4dcc-97d8-394540ea6eb0'::uuid, 'Hand Tools',       'Non-powered hand tools for various tasks',                            'wrench', 2),
      ('f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90'::uuid, 'Gardening',        'Yard maintenance and gardening equipment',                            'shovel', 3),
      ('fe211c30-81b4-46b6-94b2-6fde2aebd68f'::uuid, 'Ladders & Access', 'Ladders, scaffolding, and access equipment',                          'ladder', 4),
      ('052899f7-17fa-4abc-a749-cee4183f4b18'::uuid, 'Construction',     'Heavy-duty construction and building tools',                          'hammer', 5),
      ('7f193d36-b821-498e-87e2-0eac45a78ffa'::uuid, 'Cleaning',         'Pressure washers and cleaning equipment',                            'vacuum', 6),
      ('6b38e3ed-1b05-44c0-9e7f-645f4c029758'::uuid, 'Automotive',       'Car repair and maintenance tools',                                   'jack',   7),
      ('252eb012-ed42-495e-a0e0-b958610ec6f7'::uuid, 'Party Equipment',  'Tables, tents, and event equipment',                                 'tent',   8)
    ) AS t(correct_id, name, description, icon, sort_order)
  LOOP
    SELECT id INTO old_id FROM listing_categories WHERE name = cat.name;

    IF old_id IS NOT NULL AND old_id = cat.correct_id THEN
      CONTINUE;
    END IF;

    SELECT EXISTS(SELECT 1 FROM listing_categories WHERE id = cat.correct_id)
      INTO temp_exists;

    IF old_id IS NULL AND NOT temp_exists THEN
      INSERT INTO listing_categories (id, name, description, icon, parent_id, sort_order, is_active)
      VALUES (cat.correct_id, cat.name, cat.description, cat.icon, NULL, cat.sort_order, true);
      CONTINUE;
    END IF;

    IF NOT temp_exists THEN
      INSERT INTO listing_categories (id, name, description, icon, parent_id, sort_order, is_active)
      VALUES (cat.correct_id, cat.name || '__migrating', cat.description, cat.icon, NULL, cat.sort_order, true);
    END IF;

    IF old_id IS NOT NULL THEN
      UPDATE listings SET category_id = cat.correct_id WHERE category_id = old_id;
      DELETE FROM listing_categories WHERE id = old_id;
    END IF;

    UPDATE listing_categories SET name = cat.name WHERE id = cat.correct_id;
  END LOOP;
END $$;

-- NULL out any listings whose category_id no longer exists in listing_categories
-- (orphaned from a prior seed run that used random UUIDs)
UPDATE listings
SET category_id = NULL
WHERE category_id IS NOT NULL
  AND category_id NOT IN (SELECT id FROM listing_categories);

-- ─── 2. Service listing categories ──────────────────────────────────────────
-- Wrapped in a table-existence check so this is safe even if the services
-- feature has not yet been deployed to this environment.

DO $$
DECLARE
  cat        RECORD;
  old_id     uuid;
  temp_exists boolean;
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_listing_categories'
  ) THEN
    RETURN;
  END IF;

  FOR cat IN
    SELECT * FROM (VALUES
      ('8f3c7a2e-1d4b-4e9f-a5c8-2b6d0e3f7190'::uuid, 'Lawn & Yard',  'Outdoor maintenance, mowing, trimming, and seasonal yard help.'),
      ('2d5e8b1a-3f7c-4e0d-9a2b-5c8f1d4e7a03'::uuid, 'Cleaning',     'Home and common-area cleaning services.'),
      ('7a1c4f8e-2b5d-4a3c-8e1f-9b6d3a0c5e2f'::uuid, 'Handyman',     'Minor repairs, installations, and general maintenance tasks.'),
      ('5c9f2a6d-4e8b-4f1e-a3c7-8d2b0f5a9c1e'::uuid, 'Pet Care',     'Pet sitting, walking, feeding, and basic care support.'),
      ('3e6a9c1f-5b8d-4c2e-b4f8-1d3a7e9c6b2d'::uuid, 'Childcare',    'Babysitting and child supervision support.'),
      ('9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a'::uuid, 'Moving Help',  'Packing, loading, unloading, and move-day assistance.'),
      ('1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a'::uuid, 'Tutoring',     'Academic and skills tutoring for all ages.'),
      ('6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f'::uuid, 'Errands',      'Grocery runs, pickups, deliveries, and day-to-day task help.')
    ) AS t(correct_id, name, description)
  LOOP
    SELECT id INTO old_id FROM service_listing_categories WHERE name = cat.name;

    IF old_id IS NOT NULL AND old_id = cat.correct_id THEN
      CONTINUE;
    END IF;

    SELECT EXISTS(SELECT 1 FROM service_listing_categories WHERE id = cat.correct_id)
      INTO temp_exists;

    IF old_id IS NULL AND NOT temp_exists THEN
      INSERT INTO service_listing_categories (id, name, description)
      VALUES (cat.correct_id, cat.name, cat.description);
      CONTINUE;
    END IF;

    IF NOT temp_exists THEN
      INSERT INTO service_listing_categories (id, name, description)
      VALUES (cat.correct_id, cat.name || '__migrating', cat.description);
    END IF;

    IF old_id IS NOT NULL THEN
      UPDATE service_listings SET category_id = cat.correct_id WHERE category_id = old_id;
      DELETE FROM service_listing_categories WHERE id = old_id;
    END IF;

    UPDATE service_listing_categories SET name = cat.name WHERE id = cat.correct_id;
  END LOOP;
END $$;
