import { randomUUID } from "node:crypto";
import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";

const {
  user,
  communities,
  communityVisibility,
  listingCategories,
  listings,
  rentalRequests,
  serviceListingCategories,
  serviceListings,
  serviceBookings,
} = schema;

/**
 * Thin insert helpers for the real-Postgres suite. Each returns the created
 * row; `overrides` replace any default. Defaults are the minimum the schema
 * requires, so a test states only what it cares about.
 *
 * Deliberately direct inserts, not DAL calls: a factory must not depend on the
 * code under test.
 */

const unique = () => randomUUID().slice(0, 8);

const DAY = 24 * 60 * 60 * 1000;
/** Local midnight, `days` from today: how booked days sit in the DB. */
export const daysFromToday = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + days * DAY);
};

export async function createUser(
  overrides: Partial<typeof user.$inferInsert> = {},
) {
  const id = overrides.id ?? `user-${unique()}`;
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: "Test User",
      email: `${id}@integration.test`,
      emailVerified: true,
      firstName: "Test",
      lastName: "User",
      status: "active",
      ...overrides,
    })
    .returning();
  return row;
}

export async function createCommunity(
  overrides: Partial<typeof communities.$inferInsert> = {},
) {
  const [row] = await db
    .insert(communities)
    .values({ name: `Community ${unique()}`, ...overrides })
    .returning();
  return row;
}

/**
 * Make each user visible in `communityId` — what signup's visibility
 * initialization does. Quote, approve and accept require both parties to be
 * visible in the listing's community (BIZ-08).
 */
export async function createVisibility(
  communityId: string,
  ...userIds: string[]
) {
  return db
    .insert(communityVisibility)
    .values(userIds.map((userId) => ({ userId, communityId, isVisible: true })))
    .returning();
}

export async function createListing(
  ownerId: string,
  overrides: Partial<typeof listings.$inferInsert> = {},
) {
  const communityId = overrides.communityId ?? (await createCommunity()).id;
  const categoryId =
    overrides.categoryId ??
    (
      await db
        .insert(listingCategories)
        .values({ name: `Category ${unique()}` })
        .returning()
    )[0].id;
  const [row] = await db
    .insert(listings)
    .values({
      ownerId,
      communityId,
      categoryId,
      name: "Pressure Washer",
      description: "Integration-test listing",
      condition: "good",
      dailyRate: "25.00",
      status: "available",
      approvalStatus: "approved",
      ...overrides,
    })
    .returning();
  return row;
}

export async function createRentalRequest(
  listingId: string,
  renterId: string,
  ownerId: string,
  overrides: Partial<typeof rentalRequests.$inferInsert> = {},
) {
  const [row] = await db
    .insert(rentalRequests)
    .values({
      listingId,
      renterId,
      ownerId,
      startDate: daysFromToday(3),
      endDate: daysFromToday(5),
      totalDays: 3,
      dailyRate: "25.00",
      totalAmount: "81.00",
      expiresAt: new Date(Date.now() + 3 * DAY),
      ...overrides,
    })
    .returning();
  return row;
}

export async function createServiceListing(
  providerId: string,
  overrides: Partial<typeof serviceListings.$inferInsert> = {},
) {
  const communityId = overrides.communityId ?? (await createCommunity()).id;
  const categoryId =
    overrides.categoryId ??
    (
      await db
        .insert(serviceListingCategories)
        .values({ name: `Service category ${unique()}` })
        .returning()
    )[0].id;
  const [row] = await db
    .insert(serviceListings)
    .values({
      providerId,
      communityId,
      categoryId,
      title: "Lawn mowing",
      description: "Integration-test service",
      pricingType: "fixed",
      price: "50.00",
      status: "active",
      ...overrides,
    })
    .returning();
  return row;
}

export async function createServiceBooking(
  listing: { id: string; providerId: string; communityId: string },
  requesterId: string,
  overrides: Partial<typeof serviceBookings.$inferInsert> = {},
) {
  const [row] = await db
    .insert(serviceBookings)
    .values({
      listingId: listing.id,
      providerId: listing.providerId,
      communityId: listing.communityId,
      requesterId,
      proposedDate: daysFromToday(3).toISOString().slice(0, 10),
      proposedTime: "10:00",
      servicePrice: "50.00",
      serviceFee: "4.00",
      totalAmount: "54.00",
      expiresAt: new Date(Date.now() + 3 * DAY),
      ...overrides,
    })
    .returning();
  return row;
}
