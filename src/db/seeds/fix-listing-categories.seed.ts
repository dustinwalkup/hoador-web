import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db-seed";
import { listingCategories, listings } from "../schemas/listings.schema";

const CORRECT_CATEGORIES = [
  {
    id: "ce4622d8-e9cf-40c2-8fbc-d99495aad651",
    name: "Power Tools",
    description:
      "Electric and battery-powered tools for construction and woodworking",
    icon: "drill",
    sortOrder: 1,
  },
  {
    id: "3c0d8ccb-2545-4dcc-97d8-394540ea6eb0",
    name: "Hand Tools",
    description: "Non-powered hand tools for various tasks",
    icon: "wrench",
    sortOrder: 2,
  },
  {
    id: "f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90",
    name: "Gardening",
    description: "Yard maintenance and gardening equipment",
    icon: "shovel",
    sortOrder: 3,
  },
  {
    id: "fe211c30-81b4-46b6-94b2-6fde2aebd68f",
    name: "Ladders & Access",
    description: "Ladders, scaffolding, and access equipment",
    icon: "ladder",
    sortOrder: 4,
  },
  {
    id: "052899f7-17fa-4abc-a749-cee4183f4b18",
    name: "Construction",
    description: "Heavy-duty construction and building tools",
    icon: "hammer",
    sortOrder: 5,
  },
  {
    id: "7f193d36-b821-498e-87e2-0eac45a78ffa",
    name: "Cleaning",
    description: "Pressure washers and cleaning equipment",
    icon: "vacuum",
    sortOrder: 6,
  },
  {
    id: "6b38e3ed-1b05-44c0-9e7f-645f4c029758",
    name: "Automotive",
    description: "Car repair and maintenance tools",
    icon: "jack",
    sortOrder: 7,
  },
  {
    id: "252eb012-ed42-495e-a0e0-b958610ec6f7",
    name: "Party Equipment",
    description: "Tables, tents, and event equipment",
    icon: "tent",
    sortOrder: 8,
  },
];

async function main(): Promise<void> {
  console.log("🔧 Fixing listing category IDs...");

  for (const correct of CORRECT_CATEGORIES) {
    // Look up by name (canonical) and by correct ID (partial-state recovery)
    const [byName] = await db
      .select({ id: listingCategories.id })
      .from(listingCategories)
      .where(eq(listingCategories.name, correct.name))
      .limit(1);

    const [byId] = await db
      .select({ id: listingCategories.id, name: listingCategories.name })
      .from(listingCategories)
      .where(eq(listingCategories.id, correct.id))
      .limit(1);

    const oldId = byName?.id;
    const tempExists = byId && byId.name !== correct.name; // stuck in partial state

    if (!oldId && !byId) {
      // Category missing entirely — insert fresh
      await db.insert(listingCategories).values({
        id: correct.id,
        name: correct.name,
        description: correct.description,
        icon: correct.icon,
        sortOrder: correct.sortOrder,
        parentId: null,
        isActive: true,
      });
      console.log(`  ✅ Inserted missing category: ${correct.name}`);
      continue;
    }

    if (byId?.name === correct.name) {
      console.log(`  ✓ ${correct.name} already has correct ID`);
      continue;
    }

    // If the correct-ID row doesn't exist yet, insert it with a temp name
    if (!tempExists) {
      await db.insert(listingCategories).values({
        id: correct.id,
        name: `${correct.name}__migrating`,
        description: correct.description,
        icon: correct.icon,
        sortOrder: correct.sortOrder,
        parentId: null,
        isActive: true,
      });
    }

    // Migrate listings from old ID to correct ID (safe to run again — idempotent)
    const updated = await db
      .update(listings)
      .set({ categoryId: correct.id })
      .where(eq(listings.categoryId, oldId ?? correct.id))
      .returning({ id: listings.id });

    // Delete old row if it still exists (frees the unique name constraint)
    if (oldId && oldId !== correct.id) {
      await db.delete(listingCategories).where(eq(listingCategories.id, oldId));
    }

    // Rename temp row to correct name
    await db
      .update(listingCategories)
      .set({ name: correct.name })
      .where(eq(listingCategories.id, correct.id));

    console.log(
      `  ✅ ${correct.name}: migrated ${updated.length} listing(s)${oldId ? ` from ${oldId}` : ""} → ${correct.id}`,
    );
  }

  console.log("✅ Done fixing listing categories");
}

main().catch((error) => {
  console.error("❌ Failed fixing listing categories:", error);
  process.exit(1);
});
