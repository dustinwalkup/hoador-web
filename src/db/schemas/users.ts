import { relations } from "drizzle-orm";
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
import { userStatusEnum } from "./_enums";
import { tools } from "./tools";
import { rentalRequests, rentals, reviews } from "./rentals";
import { payments } from "./payments";
import { collectionItems, userCollections, userFavorites } from "./collections";
import { messages } from "./messages";
import { notifications } from "./notifications";
import { userSessions } from "./sessions";

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    bio: text("bio"),
    profileImageUrl: varchar("profile_image_url", { length: 500 }),
    status: userStatusEnum("status").default("pending_verification").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    phoneVerified: boolean("phone_verified").default(false).notNull(),
    idVerified: boolean("id_verified").default(false).notNull(),
    addressVerified: boolean("address_verified").default(false).notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    twoFactorSecret: varchar("two_factor_secret", { length: 32 }),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    phoneIdx: index("users_phone_idx").on(table.phone),
    statusIdx: index("users_status_idx").on(table.status),
  }),
);

// User addresses
export const userAddresses = pgTable(
  "user_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
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
  userId: uuid("user_id")
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
    userId: uuid("user_id")
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

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userId],
    references: [users.id],
  }),
  tool: one(tools, {
    fields: [userFavorites.toolId],
    references: [tools.id],
  }),
}));

export const userCollectionsRelations = relations(
  userCollections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userCollections.userId],
      references: [users.id],
    }),
    items: many(collectionItems),
  }),
);

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences),
  addresses: many(userAddresses),
  ownedTools: many(tools, { relationName: "owner" }),
  rentalRequests: many(rentalRequests, { relationName: "renter" }),
  ownedRentalRequests: many(rentalRequests, { relationName: "owner" }),
  rentals: many(rentals, { relationName: "renter" }),
  ownedRentals: many(rentals, { relationName: "owner" }),
  reviewsGiven: many(reviews, { relationName: "reviewer" }),
  reviewsReceived: many(reviews, { relationName: "reviewee" }),
  payments: many(payments, { relationName: "payer" }),
  receivedPayments: many(payments, { relationName: "payee" }),
  paymentMethods: many(userPaymentMethods),
  favorites: many(userFavorites),
  collections: many(userCollections),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  notifications: many(notifications),
  sessions: many(userSessions),
}));
