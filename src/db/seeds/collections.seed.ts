import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db-seed"; // Use WebSocket driver for Node.js compatibility
import {
  userFavorites,
  userCollections,
  collectionItems,
} from "../schemas/collections.schema";
import { user } from "../schemas/user.schema";
import { listings } from "../schemas/listings.schema";

// Infer types

type NewFavorite = InferInsertModel<typeof userFavorites>;
type NewCollection = InferInsertModel<typeof userCollections>;
type NewCollectionItem = InferInsertModel<typeof collectionItems>;

async function main(): Promise<void> {
  console.log("🌱 Seeding collections...");

  const allUsers = await db.select().from(user);
  const allListings = await db.select().from(listings);

  if (allUsers.length === 0 || allListings.length === 0) {
    throw new Error("Not enough users or listings to seed collections.");
  }

  const favorites: NewFavorite[] = [];
  const collections: NewCollection[] = [];
  const collectionItemsSeed: NewCollectionItem[] = [];

  for (const user of allUsers) {
    // Add some favorites
    const favoriteListings = faker.helpers.arrayElements(
      allListings,
      faker.number.int({ min: 3, max: 8 }),
    );
    for (const listing of favoriteListings) {
      favorites.push({
        id: faker.string.uuid(),
        userId: user.id,
        listingId: listing.id,
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

      const listingsForCollection = faker.helpers.arrayElements(
        allListings,
        faker.number.int({ min: 2, max: 5 }),
      );
      for (const listing of listingsForCollection) {
        collectionItemsSeed.push({
          id: faker.string.uuid(),
          collectionId,
          listingId: listing.id,
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

export { main };
