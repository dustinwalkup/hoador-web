-- Migrates service_listing_categories to use stable hardcoded UUIDs that match
-- the STATIC_SERVICE_CATEGORIES constants in src/constants/services.ts.
-- Safe to run multiple times (idempotent) and handles partial prior runs.

DO $$
DECLARE
  cat     RECORD;
  old_id  uuid;
  temp_exists boolean;
BEGIN
  FOR cat IN
    SELECT * FROM (VALUES
      ('8f3c7a2e-1d4b-4e9f-a5c8-2b6d0e3f7190'::uuid, 'Lawn & Yard',   'Outdoor maintenance, mowing, trimming, and seasonal yard help.'),
      ('2d5e8b1a-3f7c-4e0d-9a2b-5c8f1d4e7a03'::uuid, 'Cleaning',      'Home and common-area cleaning services.'),
      ('7a1c4f8e-2b5d-4a3c-8e1f-9b6d3a0c5e2f'::uuid, 'Handyman',      'Minor repairs, installations, and general maintenance tasks.'),
      ('5c9f2a6d-4e8b-4f1e-a3c7-8d2b0f5a9c1e'::uuid, 'Pet Care',      'Pet sitting, walking, feeding, and basic care support.'),
      ('3e6a9c1f-5b8d-4c2e-b4f8-1d3a7e9c6b2d'::uuid, 'Childcare',     'Babysitting and child supervision support.'),
      ('9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a'::uuid, 'Moving Help',   'Packing, loading, unloading, and move-day assistance.'),
      ('1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a'::uuid, 'Tutoring',      'Academic and skills tutoring for all ages.'),
      ('6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f'::uuid, 'Errands',       'Grocery runs, pickups, deliveries, and day-to-day task help.')
    ) AS t(correct_id, name, description)
  LOOP
    -- Find existing row by name (may be absent or have a different ID)
    SELECT id INTO old_id FROM service_listing_categories WHERE name = cat.name;

    -- Already correct — nothing to do
    IF old_id IS NOT NULL AND old_id = cat.correct_id THEN
      CONTINUE;
    END IF;

    -- Check whether the correct-ID row already exists (partial prior run)
    SELECT EXISTS(SELECT 1 FROM service_listing_categories WHERE id = cat.correct_id)
      INTO temp_exists;

    IF old_id IS NULL AND NOT temp_exists THEN
      -- Category doesn't exist at all (e.g. fresh staging/prod env) — insert directly
      INSERT INTO service_listing_categories (id, name, description)
      VALUES (cat.correct_id, cat.name, cat.description);
      CONTINUE;
    END IF;

    IF NOT temp_exists THEN
      -- Insert new row under a temp name to avoid the unique name constraint
      INSERT INTO service_listing_categories (id, name, description)
      VALUES (cat.correct_id, cat.name || '__migrating', cat.description);
    END IF;

    -- Re-point any service listings that reference the old ID
    IF old_id IS NOT NULL THEN
      UPDATE service_listings SET category_id = cat.correct_id WHERE category_id = old_id;
      -- Delete old row (frees the unique name constraint)
      DELETE FROM service_listing_categories WHERE id = old_id;
    END IF;

    -- Rename temp row to the canonical name
    UPDATE service_listing_categories SET name = cat.name WHERE id = cat.correct_id;

  END LOOP;
END $$;
