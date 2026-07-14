import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db-seed";
import { communityMemberships } from "../schemas/communities.schema";
import { listingCategories, listings } from "../schemas/listings.schema";
import {
  neighborhoodNeedListings,
  neighborhoodNeeds,
} from "../schemas/neighborhood-needs.schema";
import { serviceListingCategories } from "../schemas/services.schema";

const SEED_TITLES = [
  "[SEED] Need a Pressure Washer",
  "[SEED] Looking for Lawn Mowing Service",
  "[SEED] Need a Lawn Mower",
];

export async function main(): Promise<void> {
  console.log("🌱 Seeding neighborhood needs...");

  // Skip if already seeded
  const existing = await db
    .select({ title: neighborhoodNeeds.title })
    .from(neighborhoodNeeds)
    .where(eq(neighborhoodNeeds.title, SEED_TITLES[0]))
    .limit(1);

  if (existing.length > 0) {
    console.log("✅ Neighborhood needs already seeded — skipping");
    return;
  }

  // Fetch users with primary community memberships
  const memberships = await db
    .select({
      userId: communityMemberships.userId,
      communityId: communityMemberships.communityId,
    })
    .from(communityMemberships)
    .where(eq(communityMemberships.isPrimary, true))
    .limit(3);

  if (memberships.length < 2) {
    throw new Error(
      "Not enough users with primary memberships. Run communities seed first.",
    );
  }

  // Fetch a rental listing category
  const [rentalCategory] = await db
    .select({ id: listingCategories.id, name: listingCategories.name })
    .from(listingCategories)
    .limit(1);

  if (!rentalCategory) {
    throw new Error(
      "No listing categories found. Run listings seed or fix-listing-categories seed first.",
    );
  }

  // Fetch a service listing category
  const [serviceCategory] = await db
    .select({
      id: serviceListingCategories.id,
      name: serviceListingCategories.name,
    })
    .from(serviceListingCategories)
    .limit(1);

  if (!serviceCategory) {
    throw new Error(
      "No service listing categories found. Run service-categories seed first.",
    );
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 7);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);

  const toDateStr = (d: Date) => d.toISOString().split("T")[0];

  // Need 1 — rental (pressure washer)
  const [rentalNeed] = await db
    .insert(neighborhoodNeeds)
    .values({
      createdByUserId: memberships[0].userId,
      communityId: memberships[0].communityId,
      type: "rental",
      categoryId: rentalCategory.id,
      title: SEED_TITLES[0],
      description:
        "Looking to borrow a pressure washer to clean the driveway and siding. Need it for a weekend.",
      neededStartDate: toDateStr(startDate),
      neededEndDate: toDateStr(endDate),
      status: "open",
    })
    .returning();

  console.log(`✅ Created rental need: "${rentalNeed.title}"`);

  // Need 2 — service (lawn mowing)
  const [serviceNeed] = await db
    .insert(neighborhoodNeeds)
    .values({
      createdByUserId: memberships[1].userId,
      communityId: memberships[1].communityId,
      type: "service",
      categoryId: serviceCategory.id,
      title: SEED_TITLES[1],
      description:
        "Need someone to mow my lawn weekly while I recover from surgery. Front and back yard, about 1/4 acre.",
      neededStartDate: toDateStr(startDate),
      status: "open",
    })
    .returning();

  console.log(`✅ Created service need: "${serviceNeed.title}"`);

  // Need 3 — rental (lawn mower), closed for variety
  const [closedNeed] = await db
    .insert(neighborhoodNeeds)
    .values({
      createdByUserId: memberships[memberships.length > 2 ? 2 : 0].userId,
      communityId: memberships[memberships.length > 2 ? 2 : 0].communityId,
      type: "rental",
      categoryId: rentalCategory.id,
      title: SEED_TITLES[2],
      description:
        "My mower is in the shop. Looking to borrow one for a couple weeks.",
      status: "closed",
      closeReason: "manual",
      closedAt: new Date(),
    })
    .returning();

  console.log(`✅ Created closed rental need: "${closedNeed.title}"`);

  // Linked listing — find any approved listing owned by the first user
  const [linkedListing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.ownerId, memberships[0].userId))
    .limit(1);

  if (linkedListing) {
    await db.insert(neighborhoodNeedListings).values({
      neighborhoodNeedId: rentalNeed.id,
      listingType: "rental",
      listingId: linkedListing.id,
    });
    console.log(
      `✅ Linked listing ${linkedListing.id} to need "${rentalNeed.title}"`,
    );
  } else {
    console.log(
      "⚠️  No listing found for first user — skipping linked listing row",
    );
  }

  console.log("🎉 Neighborhood needs seeding complete");
}

main().catch((err) => {
  console.error("❌ Failed seeding neighborhood needs:", err);
  process.exit(1);
});
