import "dotenv/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db-seed";
import {
  communities,
  communityMemberships,
} from "../schemas/communities.schema";
import { user } from "../schemas/user.schema";
import {
  serviceListingCategories,
  serviceListings,
} from "../schemas/services.schema";

// const TARGET_JOIN_CODE = "TEST-123";
const TARGET_JOIN_CODE = "VERONA-HILLS-2026";

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

type CategoryName = (typeof CATEGORY_NAMES)[number];

type SampleListingTemplate = {
  category: CategoryName;
  title: string;
  description: string;
  pricingType: "fixed" | "hourly";
  price: string;
  serviceNotes: string;
};

const SAMPLE_LISTINGS: SampleListingTemplate[] = [
  {
    category: "Lawn & Yard",
    title: "[SEED] Weekly Lawn Mowing",
    description: "Mowing, edging, and cleanup for small to medium lawns.",
    pricingType: "fixed",
    price: "55.00",
    serviceNotes: "Includes front and back yard. Green waste bagging included.",
  },
  {
    category: "Cleaning",
    title: "[SEED] Apartment Deep Clean",
    description: "Kitchen, bathroom, floors, and dusting for a full refresh.",
    pricingType: "fixed",
    price: "120.00",
    serviceNotes:
      "2-bedroom max. Bring your own specialty supplies if preferred.",
  },
  {
    category: "Handyman",
    title: "[SEED] TV Mount + Shelf Install",
    description: "Mount TV and install one floating shelf safely and level.",
    pricingType: "hourly",
    price: "45.00",
    serviceNotes: "Hardware not included unless requested in advance.",
  },
  {
    category: "Pet Care",
    title: "[SEED] Dog Walk and Feed Visit",
    description: "30-minute walk with water refill and feeding check-in.",
    pricingType: "hourly",
    price: "25.00",
    serviceNotes:
      "Best for friendly dogs under 80 lbs. Meet-and-greet preferred.",
  },
];

const CATEGORY_DESCRIPTIONS: Record<CategoryName, string> = {
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

async function ensureCategories(): Promise<Record<CategoryName, string>> {
  const existingRows = await db
    .select({
      id: serviceListingCategories.id,
      name: serviceListingCategories.name,
    })
    .from(serviceListingCategories)
    .where(inArray(serviceListingCategories.name, [...CATEGORY_NAMES]));

  const byName = new Map(existingRows.map((row) => [row.name, row.id]));
  const missingNames = CATEGORY_NAMES.filter((name) => !byName.has(name));

  if (missingNames.length > 0) {
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

    for (const row of inserted) {
      byName.set(row.name, row.id);
    }

    console.log(`✅ Added ${inserted.length} missing service categories`);
  }

  const categoryIdByName = {} as Record<CategoryName, string>;
  for (const name of CATEGORY_NAMES) {
    const id = byName.get(name);
    if (!id) {
      throw new Error(`Category not found after ensure step: ${name}`);
    }
    categoryIdByName[name] = id;
  }

  return categoryIdByName;
}

async function ensureProviders(communityId: string): Promise<string[]> {
  const memberRows = await db
    .select({ userId: communityMemberships.userId })
    .from(communityMemberships)
    .where(eq(communityMemberships.communityId, communityId));

  const existingMemberIds = memberRows.map((row) => row.userId);

  if (existingMemberIds.length >= 2) {
    return existingMemberIds.slice(0, 2);
  }

  const neededCount = 2 - existingMemberIds.length;
  const timestampSuffix = Date.now().toString();

  const newUsers = Array.from({ length: neededCount }).map((_, index) => {
    const seedNumber = index + 1;
    const stablePart = `${timestampSuffix}-${seedNumber}`;
    return {
      id: `seed-service-provider-${stablePart}`,
      name: `Seed Service Provider ${seedNumber}`,
      email: `seed-service-provider-${stablePart}@example.test`,
      emailVerified: true,
      firstName: "Seed",
      lastName: `Provider${seedNumber}`,
      status: "active" as const,
      userType: "standard" as const,
    };
  });

  const insertedUsers = await db
    .insert(user)
    .values(newUsers)
    .returning({ id: user.id });

  if (insertedUsers.length !== neededCount) {
    throw new Error("Failed to create required service provider users");
  }

  await db.insert(communityMemberships).values(
    insertedUsers.map((u) => ({
      userId: u.id,
      communityId,
      role: "member" as const,
    })),
  );

  console.log(
    `✅ Created ${insertedUsers.length} provider user(s) and added memberships`,
  );

  return [...existingMemberIds, ...insertedUsers.map((u) => u.id)].slice(0, 2);
}

export async function main(): Promise<void> {
  console.log(
    `🌱 Seeding sample service listings for community ${TARGET_JOIN_CODE}...`,
  );

  const [community] = await db
    .select({ id: communities.id, name: communities.name })
    .from(communities)
    .where(eq(communities.joinCode, TARGET_JOIN_CODE))
    .limit(1);

  if (!community) {
    throw new Error(
      `Community with join code "${TARGET_JOIN_CODE}" was not found. Seed or create it first.`,
    );
  }

  const categoryIds = await ensureCategories();
  const providerIds = await ensureProviders(community.id);

  const candidateTitles = SAMPLE_LISTINGS.map((listing) => listing.title);
  const existingListings = await db
    .select({ title: serviceListings.title })
    .from(serviceListings)
    .where(
      and(
        eq(serviceListings.communityId, community.id),
        inArray(serviceListings.title, candidateTitles),
      ),
    );

  const existingTitleSet = new Set(existingListings.map((row) => row.title));
  const toInsert = SAMPLE_LISTINGS.filter(
    (listing) => !existingTitleSet.has(listing.title),
  ).map((listing, index) => ({
    communityId: community.id,
    providerId: providerIds[index % providerIds.length],
    categoryId: categoryIds[listing.category],
    title: listing.title,
    description: listing.description,
    pricingType: listing.pricingType,
    price: listing.price,
    photos: [],
    serviceNotes: listing.serviceNotes,
    status: "active" as const,
  }));

  if (toInsert.length === 0) {
    console.log("✅ Sample service listings already exist for this community");
    return;
  }

  const inserted: { id: string; title: string }[] = [];
  for (const row of toInsert) {
    const result = await db.execute<{ id: string; title: string }>(
      sql`insert into service_listings
        (community_id, provider_id, category_id, title, description, pricing_type, price, photos, service_notes, status)
        values (
          ${row.communityId},
          ${row.providerId},
          ${row.categoryId},
          ${row.title},
          ${row.description},
          ${row.pricingType},
          ${row.price},
          ${JSON.stringify(row.photos)},
          ${row.serviceNotes},
          ${row.status}
        )
        returning id, title`,
    );

    if (result.rows.length > 0) {
      inserted.push(result.rows[0]);
    }
  }

  console.log(
    `✅ Inserted ${inserted.length} sample service listing(s) into ${community.name}`,
  );
  for (const listing of inserted) {
    console.log(`  - ${listing.title} (${listing.id})`);
  }
}

main().catch((error) => {
  console.error("❌ Failed seeding sample service listings:", error);
  process.exit(1);
});
