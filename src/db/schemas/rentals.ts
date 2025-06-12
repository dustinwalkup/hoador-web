import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  index,
  boolean,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

import { users } from "./users";
import { tools } from "./tools";
import { rentalStatusEnum } from "./_enums";

// Rental requests
export const rentalRequests = pgTable(
  "rental_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolId: uuid("tool_id")
      .references(() => tools.id, { onDelete: "cascade" })
      .notNull(),
    renterId: uuid("renter_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    totalDays: integer("total_days").notNull(),
    dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    deliveryRequested: boolean("delivery_requested").default(false).notNull(),
    deliveryAddress: text("delivery_address"),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    message: text("message"),
    status: rentalStatusEnum("status").default("pending").notNull(),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    toolIdIdx: index("rental_requests_tool_id_idx").on(table.toolId),
    renterIdIdx: index("rental_requests_renter_id_idx").on(table.renterId),
    ownerIdIdx: index("rental_requests_owner_id_idx").on(table.ownerId),
    statusIdx: index("rental_requests_status_idx").on(table.status),
    dateRangeIdx: index("rental_requests_date_range_idx").on(
      table.startDate,
      table.endDate,
    ),
  }),
);

// Rentals (approved rental requests)
export const rentals = pgTable(
  "rentals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .references(() => rentalRequests.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    toolId: uuid("tool_id")
      .references(() => tools.id, { onDelete: "cascade" })
      .notNull(),
    renterId: uuid("renter_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    actualStartDate: timestamp("actual_start_date"),
    actualEndDate: timestamp("actual_end_date"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    status: rentalStatusEnum("status").default("approved").notNull(),
    pickupInstructions: text("pickup_instructions"),
    returnInstructions: text("return_instructions"),
    conditionAtPickup: text("condition_at_pickup"),
    conditionAtReturn: text("condition_at_return"),
    damageReported: boolean("damage_reported").default(false).notNull(),
    damageDescription: text("damage_description"),
    damagePhotos: jsonb("damage_photos")
      .$type<string[]>()
      .default([])
      .notNull(),
    extensionRequested: boolean("extension_requested").default(false).notNull(),
    extensionApproved: boolean("extension_approved").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    requestIdIdx: uniqueIndex("rentals_request_id_idx").on(table.requestId),
    toolIdIdx: index("rentals_tool_id_idx").on(table.toolId),
    renterIdIdx: index("rentals_renter_id_idx").on(table.renterId),
    ownerIdIdx: index("rentals_owner_id_idx").on(table.ownerId),
    statusIdx: index("rentals_status_idx").on(table.status),
    dateRangeIdx: index("rentals_date_range_idx").on(
      table.startDate,
      table.endDate,
    ),
  }),
);

// Reviews
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rentalId: uuid("rental_id")
      .references(() => rentals.id, { onDelete: "cascade" })
      .notNull(),
    reviewerId: uuid("reviewer_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    revieweeId: uuid("reviewee_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    toolId: uuid("tool_id")
      .references(() => tools.id, { onDelete: "cascade" })
      .notNull(),
    rating: integer("rating").notNull(), // 1-5
    title: varchar("title", { length: 255 }),
    comment: text("comment"),
    isOwnerReview: boolean("is_owner_review").notNull(), // true if owner reviewing renter, false if renter reviewing owner
    isPublic: boolean("is_public").default(true).notNull(),
    helpfulCount: integer("helpful_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    rentalIdIdx: index("reviews_rental_id_idx").on(table.rentalId),
    reviewerIdIdx: index("reviews_reviewer_id_idx").on(table.reviewerId),
    revieweeIdIdx: index("reviews_reviewee_id_idx").on(table.revieweeId),
    toolIdIdx: index("reviews_tool_id_idx").on(table.toolId),
    ratingIdx: index("reviews_rating_idx").on(table.rating),
  }),
);
