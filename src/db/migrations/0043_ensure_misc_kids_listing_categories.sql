-- Ensures Miscellaneous and Kids & Baby exist with canonical UUIDs.
-- Covers: 0042 ON CONFLICT (name) DO NOTHING no-op, stale rows, or rows deleted after migrate.
-- Pattern matches 0037_ensure_category_ids_final.sql (listing categories section).
UPDATE listings SET category_id = '99a5cce9-e320-4a34-ad35-3583522e8f69'::uuid WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Miscellaneous' AND id != '99a5cce9-e320-4a34-ad35-3583522e8f69'::uuid);
--> statement-breakpoint
UPDATE listings SET category_id = '886d768f-bad8-496d-b225-9abb59fe89df'::uuid WHERE category_id IN (SELECT id FROM listing_categories WHERE name = 'Kids & Baby' AND id != '886d768f-bad8-496d-b225-9abb59fe89df'::uuid);
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Miscellaneous' AND id != '99a5cce9-e320-4a34-ad35-3583522e8f69'::uuid;
--> statement-breakpoint
DELETE FROM listing_categories WHERE name = 'Kids & Baby' AND id != '886d768f-bad8-496d-b225-9abb59fe89df'::uuid;
--> statement-breakpoint
INSERT INTO listing_categories (id, name, description, icon, parent_id, sort_order, is_active) VALUES
  ('99a5cce9-e320-4a34-ad35-3583522e8f69'::uuid, 'Miscellaneous', 'General items that do not fit other categories', 'misc', NULL, 9, true),
  ('886d768f-bad8-496d-b225-9abb59fe89df'::uuid, 'Kids & Baby', 'Gear and equipment for children and infants', 'kids', NULL, 10, true)
ON CONFLICT (id) DO NOTHING;
