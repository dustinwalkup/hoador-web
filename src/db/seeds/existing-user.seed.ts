// Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Now import everything else
import { faker } from "@faker-js/faker";
import { InferInsertModel, eq, and } from "drizzle-orm";
import { db } from "../db-seed"; // Use WebSocket driver for Node.js compatibility
import { user, userAddresses, userPreferences } from "../schemas/user.schema";
import {
  listings,
  listingCategories,
  listingAvailability,
  listingImages,
} from "../schemas/listings.schema";
import {
  communityMemberships,
  communities,
} from "../schemas/communities.schema";

// Infer types
type NewListing = InferInsertModel<typeof listings>;
type NewCategory = InferInsertModel<typeof listingCategories>;
type NewAvailability = InferInsertModel<typeof listingAvailability>;
type NewListingImage = InferInsertModel<typeof listingImages>;

// Configuration - Provide either email or user ID
const TARGET_USER_EMAIL = process.env.TARGET_USER_EMAIL;
const TARGET_USER_ID = process.env.TARGET_USER_ID;
const TARGET_COMMUNITY_ID = process.env.TARGET_COMMUNITY_ID; // Optional: override user's community
const NUMBER_OF_LISTINGS = parseInt(process.env.NUMBER_OF_LISTINGS || "10");

console.log("TARGET_USER_EMAIL", TARGET_USER_EMAIL);
console.log("TARGET_USER_ID", TARGET_USER_ID);
console.log("TARGET_COMMUNITY_ID", TARGET_COMMUNITY_ID);
console.log("NUMBER_OF_LISTINGS", NUMBER_OF_LISTINGS);

// Listing templates
const listingTemplates = [
  {
    image: "car-jack.jpg",
    name: "Hydraulic Floor Jack",
    category: "Automotive",
    description: "Heavy-duty hydraulic floor jack for lifting vehicles safely",
    brand: "Torin",
    specs: { weight: 75, maxLift: "3 tons" },
  },
  {
    image: "Table-Rental.jpg",
    name: "Folding Event Table",
    category: "Party Equipment",
    description: "8ft folding table perfect for events and gatherings",
    brand: "Lifetime",
    specs: { length: 96, width: 30, material: "high-density polyethylene" },
  },
  {
    image: "lawn-mower2.jpg",
    name: "Self-Propelled Lawn Mower",
    category: "Gardening",
    description: "Gas-powered self-propelled mower with mulching capability",
    brand: "Honda",
    specs: { engineSize: "190cc", cuttingWidth: 21, fuelType: "gasoline" },
  },
  {
    image: "shovel.jpg",
    name: "Round Point Shovel",
    category: "Gardening",
    description: "Durable steel shovel for digging and moving soil",
    brand: "Fiskars",
    specs: { material: "steel", handleLength: "48 inches" },
  },
  {
    image: "table-saw.jpg",
    name: "10-Inch Table Saw",
    category: "Power Tools",
    description: "Professional-grade table saw for precision cuts",
    brand: "DeWalt",
    specs: { bladeSize: "10 inches", motor: "15 amp" },
  },
  {
    image: "pressure-washer.jpg",
    name: "Electric Pressure Washer",
    category: "Cleaning",
    description: "2000 PSI electric pressure washer for outdoor cleaning",
    brand: "Sun Joe",
    specs: { psi: 2000, flowRate: "1.76 GPM" },
  },
  {
    image: "drill-set.jpg",
    name: "Cordless Drill Set",
    category: "Power Tools",
    description: "20V cordless drill with complete bit set and carrying case",
    brand: "Milwaukee",
    specs: { voltage: "20V", batteryType: "Lithium-ion" },
  },
  {
    image: "ladder.jpg",
    name: "Extension Ladder",
    category: "Ladders",
    description: "24-foot aluminum extension ladder with 250lb capacity",
    brand: "Werner",
    specs: { height: "24 feet", weight: 250, material: "aluminum" },
  },
  {
    image: "hedge-trimmer.jpg",
    name: "Electric Hedge Trimmer",
    category: "Gardening",
    description: "Corded electric hedge trimmer with 22-inch blade",
    brand: "Black+Decker",
    specs: { bladeLength: "22 inches", power: "120V" },
  },
  {
    image: "garden-tools.jpg",
    name: "Garden Tool Set",
    category: "Gardening",
    description: "Complete garden tool set with 10 essential tools",
    brand: "Gardena",
    specs: { pieces: 10, material: "steel and wood" },
  },
];

async function main() {
  console.log(`🌱 Seeding data for existing user...\n`);

  // Validate input
  if (!TARGET_USER_EMAIL && !TARGET_USER_ID) {
    console.error(
      `❌ Error: Must provide either TARGET_USER_EMAIL or TARGET_USER_ID`,
    );
    console.log(`\n💡 Usage examples:`);
    console.log(`   TARGET_USER_EMAIL="user@example.com" bun run seed:user`);
    console.log(`   TARGET_USER_ID="user-id-123" bun run seed:user`);
    console.log(
      `   TARGET_USER_ID="user-id-123" NUMBER_OF_LISTINGS=20 bun run seed:user`,
    );
    console.log(
      `   TARGET_USER_ID="user-id-123" TARGET_COMMUNITY_ID="community-id" bun run seed:user`,
    );
    process.exit(1);
  }

  // Find the user by email or ID
  let existingUser;
  if (TARGET_USER_ID) {
    console.log(`🌱 Looking up user by ID: ${TARGET_USER_ID}...`);
    existingUser = await db.query.user.findFirst({
      where: eq(user.id, TARGET_USER_ID!),
    });
    if (!existingUser) {
      console.error(`❌ User not found with ID: ${TARGET_USER_ID}`);
      console.log(
        `💡 Tip: Check that the user ID is correct and exists in the database.`,
      );
      process.exit(1);
    }
  } else {
    console.log(`🌱 Looking up user by email: ${TARGET_USER_EMAIL}...`);
    existingUser = await db.query.user.findFirst({
      where: eq(user.email, TARGET_USER_EMAIL!),
    });
    if (!existingUser) {
      console.error(`❌ User not found with email: ${TARGET_USER_EMAIL}`);
      console.log(
        `💡 Tip: Check that the email is correct and the user exists in the database.`,
      );
      process.exit(1);
    }
  }

  console.log(`✅ Found user: ${existingUser.name} (${existingUser.email})`);
  const userId = existingUser.id;

  // Determine which community to use
  let communityId: string;
  let communityName: string;

  if (TARGET_COMMUNITY_ID) {
    // Use specified community ID
    console.log(`🎯 Using specified community ID: ${TARGET_COMMUNITY_ID}`);

    // Verify community exists
    const community = await db.query.communities.findFirst({
      where: eq(communities.id, TARGET_COMMUNITY_ID),
    });

    if (!community) {
      console.error(`❌ Community not found with ID: ${TARGET_COMMUNITY_ID}`);
      console.log(`💡 Tip: Check that the community ID is correct.`);
      process.exit(1);
    }

    // Check if user is a member of this community
    const membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, userId),
        eq(communityMemberships.communityId, TARGET_COMMUNITY_ID),
      ),
    });

    if (!membership) {
      console.error(`❌ User is not a member of community: ${community.name}`);
      console.log(
        `💡 Tip: Add the user to this community first using Drizzle Studio`,
      );
      console.log(`   bun run db:studio`);
      process.exit(1);
    }

    communityId = TARGET_COMMUNITY_ID;
    communityName = community.name;
  } else {
    // Get user's first community membership
    const userMembership = await db.query.communityMemberships.findFirst({
      where: eq(communityMemberships.userId, userId),
      with: {
        community: true,
      },
    });

    if (!userMembership) {
      console.error(`❌ User is not a member of any community`);
      console.log(
        `💡 Tip: Users must be part of a community to have listings.`,
      );
      console.log(
        `   You can use Drizzle Studio to add the user to a community:`,
      );
      console.log(`   bun run db:studio`);
      process.exit(1);
    }

    communityId = userMembership.communityId;
    communityName = userMembership.community.name;
  }

  console.log(`✅ Creating listings for community: ${communityName}`);

  // Check if user already has address and preferences
  const existingAddress = await db.query.userAddresses.findFirst({
    where: eq(userAddresses.userId, userId),
  });

  const existingPreferences = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });

  // Create address if doesn't exist
  if (!existingAddress) {
    console.log("📍 Creating primary address...");
    await db.insert(userAddresses).values({
      userId,
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      zipCode: faker.location.zipCode("#####"),
      country: "US",
      latitude: String(faker.location.latitude()),
      longitude: String(faker.location.longitude()),
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✅ Address created");
  } else {
    console.log("✓ User already has an address");
  }

  // Create preferences if doesn't exist
  if (!existingPreferences) {
    console.log("⚙️ Creating user preferences...");
    await db.insert(userPreferences).values({
      userId,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      marketingEmails: false,
      lendingRadius: 10,
      autoApproveRequests: false,
      weekendAvailability: true,
      defaultRentalPeriod: 5,
      publicProfile: true,
      showLocation: true,
      showActivityStatus: false,
      analyticsTracking: true,
      language: "en",
      timezone: "America/Chicago",
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✅ Preferences created");
  } else {
    console.log("✓ User already has preferences");
  }

  // Create listings
  console.log(`📦 Creating ${NUMBER_OF_LISTINGS} listings...`);
  const seedListings: NewListing[] = [];
  const seedCategories: NewCategory[] = [];
  const seedAvailabilities: NewAvailability[] = [];
  const seedListingImages: NewListingImage[] = [];

  // Get available categories
  const availableCategories = await db.query.listingCategories.findMany();
  const categoryMap = new Map(
    availableCategories.map((cat) => [cat.name, cat.id]),
  );

  for (let i = 0; i < NUMBER_OF_LISTINGS; i++) {
    const template = listingTemplates[i % listingTemplates.length];
    const listingId = faker.string.uuid();

    // Find or create category
    let categoryId = categoryMap.get(template.category);
    if (!categoryId) {
      categoryId = faker.string.uuid();
      seedCategories.push({
        id: categoryId,
        name: template.category,
        description: `Tools and equipment for ${template.category.toLowerCase()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      categoryMap.set(template.category, categoryId);
    }

    // Create listing with schema-compliant data
    const dailyRate = faker.number.float({
      min: 5,
      max: 50,
      fractionDigits: 2,
    });
    const listing: NewListing = {
      id: listingId,
      ownerId: userId,
      communityId: communityId,
      name: template.name,
      description: template.description,
      categoryId: categoryId,
      brand: template.brand,
      condition: ["new", "good", "fair"][faker.number.int({ min: 0, max: 2 })],
      dailyRate: dailyRate.toString(),
      weeklyRate: (dailyRate * 6).toFixed(2),
      monthlyRate: (dailyRate * 25).toFixed(2),
      securityDeposit: faker.number
        .float({ min: 10, max: 100, fractionDigits: 2 })
        .toString(),
      specifications: Object.fromEntries(
        Object.entries(template.specs).filter(([, v]) => v !== undefined),
      ) as Record<string, string | number | boolean | string[]>,
      status: ["available", "available", "available", "inactive"][
        faker.number.int({ min: 0, max: 3 })
      ] as "available" | "inactive",
      viewCount: faker.number.int({ min: 0, max: 500 }),
      favoriteCount: faker.number.int({ min: 0, max: 50 }),
      deliveryMode: faker.datatype.boolean() ? "both_available" : "pickup_only",
      deliveryFee: faker.number
        .float({ min: 5, max: 25, fractionDigits: 2 })
        .toString(),
      deliveryRadius: faker.number.int({ min: 5, max: 50 }),
      minimumRentalPeriod: faker.number.int({ min: 1, max: 3 }),
      maximumRentalPeriod: faker.number.int({ min: 7, max: 30 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    seedListings.push(listing);

    // Create listing image
    const imageUrl = `/images/mock/tools/${template.image}`;
    seedListingImages.push({
      id: faker.string.uuid(),
      listingId: listingId,
      imageUrl: imageUrl,
      blobPathname: `mock/tools/${template.image}`, // Mock pathname for seed data
      orderIndex: 0,
      createdAt: new Date(),
    });

    // Create availability (available for next 30 days)
    const availabilityStart = new Date();
    const availabilityEnd = new Date();
    availabilityEnd.setDate(availabilityStart.getDate() + 30);

    seedAvailabilities.push({
      id: faker.string.uuid(),
      listingId: listingId,
      startDate: availabilityStart,
      endDate: availabilityEnd,
      isBlocked: false, // false means available
      createdAt: new Date(),
    });
  }

  // Insert all the data
  if (seedCategories.length > 0) {
    await db.insert(listingCategories).values(seedCategories);
    console.log(`✅ Created ${seedCategories.length} new categories`);
  }

  await db.insert(listings).values(seedListings);
  console.log(`✅ Created ${seedListings.length} listings`);

  await db.insert(listingImages).values(seedListingImages);
  console.log(`✅ Created ${seedListingImages.length} listing images`);

  await db.insert(listingAvailability).values(seedAvailabilities);
  console.log(`✅ Created ${seedAvailabilities.length} availability entries`);

  console.log("\n🎉 Existing user seed complete!");
  console.log(`\n📊 Summary:`);
  console.log(`   User: ${existingUser.name} (${existingUser.email})`);
  console.log(`   User ID: ${existingUser.id}`);
  console.log(`   Listings: ${seedListings.length}`);
  console.log(`   Categories: ${seedCategories.length} (new)`);
  console.log(`   Images: ${seedListingImages.length}`);
  console.log(`   Availability: ${seedAvailabilities.length}`);
}

export { main };

// Allow running directly
main().catch((err) => {
  console.error("❌ Error seeding:", err);
  process.exit(1);
});
