import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import { payments } from "../schemas/payments";
import { rentals } from "../schemas/rentals";
import { users } from "../schemas/users";

// Infer type

type NewPayment = InferInsertModel<typeof payments>;

async function main() {
  console.log("🌱 Seeding payments...");

  await db.delete(payments);

  const allUsers = await db.select().from(users);
  const allRentals = await db.select().from(rentals);

  if (allUsers.length < 2 || allRentals.length === 0) {
    throw new Error(
      "Not enough users or rentals. Seed users and rentals first.",
    );
  }

  const seedPayments: NewPayment[] = [];

  for (const rental of allRentals) {
    const payer = allUsers.find((u) => u.id === rental.renterId)!;
    const payee = allUsers.find((u) => u.id === rental.ownerId)!;

    const amount = parseFloat(rental.totalAmount);
    const platformFee = parseFloat((amount * 0.1).toFixed(2));
    const status = faker.helpers.arrayElement([
      "completed",
      "pending",
      "refunded",
      "failed",
    ]) as "completed" | "pending" | "refunded" | "failed";

    const payment: NewPayment = {
      id: faker.string.uuid(),
      rentalId: rental.id,
      payerId: payer.id,
      payeeId: payee.id,
      amount: amount.toFixed(2),
      platformFee: platformFee.toFixed(2),
      paymentMethodId: `pm_${faker.string.alphanumeric(14)}`,
      stripePaymentIntentId: `pi_${faker.string.alphanumeric(14)}`,
      status,
      paidAt: status === "completed" ? faker.date.recent() : null,
      refundedAt: status === "refunded" ? faker.date.recent() : null,
      refundAmount:
        status === "refunded" ? (amount - platformFee).toFixed(2) : null,
      refundReason: status === "refunded" ? faker.lorem.sentence() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    seedPayments.push(payment);
  }

  await db.insert(payments).values(seedPayments);

  console.log("✅ Payments seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding payments:", err);
  process.exit(1);
});
