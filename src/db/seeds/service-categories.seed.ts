import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db-seed";
import { serviceListingCategories } from "../schemas/services.schema";
import { STATIC_SERVICE_CATEGORIES } from "../../constants/services";

export async function main(): Promise<void> {
  console.log("🌱 Seeding service listing categories...");

  for (const category of STATIC_SERVICE_CATEGORIES) {
    const existing = await db
      .select({ id: serviceListingCategories.id })
      .from(serviceListingCategories)
      .where(eq(serviceListingCategories.name, category.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(serviceListingCategories).values({
        id: category.id,
        name: category.name,
        description: category.description,
      });
      console.log(`  ✅ Inserted: ${category.name} (${category.id})`);
    } else if (existing[0].id === category.id) {
      console.log(`  ✓ ${category.name} already has correct ID`);
    } else {
      console.log(
        `  ⚠️  ${category.name} exists with wrong ID — run seed:fix-service-categories to migrate`,
      );
    }
  }

  console.log("✅ Done seeding service categories");
}

main().catch((error) => {
  console.error("❌ Failed seeding service categories:", error);
  process.exit(1);
});
