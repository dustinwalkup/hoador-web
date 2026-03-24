-- Fixes listing and service category IDs using stable hardcoded UUIDs.
-- Each statement is separated by -->statement-breakpoint so Drizzle executes them individually.
--
-- ─── Listing categories: migrate listings off wrong-ID rows ──────────────────
UPDATE listings SET category_id = 'ce4622d8-e9cf-40c2-8fbc-d99495aad651' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Power Tools'      AND id != 'ce4622d8-e9cf-40c2-8fbc-d99495aad651');
--> statement-breakpoint
UPDATE listings SET category_id = '3c0d8ccb-2545-4dcc-97d8-394540ea6eb0' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Hand Tools'       AND id != '3c0d8ccb-2545-4dcc-97d8-394540ea6eb0');
--> statement-breakpoint
UPDATE listings SET category_id = 'f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Gardening'        AND id != 'f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90');
--> statement-breakpoint
UPDATE listings SET category_id = 'fe211c30-81b4-46b6-94b2-6fde2aebd68f' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Ladders & Access' AND id != 'fe211c30-81b4-46b6-94b2-6fde2aebd68f');
--> statement-breakpoint
UPDATE listings SET category_id = '052899f7-17fa-4abc-a749-cee4183f4b18' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Construction'     AND id != '052899f7-17fa-4abc-a749-cee4183f4b18');
--> statement-breakpoint
UPDATE listings SET category_id = '7f193d36-b821-498e-87e2-0eac45a78ffa' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Cleaning'         AND id != '7f193d36-b821-498e-87e2-0eac45a78ffa');
--> statement-breakpoint
UPDATE listings SET category_id = '6b38e3ed-1b05-44c0-9e7f-645f4c029758' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Automotive'       AND id != '6b38e3ed-1b05-44c0-9e7f-645f4c029758');
--> statement-breakpoint
UPDATE listings SET category_id = '252eb012-ed42-495e-a0e0-b958610ec6f7' WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Party Equipment'  AND id != '252eb012-ed42-495e-a0e0-b958610ec6f7');
--> statement-breakpoint
-- ─── Listing categories: delete wrong-ID rows ────────────────────────────────
DELETE FROM listing_categories WHERE name = 'Power Tools'      AND id != 'ce4622d8-e9cf-40c2-8fbc-d99495aad651';
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Hand Tools'       AND id != '3c0d8ccb-2545-4dcc-97d8-394540ea6eb0';
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Gardening'        AND id != 'f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90';
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Ladders & Access' AND id != 'fe211c30-81b4-46b6-94b2-6fde2aebd68f';
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Construction'     AND id != '052899f7-17fa-4abc-a749-cee4183f4b18';
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Cleaning'         AND id != '7f193d36-b821-498e-87e2-0eac45a78ffa';
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Automotive'       AND id != '6b38e3ed-1b05-44c0-9e7f-645f4c029758';
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Party Equipment'  AND id != '252eb012-ed42-495e-a0e0-b958610ec6f7';
--> statement-breakpoint
-- ─── Listing categories: insert missing rows ─────────────────────────────────
INSERT INTO listing_categories (id, name, description, icon, parent_id, sort_order, is_active) VALUES
  ('ce4622d8-e9cf-40c2-8fbc-d99495aad651', 'Power Tools',      'Electric and battery-powered tools for construction and woodworking', 'drill',  NULL, 1, true),
  ('3c0d8ccb-2545-4dcc-97d8-394540ea6eb0', 'Hand Tools',       'Non-powered hand tools for various tasks',                            'wrench', NULL, 2, true),
  ('f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90', 'Gardening',        'Yard maintenance and gardening equipment',                            'shovel', NULL, 3, true),
  ('fe211c30-81b4-46b6-94b2-6fde2aebd68f', 'Ladders & Access', 'Ladders, scaffolding, and access equipment',                          'ladder', NULL, 4, true),
  ('052899f7-17fa-4abc-a749-cee4183f4b18', 'Construction',     'Heavy-duty construction and building tools',                          'hammer', NULL, 5, true),
  ('7f193d36-b821-498e-87e2-0eac45a78ffa', 'Cleaning',         'Pressure washers and cleaning equipment',                            'vacuum', NULL, 6, true),
  ('6b38e3ed-1b05-44c0-9e7f-645f4c029758', 'Automotive',       'Car repair and maintenance tools',                                   'jack',   NULL, 7, true),
  ('252eb012-ed42-495e-a0e0-b958610ec6f7', 'Party Equipment',  'Tables, tents, and event equipment',                                 'tent',   NULL, 8, true)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
-- ─── Listings: null out any orphaned category_id references ──────────────────
UPDATE listings SET category_id = NULL WHERE category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM listing_categories lc WHERE lc.id = listings.category_id);
--> statement-breakpoint
-- ─── Service categories: migrate service_listings off wrong-ID rows ──────────
UPDATE service_listings SET category_id = '8f3c7a2e-1d4b-4e9f-a5c8-2b6d0e3f7190' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Lawn & Yard'  AND id != '8f3c7a2e-1d4b-4e9f-a5c8-2b6d0e3f7190');
--> statement-breakpoint
UPDATE service_listings SET category_id = '2d5e8b1a-3f7c-4e0d-9a2b-5c8f1d4e7a03' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Cleaning'     AND id != '2d5e8b1a-3f7c-4e0d-9a2b-5c8f1d4e7a03');
--> statement-breakpoint
UPDATE service_listings SET category_id = '7a1c4f8e-2b5d-4a3c-8e1f-9b6d3a0c5e2f' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Handyman'     AND id != '7a1c4f8e-2b5d-4a3c-8e1f-9b6d3a0c5e2f');
--> statement-breakpoint
UPDATE service_listings SET category_id = '5c9f2a6d-4e8b-4f1e-a3c7-8d2b0f5a9c1e' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Pet Care'     AND id != '5c9f2a6d-4e8b-4f1e-a3c7-8d2b0f5a9c1e');
--> statement-breakpoint
UPDATE service_listings SET category_id = '3e6a9c1f-5b8d-4c2e-b4f8-1d3a7e9c6b2d' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Childcare'    AND id != '3e6a9c1f-5b8d-4c2e-b4f8-1d3a7e9c6b2d');
--> statement-breakpoint
UPDATE service_listings SET category_id = '9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Moving Help'  AND id != '9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a');
--> statement-breakpoint
UPDATE service_listings SET category_id = '1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Tutoring'     AND id != '1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a');
--> statement-breakpoint
UPDATE service_listings SET category_id = '6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f' WHERE category_id IN (SELECT id FROM service_listing_categories WHERE name = 'Errands'      AND id != '6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f');
--> statement-breakpoint
-- ─── Service categories: delete wrong-ID rows ────────────────────────────────
DELETE FROM service_listing_categories WHERE name = 'Lawn & Yard'  AND id != '8f3c7a2e-1d4b-4e9f-a5c8-2b6d0e3f7190';
--> statement-breakpoint
DELETE FROM service_listing_categories WHERE name = 'Cleaning'     AND id != '2d5e8b1a-3f7c-4e0d-9a2b-5c8f1d4e7a03';
--> statement-breakpoint
DELETE FROM service_listing_categories WHERE name = 'Handyman'     AND id != '7a1c4f8e-2b5d-4a3c-8e1f-9b6d3a0c5e2f';
--> statement-breakpoint
DELETE FROM service_listing_categories WHERE name = 'Pet Care'     AND id != '5c9f2a6d-4e8b-4f1e-a3c7-8d2b0f5a9c1e';
--> statement-breakpoint
DELETE FROM service_listing_categories WHERE name = 'Childcare'    AND id != '3e6a9c1f-5b8d-4c2e-b4f8-1d3a7e9c6b2d';
--> statement-breakpoint
DELETE FROM service_listing_categories WHERE name = 'Moving Help'  AND id != '9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a';
--> statement-breakpoint
DELETE FROM service_listing_categories WHERE name = 'Tutoring'     AND id != '1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a';
--> statement-breakpoint
DELETE FROM service_listing_categories WHERE name = 'Errands'      AND id != '6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f';
--> statement-breakpoint
-- ─── Service categories: insert missing rows ─────────────────────────────────
INSERT INTO service_listing_categories (id, name, description) VALUES
  ('8f3c7a2e-1d4b-4e9f-a5c8-2b6d0e3f7190', 'Lawn & Yard',  'Outdoor maintenance, mowing, trimming, and seasonal yard help.'),
  ('2d5e8b1a-3f7c-4e0d-9a2b-5c8f1d4e7a03', 'Cleaning',     'Home and common-area cleaning services.'),
  ('7a1c4f8e-2b5d-4a3c-8e1f-9b6d3a0c5e2f', 'Handyman',     'Minor repairs, installations, and general maintenance tasks.'),
  ('5c9f2a6d-4e8b-4f1e-a3c7-8d2b0f5a9c1e', 'Pet Care',     'Pet sitting, walking, feeding, and basic care support.'),
  ('3e6a9c1f-5b8d-4c2e-b4f8-1d3a7e9c6b2d', 'Childcare',    'Babysitting and child supervision support.'),
  ('9b3f6c0e-2a5d-4b8f-c1e4-7a9d2b5c8f0a', 'Moving Help',  'Packing, loading, unloading, and move-day assistance.'),
  ('1f4a7c9b-6d2e-4f0c-d5a8-3b1e7f9c2d4a', 'Tutoring',     'Academic and skills tutoring for all ages.'),
  ('6d8b2e5a-9c1f-4a7d-e2b5-4c7a0d8e3b1f', 'Errands',      'Grocery runs, pickups, deliveries, and day-to-day task help.')
ON CONFLICT (id) DO NOTHING;
