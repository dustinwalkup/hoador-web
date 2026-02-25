import { faker } from "@faker-js/faker";
import { hashPassword } from "better-auth/crypto";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db-seed";
import {
  user,
  userAddresses,
  userPreferences,
  userPaymentMethods,
  account,
} from "../schemas/user.schema";

type NewUser = typeof user.$inferInsert;
type NewAddress = InferInsertModel<typeof userAddresses>;
type NewPreference = InferInsertModel<typeof userPreferences>;
type NewPaymentMethod = InferInsertModel<typeof userPaymentMethods>;
type NewAccount = InferInsertModel<typeof account>;

const SEED_PASSWORD = "Test@123";

async function main(): Promise<void> {
  console.log("🌱 Seeding user-related tables...");

  const hashedPassword = await hashPassword(SEED_PASSWORD);

  const seedUsers: NewUser[] = [];
  const seedAddresses: NewAddress[] = [];
  const seedPreferences: NewPreference[] = [];
  const seedPaymentMethods: NewPaymentMethod[] = [];
  const seedAccounts: NewAccount[] = [];

  const now = new Date();

  // 1. Admin user (known credentials)
  const adminId = faker.string.uuid();
  seedUsers.push({
    id: adminId,
    name: "Admin User",
    email: "admin@hoador.com",
    emailVerified: true,
    image: null,
    firstName: "Admin",
    lastName: "User",
    status: "active",
    userType: "admin",
    phone: faker.phone.number({ style: "national" }),
    bio: "Seed admin for dev",
    profileImageUrl: null,
    idVerified: true,
    addressVerified: true,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  });
  seedAddresses.push({
    id: faker.string.uuid(),
    userId: adminId,
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode("#####"),
    country: "US",
    latitude: String(faker.location.latitude()),
    longitude: String(faker.location.longitude()),
    isPrimary: true,
    createdAt: now,
    updatedAt: now,
  });
  seedPreferences.push({
    id: faker.string.uuid(),
    userId: adminId,
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
    createdAt: now,
    updatedAt: now,
  });
  seedPaymentMethods.push({
    id: faker.string.uuid(),
    userId: adminId,
    stripePaymentMethodId: `pm_seed_admin_${faker.string.alphanumeric(14)}`,
    type: "card",
    last4: "4242",
    brand: "visa",
    expiryMonth: 12,
    expiryYear: 2030,
    isPrimary: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  seedAccounts.push({
    id: faker.string.uuid(),
    accountId: adminId,
    providerId: "credential",
    userId: adminId,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });

  // 2. Regular user (known credentials)
  const userId = faker.string.uuid();
  seedUsers.push({
    id: userId,
    name: "Test User",
    email: "user@hoador.com",
    emailVerified: true,
    image: null,
    firstName: "Test",
    lastName: "User",
    status: "active",
    userType: "standard",
    phone: faker.phone.number({ style: "national" }),
    bio: faker.lorem.sentence(),
    profileImageUrl: null,
    idVerified: false,
    addressVerified: false,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  });
  seedAddresses.push({
    id: faker.string.uuid(),
    userId,
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode("#####"),
    country: "US",
    latitude: String(faker.location.latitude()),
    longitude: String(faker.location.longitude()),
    isPrimary: true,
    createdAt: now,
    updatedAt: now,
  });
  seedPreferences.push({
    id: faker.string.uuid(),
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
    createdAt: now,
    updatedAt: now,
  });
  seedPaymentMethods.push({
    id: faker.string.uuid(),
    userId,
    stripePaymentMethodId: `pm_seed_user_${faker.string.alphanumeric(14)}`,
    type: "card",
    last4: "5555",
    brand: "mastercard",
    expiryMonth: 6,
    expiryYear: 2028,
    isPrimary: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  seedAccounts.push({
    id: faker.string.uuid(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });

  // 3. Three additional random users (no credential account for login)
  for (let i = 0; i < 3; i++) {
    const id = faker.string.uuid();
    seedUsers.push({
      id,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: faker.datatype.boolean(),
      image: faker.image.avatar(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      status: "active",
      userType: "standard",
      phone: faker.phone.number({ style: "national" }),
      bio: faker.lorem.sentences(2),
      profileImageUrl: faker.image.avatar(),
      idVerified: faker.datatype.boolean(),
      addressVerified: faker.datatype.boolean(),
      lastLoginAt: faker.date.recent(),
      createdAt: now,
      updatedAt: now,
    });
    seedAddresses.push({
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
      createdAt: now,
      updatedAt: now,
    });
    seedPreferences.push({
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
      createdAt: now,
      updatedAt: now,
    });
    seedPaymentMethods.push({
      id: faker.string.uuid(),
      userId: id,
      stripePaymentMethodId: `pm_seed_${i}_${faker.string.alphanumeric(14)}`,
      type: "card",
      last4: faker.finance.creditCardNumber().slice(-4),
      brand: faker.helpers.arrayElement(["visa", "mastercard"]),
      expiryMonth: faker.number.int({ min: 1, max: 12 }),
      expiryYear: faker.number.int({ min: 2025, max: 2032 }),
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.insert(user).values(seedUsers);
  await db.insert(userAddresses).values(seedAddresses);
  await db.insert(userPreferences).values(seedPreferences);
  await db.insert(userPaymentMethods).values(seedPaymentMethods);
  await db.insert(account).values(seedAccounts);

  console.log("✅ User seed complete");
  console.log(
    "   Log in: admin@hoador.com / user@hoador.com with password: " +
      SEED_PASSWORD,
  );
}

export { main };
