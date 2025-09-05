import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users.schema";
import { rentalRequests, rentals, reviews } from "./rentals.schema";
import { collectionItems, userFavorites } from "./collections.schema";
import { communities } from "./communities.schema";
import { relations } from "drizzle-orm";

export const listingConditionEnum = pgEnum("listing_condition", [
  "new",
  "good",
  "fair",
  "poor",
]);
export const listingStatusEnum = pgEnum("listing_status", [
  "available",
  "rented",
  "maintenance",
  "inactive",
]);

// Listing categories
export const _listingCategories = pgTable(
  "listing_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    icon: varchar("icon", { length: 50 }),
    parentId: uuid("parent_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("listing_categories_name_idx").on(table.name),
    parentIdIdx: index("listing_categories_parent_id_idx").on(table.parentId),
  }),
);

export const listingCategories = _listingCategories;

// Listings
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    categoryId: uuid("category_id")
      .references(() => _listingCategories.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    brand: varchar("brand", { length: 100 }),
    model: varchar("model", { length: 100 }),
    condition: varchar("condition", { length: 50 }).notNull(), // excellent, good, fair, poor
    dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
    weeklyRate: decimal("weekly_rate", { precision: 10, scale: 2 }),
    monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }),
    securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    status: listingStatusEnum("status").default("available").notNull(),
    specifications: jsonb("specifications")
      .$type<Record<string, string | number | boolean | string[]>>()
      .default({})
      .notNull(),
    instructions: text("instructions"),
    safetyNotes: text("safety_notes"),
    minimumRentalPeriod: integer("minimum_rental_period").default(1).notNull(), // in days
    maximumRentalPeriod: integer("maximum_rental_period").default(30).notNull(), // in days
    requiresPickup: boolean("requires_pickup").default(true).notNull(),
    deliveryAvailable: boolean("delivery_available").default(false).notNull(),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    deliveryRadius: integer("delivery_radius").default(0).notNull(), // in miles
    isActive: boolean("is_active").default(true).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    favoriteCount: integer("favorite_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdIdx: index("listings_owner_id_idx").on(table.ownerId),
    communityIdIdx: index("listings_community_id_idx").on(table.communityId),
    categoryIdIdx: index("listings_category_id_idx").on(table.categoryId),
    statusIdx: index("listings_status_idx").on(table.status),
    dailyRateIdx: index("listings_daily_rate_idx").on(table.dailyRate),
    nameSearchIdx: index("listings_name_search_idx").on(table.name),
    communityStatusIdx: index("listings_community_status_idx").on(
      table.communityId,
      table.status,
    ),
  }),
);

export const listingImages = pgTable("listing_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id").references(() => listings.id, {
    onDelete: "cascade",
  }),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  blobPathname: varchar("blob_pathname", { length: 255 }).notNull(), // For deletion
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// listing availability
export const listingAvailability = pgTable(
  "listing_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .references(() => listings.id, { onDelete: "cascade" })
      .notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    isBlocked: boolean("is_blocked").default(false).notNull(), // true for blocked dates, false for available
    reason: varchar("reason", { length: 255 }), // maintenance, personal use, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    listingIdIdx: index("listing_availability_listing_id_idx").on(
      table.listingId,
    ),
    dateRangeIdx: index("listing_availability_date_range_idx").on(
      table.startDate,
      table.endDate,
    ),
  }),
);

export const listingCategoriesRelations = relations(
  listingCategories,
  ({ one, many }) => ({
    parent: one(listingCategories, {
      fields: [listingCategories.parentId],
      references: [listingCategories.id],
      relationName: "parentCategory", // Add explicit relation name
    }),
    children: many(listingCategories, {
      relationName: "parentCategory", // Same relation name as the inverse
    }),
    listings: many(listings),
  }),
);

export const listingsRelations = relations(listings, ({ one, many }) => ({
  owner: one(users, {
    fields: [listings.ownerId],
    references: [users.id],
  }),
  community: one(communities, {
    fields: [listings.communityId],
    references: [communities.id],
  }),
  category: one(listingCategories, {
    fields: [listings.categoryId],
    references: [listingCategories.id],
  }),
  availability: many(listingAvailability),
  rentalRequests: many(rentalRequests),
  rentals: many(rentals),
  reviews: many(reviews),
  favorites: many(userFavorites),
  collectionItems: many(collectionItems),
}));

export const listingAvailabilityRelations = relations(
  listingAvailability,
  ({ one }) => ({
    listing: one(listings, {
      fields: [listingAvailability.listingId],
      references: [listings.id],
    }),
  }),
);
