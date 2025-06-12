import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import { rentalRequests, rentals, reviews } from "../schemas/rentals";
import { tools } from "../schemas/tools";
import { users } from "../schemas/users";

// Infer types

type NewRequest = InferInsertModel<typeof rentalRequests>;
type NewRental = InferInsertModel<typeof rentals>;
type NewReview = InferInsertModel<typeof reviews>;

async function main() {
  console.log("🌱 Seeding rentals...");

  await db.delete(reviews);
  await db.delete(rentals);
  await db.delete(rentalRequests);

  const allUsers = await db.select().from(users);
  const allTools = await db.select().from(tools);

  if (allUsers.length < 2 || allTools.length === 0) {
    throw new Error("Not enough users or tools. Seed users and tools first.");
  }

  const seedRequests: NewRequest[] = [];
  const seedRentals: NewRental[] = [];
  const seedReviews: NewReview[] = [];

  for (let i = 0; i < 30; i++) {
    const tool = faker.helpers.arrayElement(allTools);
    const owner = allUsers.find((u) => u.id === tool.ownerId)!;
    const renter = faker.helpers.arrayElement(
      allUsers.filter((u) => u.id !== owner.id),
    );

    const start = faker.date.recent({ days: 30 });
    const end = faker.date.soon({
      days: faker.number.int({ min: 1, max: 7 }),
      refDate: start,
    });
    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const dailyRate = parseFloat(tool.dailyRate);
    const totalAmount = (dailyRate * totalDays).toFixed(2);
    const status = faker.helpers.arrayElement([
      "pending",
      "approved",
      "active",
      "completed",
      "cancelled",
      "overdue",
      "rejected",
    ]);

    const requestId = faker.string.uuid();

    const request: NewRequest = {
      id: requestId,
      toolId: tool.id,
      renterId: renter.id,
      ownerId: owner.id,
      startDate: start,
      endDate: end,
      totalDays,
      dailyRate: dailyRate.toString(),
      totalAmount,
      securityDeposit: tool.securityDeposit,
      deliveryRequested: faker.datatype.boolean(),
      deliveryAddress: faker.location.streetAddress(),
      deliveryFee: tool.deliveryFee,
      message: faker.lorem.sentence(),
      status,
      approvedAt: status === "approved" ? faker.date.recent() : null,
      rejectedAt: status === "rejected" ? faker.date.recent() : null,
      rejectionReason: status === "rejected" ? faker.lorem.sentence() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    seedRequests.push(request);

    // Add rental if approved
    if (status === "approved") {
      const rentalId = faker.string.uuid();
      const rental: NewRental = {
        id: rentalId,
        requestId: request.id || requestId,
        toolId: tool.id,
        renterId: renter.id,
        ownerId: owner.id,
        startDate: start,
        endDate: end,
        actualStartDate: start,
        actualEndDate: end,
        totalAmount,
        securityDeposit: tool.securityDeposit,
        status: "approved",
        pickupInstructions: faker.lorem.sentence(),
        returnInstructions: faker.lorem.sentence(),
        conditionAtPickup: "good",
        conditionAtReturn: faker.helpers.arrayElement(["good", "damaged"]),
        damageReported: faker.datatype.boolean(),
        damageDescription: faker.lorem.sentence(),
        damagePhotos: [],
        extensionRequested: faker.datatype.boolean(),
        extensionApproved: faker.datatype.boolean(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      seedRentals.push(rental);

      // Add 1–2 reviews for this rental
      const hasOwnerReview = faker.datatype.boolean();
      const hasRenterReview = faker.datatype.boolean();

      if (hasOwnerReview) {
        seedReviews.push({
          id: faker.string.uuid(),
          rentalId: rental.id || rentalId,
          reviewerId: owner.id,
          revieweeId: renter.id,
          toolId: tool.id,
          rating: faker.number.int({ min: 3, max: 5 }),
          title: faker.word.adjective() + " experience",
          comment: faker.lorem.sentences(2),
          isOwnerReview: true,
          isPublic: true,
          helpfulCount: faker.number.int({ min: 0, max: 10 }),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (hasRenterReview) {
        seedReviews.push({
          id: faker.string.uuid(),
          rentalId: rental.id || rentalId,
          reviewerId: renter.id,
          revieweeId: owner.id,
          toolId: tool.id,
          rating: faker.number.int({ min: 3, max: 5 }),
          title: faker.word.adjective() + " service",
          comment: faker.lorem.sentences(2),
          isOwnerReview: false,
          isPublic: true,
          helpfulCount: faker.number.int({ min: 0, max: 10 }),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  await db.insert(rentalRequests).values(seedRequests);
  await db.insert(rentals).values(seedRentals);
  await db.insert(reviews).values(seedReviews);

  console.log("✅ Rentals and reviews seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding rentals:", err);
  process.exit(1);
});
