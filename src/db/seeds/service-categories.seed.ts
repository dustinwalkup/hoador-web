import "dotenv/config";
import { inArray } from "drizzle-orm";
import { db } from "../db-seed";
import { serviceListingCategories } from "../schemas/services.schema";

const CATEGORY_NAMES = [
  "Lawn & Yard",
  "Cleaning",
  "Handyman",
  "Pet Care",
  "Childcare",
  "Moving Help",
  "Tutoring",
  "Errands",
] as const;

const CATEGORY_DESCRIPTIONS: Record<(typeof CATEGORY_NAMES)[number], string> = {
  "Lawn & Yard":
    "Outdoor maintenance, mowing, trimming, and seasonal yard help.",
  Cleaning: "Home and common-area cleaning services.",
  Handyman: "Minor repairs, installations, and general maintenance tasks.",
  "Pet Care": "Pet sitting, walking, feeding, and basic care support.",
  Childcare: "Babysitting and child supervision support.",
  "Moving Help": "Packing, loading, unloading, and move-day assistance.",
  Tutoring: "Academic and skills tutoring for all ages.",
  Errands: "Grocery runs, pickups, deliveries, and day-to-day task help.",
};

export async function main(): Promise<void> {
  console.log("🌱 Seeding service listing categories...");

  const existing = await db
    .select({ name: serviceListingCategories.name })
    .from(serviceListingCategories)
    .where(inArray(serviceListingCategories.name, [...CATEGORY_NAMES]));

  const existingNames = new Set(existing.map((row) => row.name));

  const missingNames = CATEGORY_NAMES.filter(
    (name) => !existingNames.has(name),
  );

  if (missingNames.length === 0) {
    console.log("✅ All service categories already exist");
    return;
  }

  const inserted = await db
    .insert(serviceListingCategories)
    .values(
      missingNames.map((name) => ({
        name,
        description: CATEGORY_DESCRIPTIONS[name],
      })),
    )
    .returning({
      id: serviceListingCategories.id,
      name: serviceListingCategories.name,
    });

  console.log(`✅ Inserted ${inserted.length} service categories`);
  for (const category of inserted) {
    console.log(`  - ${category.name} (${category.id})`);
  }
}

main().catch((error) => {
  console.error("❌ Failed seeding service categories:", error);
  process.exit(1);
});
