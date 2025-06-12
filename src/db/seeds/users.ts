import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import {
  users,
  userAddresses,
  userPreferences,
  userPaymentMethods,
} from "../schemas/users";

// Infer types

type NewUser = InferInsertModel<typeof users>;
type NewAddress = InferInsertModel<typeof userAddresses>;
type NewPreference = InferInsertModel<typeof userPreferences>;
type NewPaymentMethod = InferInsertModel<typeof userPaymentMethods>;

async function main() {
  console.log("🌱 Seeding users-related tables...");

  // Clear existing data
  await db.delete(userPaymentMethods);
  await db.delete(userPreferences);
  await db.delete(userAddresses);
  await db.delete(users);

  const seedUsers: NewUser[] = [];
  const seedAddresses: NewAddress[] = [];
  const seedPreferences: NewPreference[] = [];
  const seedPaymentMethods: NewPaymentMethod[] = [];

  for (let i = 0; i < 20; i++) {
    const id = faker.string.uuid();

    const user: NewUser = {
      id,
      email: faker.internet.email(),
      passwordHash: faker.internet.password(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      phone: faker.phone.number({ style: "national" }),
      bio: faker.lorem.sentences(2),
      profileImageUrl: faker.image.avatar(),
      status: "active",
      emailVerified: faker.datatype.boolean(),
      phoneVerified: faker.datatype.boolean(),
      idVerified: faker.datatype.boolean(),
      addressVerified: faker.datatype.boolean(),
      twoFactorEnabled: faker.datatype.boolean(),
      twoFactorSecret: faker.string.alphanumeric(32),
      lastLoginAt: faker.date.recent(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const address: NewAddress = {
      id: faker.string.uuid(),
      userId: id,
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      zipCode: faker.location.zipCode("#####"),
      country: "US",
      latitude: String(faker.location.latitude()),
      longitude: String(faker.location.longitude()),
      isPrimary: i === 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const preferences: NewPreference = {
      id: faker.string.uuid(),
      userId: id,
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
    };

    const paymentMethod: NewPaymentMethod = {
      id: faker.string.uuid(),
      userId: id,
      stripePaymentMethodId: `pm_${faker.string.alphanumeric(14)}`,
      type: "card",
      last4: faker.finance.creditCardNumber().slice(-4),
      brand: faker.finance.creditCardIssuer().toLowerCase(),
      expiryMonth: faker.number.int({ min: 1, max: 12 }),
      expiryYear: faker.number.int({ min: 2025, max: 2032 }),
      isPrimary: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    seedUsers.push(user);
    seedAddresses.push(address);
    seedPreferences.push(preferences);
    seedPaymentMethods.push(paymentMethod);
  }

  await db.insert(users).values(seedUsers);
  await db.insert(userAddresses).values(seedAddresses);
  await db.insert(userPreferences).values(seedPreferences);
  await db.insert(userPaymentMethods).values(seedPaymentMethods);

  console.log("✅ User seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding:", err);
  process.exit(1);
});
