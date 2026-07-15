/**
 * Emoji shown next to each service category, keyed by category name. Callers
 * fall back to 💼 for unknown names. Single source of truth for the service
 * browse filters and the neighborhood-need form.
 */
export const SERVICE_CATEGORY_ICONS: Record<string, string> = {
  "Lawn & Yard": "🌿",
  Cleaning: "🧹",
  Handyman: "🔧",
  "Pet Care": "🐾",
  Childcare: "👶",
  "Moving Help": "📦",
  Tutoring: "📚",
  Errands: "🛒",
};

export const STATIC_SERVICE_CATEGORIES = [
  {
    id: "8f3c7a2e-1d4b-4e9f-a5c8-2b6d0e3f7190",
    name: "Lawn & Yard",
    description:
      "Outdoor maintenance, mowing, trimming, and seasonal yard help.",
  },
  {
    id: "2d5e8b1a-3f7c-4e0d-9a2b-5c8f1d4e7a03",
    name: "Cleaning",
    description: "Home and common-area cleaning services.",
  },
  {
    id: "7a1c4f8e-2b5d-4a3c-8e1f-9b6d3a0c5e2f",
    name: "Handyman",
    description: "Minor repairs, installations, and general maintenance tasks.",
  },
  {
    id: "5c9f2a6d-4e8b-4f1e-a3c7-8d2b0f5a9c1e",
    name: "Pet Care",
    description: "Pet sitting, walking, feeding, and basic care support.",
  },
  {
    id: "3e6a9c1f-5b8d-4c2e-b4f8-1d3a7e9c6b2d",
    name: "Childcare",
    description: "Babysitting and child supervision support.",
  },
  {
    id: "9b3f6c0e-2a5d-4b8f-81e4-7a9d2b5c8f0a",
    name: "Moving Help",
    description: "Packing, loading, unloading, and move-day assistance.",
  },
  {
    id: "1f4a7c9b-6d2e-4f0c-95a8-3b1e7f9c2d4a",
    name: "Tutoring",
    description: "Academic and skills tutoring for all ages.",
  },
  {
    id: "6d8b2e5a-9c1f-4a7d-a2b5-4c7a0d8e3b1f",
    name: "Errands",
    description: "Grocery runs, pickups, deliveries, and day-to-day task help.",
  },
];
