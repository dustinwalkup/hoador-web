-- Add Miscellaneous and Kids & Baby listing categories (canonical UUIDs match seeds).
INSERT INTO listing_categories (id, name, description, icon, parent_id, sort_order, is_active)
VALUES
  (
    '99a5cce9-e320-4a34-ad35-3583522e8f69'::uuid,
    'Miscellaneous',
    'General items that do not fit other categories',
    'misc',
    NULL,
    9,
    true
  ),
  (
    '886d768f-bad8-496d-b225-9abb59fe89df'::uuid,
    'Kids & Baby',
    'Gear and equipment for children and infants',
    'kids',
    NULL,
    10,
    true
  )
ON CONFLICT (name) DO NOTHING;
