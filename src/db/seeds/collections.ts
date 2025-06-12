import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import {
  userFavorites,
  userCollections,
  collectionItems,
} from "../schemas/collections";
import { users } from "../schemas/users";
import { tools } from "../schemas/tools";

// Infer types

type NewFavorite = InferInsertModel<typeof userFavorites>;
type NewCollection = InferInsertModel<typeof userCollections>;
type NewCollectionItem = InferInsertModel<typeof collectionItems>;

async function main() {
  console.log("🌱 Seeding collections...");

  await db.delete(collectionItems);
  await db.delete(userFavorites);
  await db.delete(userCollections);

  const allUsers = await db.select().from(users);
  const allTools = await db.select().from(tools);

  if (allUsers.length === 0 || allTools.length === 0) {
    throw new Error("Not enough users or tools to seed collections.");
  }

  const favorites: NewFavorite[] = [];
  const collections: NewCollection[] = [];
  const collectionItemsSeed: NewCollectionItem[] = [];

  for (const user of allUsers) {
    // Add some favorites
    const favoriteTools = faker.helpers.arrayElements(
      allTools,
      faker.number.int({ min: 3, max: 8 }),
    );
    for (const tool of favoriteTools) {
      favorites.push({
        id: faker.string.uuid(),
        userId: user.id,
        toolId: tool.id,
        createdAt: new Date(),
      });
    }

    // Create collections for user
    const userCollectionCount = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < userCollectionCount; i++) {
      const collectionId = faker.string.uuid();
      collections.push({
        id: collectionId,
        userId: user.id,
        name: faker.commerce.department() + " Collection",
        description: faker.lorem.sentence(),
        isPublic: faker.datatype.boolean(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const toolsForCollection = faker.helpers.arrayElements(
        allTools,
        faker.number.int({ min: 2, max: 5 }),
      );
      for (const tool of toolsForCollection) {
        collectionItemsSeed.push({
          id: faker.string.uuid(),
          collectionId,
          toolId: tool.id,
          addedAt: new Date(),
        });
      }
    }
  }

  await db.insert(userFavorites).values(favorites);
  await db.insert(userCollections).values(collections);
  await db.insert(collectionItems).values(collectionItemsSeed);

  console.log("✅ Collections seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding collections:", err);
  process.exit(1);
});
