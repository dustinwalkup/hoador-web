-- Migrates listing_categories to use stable hardcoded UUIDs that match the
-- frontend STATIC_CATEGORIES constants in src/constants/listings.ts.
-- Safe to run multiple times (idempotent) and handles partial prior runs.

DO $$
DECLARE
  cat     RECORD;
  old_id  uuid;
  temp_exists boolean;
BEGIN
  FOR cat IN
    SELECT * FROM (VALUES
      ('ce4622d8-e9cf-40c2-8fbc-d99495aad651'::uuid, 'Power Tools',      'Electric and battery-powered tools for construction and woodworking', 'drill',   1),
      ('3c0d8ccb-2545-4dcc-97d8-394540ea6eb0'::uuid, 'Hand Tools',       'Non-powered hand tools for various tasks',                            'wrench',  2),
      ('f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90'::uuid, 'Gardening',        'Yard maintenance and gardening equipment',                            'shovel',  3),
      ('fe211c30-81b4-46b6-94b2-6fde2aebd68f'::uuid, 'Ladders & Access', 'Ladders, scaffolding, and access equipment',                          'ladder',  4),
      ('052899f7-17fa-4abc-a749-cee4183f4b18'::uuid, 'Construction',     'Heavy-duty construction and building tools',                          'hammer',  5),
      ('7f193d36-b821-498e-87e2-0eac45a78ffa'::uuid, 'Cleaning',         'Pressure washers and cleaning equipment',                            'vacuum',  6),
      ('6b38e3ed-1b05-44c0-9e7f-645f4c029758'::uuid, 'Automotive',       'Car repair and maintenance tools',                                   'jack',    7),
      ('252eb012-ed42-495e-a0e0-b958610ec6f7'::uuid, 'Party Equipment',  'Tables, tents, and event equipment',                                 'tent',    8)
    ) AS t(correct_id, name, description, icon, sort_order)
  LOOP
    -- Find existing row by name (may be absent or have a different ID)
    SELECT id INTO old_id FROM listing_categories WHERE name = cat.name;

    -- Already correct — nothing to do
    IF old_id IS NOT NULL AND old_id = cat.correct_id THEN
      CONTINUE;
    END IF;

    -- Check whether the correct-ID row already exists (partial prior run)
    SELECT EXISTS(SELECT 1 FROM listing_categories WHERE id = cat.correct_id)
      INTO temp_exists;

    IF old_id IS NULL AND NOT temp_exists THEN
      -- Category doesn't exist at all (e.g. fresh staging/prod env) — insert directly
      INSERT INTO listing_categories (id, name, description, icon, parent_id, sort_order, is_active)
      VALUES (cat.correct_id, cat.name, cat.description, cat.icon, NULL, cat.sort_order, true);
      CONTINUE;
    END IF;

    IF NOT temp_exists THEN
      -- Insert new row under a temp name to avoid the unique name constraint
      INSERT INTO listing_categories (id, name, description, icon, parent_id, sort_order, is_active)
      VALUES (cat.correct_id, cat.name || '__migrating', cat.description, cat.icon, NULL, cat.sort_order, true);
    END IF;

    -- Re-point any listings that reference the old ID
    IF old_id IS NOT NULL THEN
      UPDATE listings SET category_id = cat.correct_id WHERE category_id = old_id;
      -- Delete old row (frees the unique name constraint)
      DELETE FROM listing_categories WHERE id = old_id;
    END IF;

    -- Rename temp row to the canonical name
    UPDATE listing_categories SET name = cat.name WHERE id = cat.correct_id;

  END LOOP;
END $$;
