import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db-seed";
import {
  serviceListingCategories,
  serviceListings,
} from "../schemas/services.schema";
import { STATIC_SERVICE_CATEGORIES } from "../../constants/services";

async function main(): Promise<void> {
  console.log("🔧 Fixing service category IDs...");

  for (const correct of STATIC_SERVICE_CATEGORIES) {
    const existing = await db
      .select({ id: serviceListingCategories.id })
      .from(serviceListingCategories)
      .where(eq(serviceListingCategories.name, correct.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(serviceListingCategories).values({
        id: correct.id,
        name: correct.name,
        description: correct.description,
      });
      console.log(`  ✅ Inserted missing category: ${correct.name}`);
      continue;
    }

    const oldId = existing[0].id;

    if (oldId === correct.id) {
      console.log(`  ✓ ${correct.name} already has correct ID`);
      continue;
    }

    // Insert new row with correct ID under a temp name to avoid unique constraint
    await db.insert(serviceListingCategories).values({
      id: correct.id,
      name: `${correct.name}__migrating`,
      description: correct.description,
    });

    // Point all service listings to the new ID
    const updated = await db
      .update(serviceListings)
      .set({ categoryId: correct.id })
      .where(eq(serviceListings.categoryId, oldId))
      .returning({ id: serviceListings.id });

    // Delete the old row first (frees the unique name constraint)
    await db
      .delete(serviceListingCategories)
      .where(eq(serviceListingCategories.id, oldId));

    // Now rename the temp row to the correct name
    await db
      .update(serviceListingCategories)
      .set({ name: correct.name })
      .where(eq(serviceListingCategories.id, correct.id));

    console.log(
      `  ✅ ${correct.name}: migrated ${updated.length} listing(s) from ${oldId} → ${correct.id}`,
    );
  }

  console.log("✅ Done fixing service categories");
}

main().catch((error) => {
  console.error("❌ Failed fixing service categories:", error);
  process.exit(1);
});
