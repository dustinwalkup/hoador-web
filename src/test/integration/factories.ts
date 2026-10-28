import { randomUUID } from "node:crypto";
import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { startOfMarketToday } from "@/features/rentals/lib/availability";
import { toWallClock } from "@/features/schedule/lib/build-schedule";

const {
  user,
  communities,
  communityMemberships,
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
/**
 * Midnight of the day `days` after the MARKET's (Central) today, in the shape
 * a stored booked day has: what the app's day checks (`isPastDay`,
 * `isFutureDay`, `startOfMarketToday`) compare against.
 *
 * Not the runner's today: on a UTC runner from 7pm Central (6pm in winter) the
 * UTC day has already turned, so a rental "starting today" started tomorrow
 * as far as the app was concerned (HOA-124). Stepped with `setDate`, not in
 * 24-hour multiples, so a count across a DST change still lands on midnight.
 */
export const daysFromToday = (days: number) => {
  const d = startOfMarketToday();
  d.setDate(d.getDate() + days);
  return d;
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
 *
 * A user with no home yet also gets `communityId` as their primary
 * membership, as signup gives them: the member-based rule (SETTINGS-004)
 * reads each party's home community and fails closed without one. A user who
 * already has a home keeps it.
 */
export async function createVisibility(
  communityId: string,
  ...userIds: string[]
) {
  await db
    .insert(communityMemberships)
    .values(userIds.map((userId) => ({ userId, communityId, isPrimary: true })))
    .onConflictDoNothing();
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
      proposedDate: toWallClock(daysFromToday(3), { dateOnly: true }),
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
