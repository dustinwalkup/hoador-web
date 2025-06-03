import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import { userAddresses, userPreferences, users } from "../schemas/users";

type NewUser = InferInsertModel<typeof users>;
type NewAddress = InferInsertModel<typeof userAddresses>;
type NewPreference = InferInsertModel<typeof userPreferences>;

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data (optional in dev)
  await db.delete(userPreferences);
  await db.delete(userAddresses);
  await db.delete(users);

  const seedUsers: NewUser[] = [];
  const seedAddresses: NewAddress[] = [];
  const seedPreferences: NewPreference[] = [];

  for (let i = 0; i < 20; i++) {
    const id = faker.string.uuid();

    const user: NewUser = {
      id,
      clerkUserId: `user_${i}`,
      type: "user",
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      phone: faker.phone.number({ style: "national" }),
      bio: faker.lorem.sentence(),
      stripeAccountId: `acct_${faker.string.alphanumeric(10)}`,
      isIdentityVerified: faker.datatype.boolean(),
      lastActiveAt: faker.date.recent(),
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
      isDefault: i === 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const preferences = {
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

    seedUsers.push(user);
    seedAddresses.push(address);
    seedPreferences.push(preferences);
  }

  await db.insert(users).values(seedUsers);
  await db.insert(userAddresses).values(seedAddresses);
  await db.insert(userPreferences).values(seedPreferences);

  console.log("✅ Seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding database:", err);
  process.exit(1);
});
