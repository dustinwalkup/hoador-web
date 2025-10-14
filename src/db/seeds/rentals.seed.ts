import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db-seed"; // Use WebSocket driver for Node.js compatibility
import { rentalRequests, rentals, reviews } from "../schemas/rentals.schema";
import { listings } from "../schemas/listings.schema";
import { user } from "../schemas/user.schema";

// Infer types
type NewRequest = InferInsertModel<typeof rentalRequests>;
type NewRental = InferInsertModel<typeof rentals>;
type NewReview = InferInsertModel<typeof reviews>;

// Rental status distribution for realistic data
const statusDistribution = [
  { status: "pending", weight: 15 },
  { status: "approved", weight: 20 },
  { status: "active", weight: 15 },
  { status: "completed", weight: 30 },
  { status: "cancelled", weight: 8 },
  { status: "overdue", weight: 7 },
  { status: "denied", weight: 5 },
] as const;

// Helper function to get weighted random status
function getRandomStatus() {
  const totalWeight = statusDistribution.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  const random = faker.number.int({ min: 1, max: totalWeight });

  let currentWeight = 0;
  for (const item of statusDistribution) {
    currentWeight += item.weight;
    if (random <= currentWeight) {
      return item.status;
    }
  }
  return "pending";
}

// Helper function to generate realistic dates based on status
function generateDatesForStatus(status: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let approvedAt: Date | null = null;
  let deniedAt: Date | null = null;
  let actualStartDate: Date | null = null;
  let actualEndDate: Date | null = null;

  // Generate base dates first
  const createdAt = faker.date.recent({ days: 60 });
  const daysFromNow = faker.number.int({ min: 1, max: 14 });
  const rentalDuration = faker.number.int({ min: 1, max: 7 });

  switch (status) {
    case "pending":
      // Recent requests waiting for approval
      startDate = faker.date.soon({ days: daysFromNow });
      endDate = new Date(
        startDate.getTime() + rentalDuration * 24 * 60 * 60 * 1000,
      );
      break;

    case "approved":
      // Approved but not started yet
      approvedAt = faker.date.between({ from: createdAt, to: now });
      startDate = faker.date.soon({ days: daysFromNow });
      endDate = new Date(
        startDate.getTime() + rentalDuration * 24 * 60 * 60 * 1000,
      );
      break;

    case "active":
      // Currently ongoing rentals
      approvedAt = faker.date.between({ from: createdAt, to: now });
      startDate = faker.date.recent({ days: 7 });
      endDate = faker.date.soon({ days: rentalDuration });
      actualStartDate = startDate;
      break;

    case "completed":
      // Finished rentals
      approvedAt = faker.date.between({ from: createdAt, to: now });
      startDate = faker.date.recent({ days: 30 });
      endDate = new Date(
        startDate.getTime() + rentalDuration * 24 * 60 * 60 * 1000,
      );
      actualStartDate = startDate;
      actualEndDate = new Date(
        endDate.getTime() +
          faker.number.int({ min: 0, max: 2 }) * 24 * 60 * 60 * 1000,
      );
      break;

    case "overdue":
      // Past due rentals
      approvedAt = faker.date.between({ from: createdAt, to: now });
      startDate = faker.date.recent({ days: 21 });
      endDate = faker.date.recent({
        days: faker.number.int({ min: 1, max: 7 }),
      });
      actualStartDate = startDate;
      break;

    case "cancelled":
      // Cancelled before or during rental
      if (faker.datatype.boolean()) {
        // Cancelled before approval
        startDate = faker.date.soon({ days: daysFromNow });
        endDate = new Date(
          startDate.getTime() + rentalDuration * 24 * 60 * 60 * 1000,
        );
      } else {
        // Cancelled after approval
        approvedAt = faker.date.between({ from: createdAt, to: now });
        startDate = faker.date.soon({ days: daysFromNow });
        endDate = new Date(
          startDate.getTime() + rentalDuration * 24 * 60 * 60 * 1000,
        );
      }
      break;

    case "denied":
      // Denied requests
      deniedAt = faker.date.between({ from: createdAt, to: now });
      startDate = faker.date.soon({ days: daysFromNow });
      endDate = new Date(
        startDate.getTime() + rentalDuration * 24 * 60 * 60 * 1000,
      );
      break;

    default:
      throw new Error(`Unknown status: ${status}`);
  }

  return {
    createdAt,
    startDate,
    endDate,
    approvedAt,
    deniedAt,
    actualStartDate,
    actualEndDate,
  };
}

async function main() {
  console.log("🌱 Seeding comprehensive rentals data...");

  // Clear existing data
  await db.delete(reviews);
  await db.delete(rentals);
  await db.delete(rentalRequests);

  const allUsers = await db.select().from(user);
  const allListings = await db.select().from(listings);

  if (allUsers.length < 2 || allListings.length === 0) {
    throw new Error(
      "Not enough users or listings. Seed users and listings first.",
    );
  }

  const seedRequests: NewRequest[] = [];
  const seedRentals: NewRental[] = [];
  const seedReviews: NewReview[] = [];

  console.log("📝 Generating rental requests...");

  // Generate 750 rental requests with realistic distribution
  for (let i = 0; i < 750; i++) {
    const listing = faker.helpers.arrayElement(allListings);
    const owner = allUsers.find((u) => u.id === listing.ownerId)!;
    const renter = faker.helpers.arrayElement(
      allUsers.filter((u) => u.id !== owner.id),
    );

    const status = getRandomStatus();
    const dates = generateDatesForStatus(status);

    const totalDays = Math.ceil(
      (dates.endDate.getTime() - dates.startDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const dailyRate = parseFloat(listing.dailyRate);
    const deliveryRequested = faker.datatype.boolean({ probability: 0.3 });
    const deliveryFee = deliveryRequested
      ? faker.number.float({ min: 10, max: 50, multipleOf: 5 })
      : 0;
    const totalAmount = (dailyRate * totalDays + deliveryFee).toFixed(2);

    const requestId = faker.string.uuid();
    const request: NewRequest = {
      id: requestId,
      listingId: listing.id,
      renterId: renter.id,
      ownerId: owner.id,
      startDate: dates.startDate,
      endDate: dates.endDate,
      totalDays,
      dailyRate: dailyRate.toString(),
      totalAmount,
      securityDeposit: listing.securityDeposit,
      deliveryRequested,
      deliveryAddress: deliveryRequested
        ? faker.location.streetAddress()
        : null,
      deliveryFee: deliveryFee.toString(),
      message: faker.helpers.maybe(() => faker.lorem.sentences(2), {
        probability: 0.6,
      }),
      status,
      approvedAt: dates.approvedAt,
      deniedAt: dates.deniedAt,
      denialReason:
        status === "denied"
          ? faker.helpers.arrayElement([
              "Tool not available for those dates",
              "Renter profile incomplete",
              "Security deposit insufficient",
              "Delivery not possible to that location",
              "Tool requires special certification",
            ])
          : null,
      createdAt: dates.createdAt,
      updatedAt: new Date(),
    };

    seedRequests.push(request);

    // Create actual rental records for statuses that need them
    if (["approved", "active", "completed", "overdue"].includes(status)) {
      const rentalId = faker.string.uuid();
      const rental: NewRental = {
        id: rentalId,
        requestId: requestId,
        listingId: listing.id,
        renterId: renter.id,
        ownerId: owner.id,
        startDate: dates.startDate,
        endDate: dates.endDate,
        actualStartDate: dates.actualStartDate,
        actualEndDate: dates.actualEndDate,
        totalAmount,
        securityDeposit: listing.securityDeposit,
        status,
        pickupInstructions: faker.helpers.maybe(
          () => faker.lorem.sentences(2),
          { probability: 0.8 },
        ),
        returnInstructions: faker.helpers.maybe(
          () => faker.lorem.sentences(2),
          { probability: 0.8 },
        ),
        conditionAtPickup: dates.actualStartDate
          ? faker.helpers.arrayElement(["excellent", "good", "fair"])
          : null,
        conditionAtReturn: dates.actualEndDate
          ? faker.helpers.arrayElement(["excellent", "good", "fair", "damaged"])
          : null,
        damageReported: faker.datatype.boolean({ probability: 0.1 }),
        damageDescription: faker.helpers.maybe(() => faker.lorem.sentence(), {
          probability: 0.1,
        }),
        damagePhotos:
          faker.helpers.maybe(
            () => [
              faker.helpers.arrayElement([
                "/images/damage/scratch1.jpg",
                "/images/damage/dent1.jpg",
                "/images/damage/wear1.jpg",
              ]),
            ],
            { probability: 0.05 },
          ) || [],
        extensionRequested: faker.datatype.boolean({ probability: 0.15 }),
        extensionApproved: faker.datatype.boolean({ probability: 0.7 }),
        createdAt: dates.approvedAt || dates.createdAt,
        updatedAt: new Date(),
      };

      seedRentals.push(rental);
    }
  }

  console.log("🏁 Generating reviews for completed rentals...");

  // Generate reviews only for completed rentals (realistic approach)
  const completedRentals = seedRentals.filter((r) => r.status === "completed");

  for (const rental of completedRentals) {
    // 80% chance of getting a review from renter
    if (faker.datatype.boolean({ probability: 0.8 })) {
      seedReviews.push({
        id: faker.string.uuid(),
        rentalId: rental.id!,
        reviewerId: rental.renterId,
        revieweeId: rental.ownerId,
        listingId: rental.listingId,
        rating: faker.number.int({ min: 3, max: 5 }),
        title: faker.helpers.arrayElement([
          "Great tool, worked perfectly!",
          "Excellent condition and performance",
          "Very satisfied with this rental",
          "Tool was exactly as described",
          "Would rent again",
          "Perfect for my project",
          "High quality tool",
        ]),
        comment: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
        isOwnerReview: false,
        isPublic: true,
        helpfulCount: faker.number.int({ min: 0, max: 15 }),
        createdAt: new Date(
          rental.actualEndDate!.getTime() +
            faker.number.int({ min: 1, max: 7 }) * 24 * 60 * 60 * 1000,
        ),
        updatedAt: new Date(),
      });
    }

    // 60% chance of getting a review from owner
    if (faker.datatype.boolean({ probability: 0.6 })) {
      seedReviews.push({
        id: faker.string.uuid(),
        rentalId: rental.id!,
        reviewerId: rental.ownerId,
        revieweeId: rental.renterId,
        listingId: rental.listingId,
        rating: faker.number.int({ min: 4, max: 5 }),
        title: faker.helpers.arrayElement([
          "Responsible renter",
          "Tool returned in great condition",
          "Easy communication and pickup",
          "Would rent to again",
          "Trustworthy and respectful",
          "Followed all instructions perfectly",
          "Professional and courteous",
        ]),
        comment: faker.lorem.sentences(faker.number.int({ min: 1, max: 2 })),
        isOwnerReview: true,
        isPublic: true,
        helpfulCount: faker.number.int({ min: 0, max: 8 }),
        createdAt: new Date(
          rental.actualEndDate!.getTime() +
            faker.number.int({ min: 1, max: 5 }) * 24 * 60 * 60 * 1000,
        ),
        updatedAt: new Date(),
      });
    }
  }

  console.log("💾 Inserting data into database...");

  // Insert all data
  await db.insert(rentalRequests).values(seedRequests);
  console.log(`📝 Created ${seedRequests.length} rental requests`);

  if (seedRentals.length > 0) {
    await db.insert(rentals).values(seedRentals);
    console.log(`🏠 Created ${seedRentals.length} actual rentals`);
  }

  if (seedReviews.length > 0) {
    await db.insert(reviews).values(seedReviews);
    console.log(`⭐ Created ${seedReviews.length} reviews`);
  }

  // Print status distribution
  const statusCounts = seedRequests.reduce(
    (acc, req) => {
      const status = req.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log("\n📊 Rental Status Distribution:");
  Object.entries(statusCounts).forEach(([status, count]) => {
    const percentage = ((count / seedRequests.length) * 100).toFixed(1);
    console.log(`   ${status}: ${count} (${percentage}%)`);
  });

  console.log("\n✅ Comprehensive rentals seed completed successfully!");
  console.log(
    `🎯 Generated realistic rental workflow data with proper status transitions`,
  );
}

main().catch((err) => {
  console.error("❌ Error seeding rentals:", err);
  process.exit(1);
});
