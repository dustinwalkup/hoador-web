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

import { userStatusEnum, userTypeEnum } from "./_enums";
import { listings } from "./listings.schema";
import { rentalRequests, rentals, reviews } from "./rentals.schema";
import { payments } from "./payments.schema";
import { userCollections, userFavorites } from "./collections.schema";
import { messages } from "./messages.schema";
import { notifications } from "./notifications.schema";

export type UserDB = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type UpdateUser = Partial<NewUser>;

// BetterAuth user table, extended with profile fields
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),

  // ---- Custom profile fields ----
  firstName: varchar("first_name", { length: 100 }), // Nullable for Better Auth compatibility
  lastName: varchar("last_name", { length: 100 }), // Nullable for Better Auth compatibility
  status: userStatusEnum("status").default("pending_verification").notNull(),
  userType: userTypeEnum("user_type").default("standard").notNull(),
  phone: varchar("phone", { length: 20 }),
  bio: text("bio"),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeConnectedAccountId: varchar("stripe_connected_account_id", {
    length: 255,
  }),
  connectOnboardingComplete: boolean("connect_onboarding_complete")
    .default(false)
    .notNull(),
  connectChargesEnabled: boolean("connect_charges_enabled")
    .default(false)
    .notNull(),
  connectPayoutsEnabled: boolean("connect_payouts_enabled")
    .default(false)
    .notNull(),
  idVerified: boolean("id_verified").default(false).notNull(),
  addressVerified: boolean("address_verified").default(false).notNull(),
  lastLoginAt: timestamp("last_login_at"),

  // ---- Timestamps ----
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// BetterAuth session table
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// BetterAuth account table
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

// BetterAuth verification table
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// User addresses
export const userAddresses = pgTable(
  "user_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
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
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  smsNotifications: boolean("sms_notifications").default(true).notNull(),
  pushNotifications: boolean("push_notifications").default(true).notNull(),
  marketingEmails: boolean("marketing_emails").default(false).notNull(),
  lendingRadius: integer("lending_radius").default(5).notNull(),
  autoApproveRequests: boolean("auto_approve_requests")
    .default(false)
    .notNull(),
  weekendAvailability: boolean("weekend_availability").default(true).notNull(),
  defaultRentalPeriod: integer("default_rental_period").default(3).notNull(),
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
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    stripePaymentMethodId: varchar("stripe_payment_method_id", {
      length: 255,
    }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    last4: varchar("last4", { length: 4 }),
    brand: varchar("brand", { length: 50 }),
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

// ---- Relations ----
export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [userPreferences.userId],
      references: [user.id],
    }),
  }),
);

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(user, {
    fields: [userAddresses.userId],
    references: [user.id],
  }),
}));

export const userPaymentMethodsRelations = relations(
  userPaymentMethods,
  ({ one }) => ({
    user: one(user, {
      fields: [userPaymentMethods.userId],
      references: [user.id],
    }),
  }),
);

// ---- User relations to your domain entities ----
export const userRelations = relations(user, ({ one, many }) => ({
  preferences: one(userPreferences),
  addresses: many(userAddresses),
  ownedListings: many(listings),
  rentalRequests: many(rentalRequests, { relationName: "renterRequests" }),
  ownedRentalRequests: many(rentalRequests, { relationName: "ownerRequests" }),
  rentals: many(rentals, { relationName: "renterRentals" }),
  ownedRentals: many(rentals, { relationName: "ownerRentals" }),
  reviewsGiven: many(reviews, { relationName: "reviewsGiven" }),
  reviewsReceived: many(reviews, { relationName: "reviewsReceived" }),
  payments: many(payments, { relationName: "payerPayments" }),
  receivedPayments: many(payments, { relationName: "payeePayments" }),
  paymentMethods: many(userPaymentMethods),
  favorites: many(userFavorites),
  collections: many(userCollections),
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
  notifications: many(notifications),
}));
