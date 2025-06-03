import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  uuid,
  index,
  pgEnum,
  decimal,
  integer,
} from "drizzle-orm/pg-core";

// Enums
export const userTypeEnum = pgEnum("user_type", ["user", "admin", "support"]);
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
  "pending_verification",
]);

// ─────────────────────────────────────────────────────────────
// Users Table
// ─────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
    type: userTypeEnum("type").default("user").notNull(),

    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    bio: text("bio"),

    stripeAccountId: varchar("stripe_account_id", { length: 255 }),

    isIdentityVerified: boolean("is_identity_verified")
      .default(false)
      .notNull(),

    lastActiveAt: timestamp("last_active_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    clerkUserIdIdx: index("users_clerk_user_id_idx").on(table.clerkUserId),
  }),
);

// ─────────────────────────────────────────────────────────────
// User Addresses (defined before users to avoid circular ref)
// ─────────────────────────────────────────────────────────────
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
    isDefault: boolean("is_default").default(false).notNull(),
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

// ─────────────────────────────────────────────────────────────
// User Preferences
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────
export const schema = {
  users,
  userAddresses,
  userPreferences,
};
