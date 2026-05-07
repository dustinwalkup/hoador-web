-- Fix 3 service_listing_categories UUIDs whose variant nibble is not RFC 9562
-- compliant (must be 8/9/a/b). Zod 4's z.string().uuid() enforces this strictly.
-- Only the variant nibble changes; all other bytes are preserved.
--
-- Moving Help:  c1e4 -> 81e4
-- Tutoring:     d5a8 -> 95a8
-- Errands:      e2b5 -> a2b5

-- 1. Drop FK so we can update the PK in-place
ALTER TABLE service_listings
  DROP CONSTRAINT service_listings_category_id_service_listing_categories_id_fk;

-- 2. Update category IDs in service_listings first
UPDATE service_listings
  SET category_id = '9b3f6c0e-2a5d-4b8f-81e4-7a9d2b5c8f0a'
  WHERE category_id = '9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a';

UPDATE service_listings
  SET category_id = '1f4a7c9b-6d2e-4f0c-95a8-3b1e7f9c2d4a'
  WHERE category_id = '1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a';

UPDATE service_listings
  SET category_id = '6d8b2e5a-9c1f-4a7d-a2b5-4c7a0d8e3b1f'
  WHERE category_id = '6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f';

-- 3. Update the category PK rows themselves
UPDATE service_listing_categories
  SET id = '9b3f6c0e-2a5d-4b8f-81e4-7a9d2b5c8f0a'
  WHERE id = '9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a';

UPDATE service_listing_categories
  SET id = '1f4a7c9b-6d2e-4f0c-95a8-3b1e7f9c2d4a'
  WHERE id = '1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a';

UPDATE service_listing_categories
  SET id = '6d8b2e5a-9c1f-4a7d-a2b5-4c7a0d8e3b1f'
  WHERE id = '6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f';

-- 4. Re-add the FK
ALTER TABLE service_listings
  ADD CONSTRAINT service_listings_category_id_service_listing_categories_id_fk
  FOREIGN KEY (category_id) REFERENCES service_listing_categories(id);
