import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { userStatusEnum } from "./_enums";
import { tools } from "./tools.schema";
import { rentalRequests, rentals, reviews } from "./rentals.schema";
import { payments } from "./payments.schema";
import { userCollections, userFavorites } from "./collections.schema";
import { messages } from "./messages.schema";
import { notifications } from "./notifications.schema";
import { userSessions } from "./sessions.schema";

export type UserDB = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = Partial<NewUser>;

// Users table - Updated for better-auth compatibility
export const users = pgTable(
  "users",
  {
    // Changed to text to match better-auth schema
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    // Better-auth expects 'name' field for the full name
    name: text("name").notNull(),
    // Keep individual name fields for your app's needs - now nullable for Google OAuth compatibility
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    // Better-auth expects 'emailVerified' boolean and 'image' text
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"), // This replaces profileImageUrl for better-auth compatibility
    // Keep your existing fields
    phone: varchar("phone", { length: 20 }),
    bio: text("bio"),
    status: userStatusEnum("status").default("pending_verification").notNull(),
    phoneVerified: boolean("phone_verified").default(false).notNull(),
    idVerified: boolean("id_verified").default(false).notNull(),
    addressVerified: boolean("address_verified").default(false).notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    twoFactorSecret: varchar("two_factor_secret", { length: 32 }),
    lastLoginAt: timestamp("last_login_at"),
    // Better-auth expects createdAt and updatedAt
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    phoneIdx: index("users_phone_idx").on(table.phone),
    statusIdx: index("users_status_idx").on(table.status),
  }),
);

// Better-auth required tables
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User addresses
export const userAddresses = pgTable(
  "user_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Updated to reference text id
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    street: varchar("street", { length: 255 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 50 }).notNull(),
    zipCode: varchar("zip_code", { length: 10 }).notNull(),
    country: varchar("country", { length: 50 }).default("US").notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_addresses_user_id_idx").on(table.userId),
    locationIdx: index("user_addresses_location_idx").on(
      table.latitude,
      table.longitude,
    ),
  }),
);

// User preferences
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Updated to reference text id
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  smsNotifications: boolean("sms_notifications").default(true).notNull(),
  pushNotifications: boolean("push_notifications").default(true).notNull(),
  marketingEmails: boolean("marketing_emails").default(false).notNull(),
  lendingRadius: integer("lending_radius").default(5).notNull(), // in miles
  autoApproveRequests: boolean("auto_approve_requests")
    .default(false)
    .notNull(),
  weekendAvailability: boolean("weekend_availability").default(true).notNull(),
  defaultRentalPeriod: integer("default_rental_period").default(3).notNull(), // in days
  publicProfile: boolean("public_profile").default(true).notNull(),
  showLocation: boolean("show_location").default(true).notNull(),
  showActivityStatus: boolean("show_activity_status").default(false).notNull(),
  analyticsTracking: boolean("analytics_tracking").default(true).notNull(),
  language: varchar("language", { length: 10 }).default("en").notNull(),
  timezone: varchar("timezone", { length: 50 })
    .default("America/Chicago")
    .notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User payment methods
export const userPaymentMethods = pgTable(
  "user_payment_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Updated to reference text id
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    stripePaymentMethodId: varchar("stripe_payment_method_id", {
      length: 255,
    }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // card, bank_account
    last4: varchar("last4", { length: 4 }),
    brand: varchar("brand", { length: 50 }), // visa, mastercard, etc.
    expiryMonth: integer("expiry_month"),
    expiryYear: integer("expiry_year"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_payment_methods_user_id_idx").on(table.userId),
    stripePaymentMethodIdx: uniqueIndex("user_payment_methods_stripe_idx").on(
      table.stripePaymentMethodId,
    ),
  }),
);

// Relations for better-auth tables
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(users, {
    fields: [session.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(users, {
    fields: [account.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, {
    fields: [userAddresses.userId],
    references: [users.id],
  }),
}));

export const userPaymentMethodsRelations = relations(
  userPaymentMethods,
  ({ one }) => ({
    user: one(users, {
      fields: [userPaymentMethods.userId],
      references: [users.id],
    }),
  }),
);

// Updated users relations to include better-auth tables
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences),
  addresses: many(userAddresses),
  ownedTools: many(tools),
  // Better-auth relations
  sessions: many(session),
  accounts: many(account),

  // Rental requests - need relation names to match what we defined earlier
  rentalRequests: many(rentalRequests, {
    relationName: "renterRequests", // This user as renter
  }),
  ownedRentalRequests: many(rentalRequests, {
    relationName: "ownerRequests", // This user as owner
  }),

  // Rentals - need relation names to match what we defined earlier
  rentals: many(rentals, {
    relationName: "renterRentals", // This user as renter
  }),
  ownedRentals: many(rentals, {
    relationName: "ownerRentals", // This user as owner
  }),

  // Reviews - need relation names to match what we defined earlier
  reviewsGiven: many(reviews, {
    relationName: "reviewsGiven", // Reviews this user gave
  }),
  reviewsReceived: many(reviews, {
    relationName: "reviewsReceived", // Reviews this user received
  }),

  // Payments - likely also need relation names if you have multiple payment relations
  payments: many(payments, {
    relationName: "payerPayments", // This user as payer
  }),
  receivedPayments: many(payments, {
    relationName: "payeePayments", // This user as payee
  }),

  paymentMethods: many(userPaymentMethods),
  favorites: many(userFavorites),
  collections: many(userCollections),

  // Messages - likely also need relation names if you have sender/receiver
  sentMessages: many(messages, {
    relationName: "sentMessages", // This user as sender
  }),
  receivedMessages: many(messages, {
    relationName: "receivedMessages", // This user as receiver
  }),

  notifications: many(notifications),
  // Keep the original userSessions for now, but you might want to migrate to better-auth sessions
  userSessions: many(userSessions),
}));
