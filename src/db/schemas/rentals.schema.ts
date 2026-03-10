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

import { user } from "./user.schema";
import { listings } from "./listings.schema";
import { rentalStatusEnum, paymentStatusEnum } from "./_enums";
import { relations } from "drizzle-orm";
import { payments } from "./payments.schema";

// Rental requests
export const rentalRequests = pgTable(
  "rental_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .references(() => listings.id, { onDelete: "cascade" })
      .notNull(),
    renterId: text("renter_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: text("owner_id")
      .references(() => user.id, { onDelete: "cascade" })
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
    deliveryInstructions: text("delivery_instructions"),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    setupRequested: boolean("setup_requested").default(false).notNull(),
    setupFee: decimal("setup_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    serviceFee: decimal("service_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    applicationFeeAmount: decimal("application_fee_amount", {
      precision: 10,
      scale: 2,
    })
      .default("0")
      .notNull(),
    ownerPayout: decimal("owner_payout", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    platformNetRevenue: decimal("platform_net_revenue", {
      precision: 10,
      scale: 2,
    })
      .default("0")
      .notNull(),
    message: text("message"),
    paymentIntentId: varchar("payment_intent_id", { length: 255 }), // Stripe payment intent ID for rental charge
    paymentMethodId: varchar("payment_method_id", { length: 255 }), // Stripe payment method ID
    paymentStatus: paymentStatusEnum("payment_status").default("pending"), // Payment processing status
    paymentFailureReason: text("payment_failure_reason"), // Why payment failed
    securityDepositAuthId: varchar("security_deposit_auth_id", { length: 255 }), // Stripe auth ID for security deposit hold
    status: rentalStatusEnum("status").default("pending").notNull(),
    approvedAt: timestamp("approved_at"),
    deniedAt: timestamp("denied_at"),
    denialReason: text("denial_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    listingIdIdx: index("rental_requests_listing_id_idx").on(table.listingId),
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
    listingId: uuid("listing_id")
      .references(() => listings.id, { onDelete: "cascade" })
      .notNull(),
    renterId: text("renter_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: text("owner_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    actualStartDate: timestamp("actual_start_date"),
    actualEndDate: timestamp("actual_end_date"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    setupRequested: boolean("setup_requested").default(false).notNull(),
    setupFee: decimal("setup_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    rentalPaymentIntentId: varchar("rental_payment_intent_id", { length: 255 }), // Stripe payment intent ID for rental charge
    securityDepositAuthId: varchar("security_deposit_auth_id", { length: 255 }), // Stripe auth ID for security deposit hold
    applicationFeeAmount: decimal("application_fee_amount", {
      precision: 10,
      scale: 2,
    }), // Platform fee retained via Stripe (platformFee + serviceFee; set at approval)
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
    listingIdIdx: index("rentals_listing_id_idx").on(table.listingId),
    renterIdIdx: index("rentals_renter_id_idx").on(table.renterId),
    ownerIdIdx: index("rentals_owner_id_idx").on(table.ownerId),
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
    reviewerId: text("reviewer_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    revieweeId: text("reviewee_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    listingId: uuid("listing_id")
      .references(() => listings.id, { onDelete: "cascade" })
      .notNull(),
    rating: integer("rating").notNull(), // 1-5
    title: varchar("title", { length: 255 }),
    comment: text("comment"),
    isOwnerReview: boolean("is_owner_review").notNull(), // true if owner reviewing renter, false if renter reviewing owner
    accuracyRating: integer("accuracy_rating"), // 1-5, optional
    listingConditionRating: integer("listing_condition_rating"), // 1-5, optional
    ownerCommunicationRating: integer("owner_communication_rating"), // 1-5, optional
    isPublic: boolean("is_public").default(true).notNull(),
    helpfulCount: integer("helpful_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    rentalIdIdx: index("reviews_rental_id_idx").on(table.rentalId),
    reviewerIdIdx: index("reviews_reviewer_id_idx").on(table.reviewerId),
    revieweeIdIdx: index("reviews_reviewee_id_idx").on(table.revieweeId),
    listingIdIdx: index("reviews_listing_id_idx").on(table.listingId),
    ratingIdx: index("reviews_rating_idx").on(table.rating),
  }),
);

export const rentalRequestsRelations = relations(rentalRequests, ({ one }) => ({
  listing: one(listings, {
    fields: [rentalRequests.listingId],
    references: [listings.id],
  }),
  renter: one(user, {
    fields: [rentalRequests.renterId],
    references: [user.id],
    relationName: "renterRequests", // Add explicit relation name
  }),
  owner: one(user, {
    fields: [rentalRequests.ownerId],
    references: [user.id],
    relationName: "ownerRequests", // Add explicit relation name
  }),
  // Fix: Add proper field/reference mapping for rental relation
  rental: one(rentals, {
    fields: [rentalRequests.id],
    references: [rentals.requestId],
  }),
}));

export const rentalsRelations = relations(rentals, ({ one, many }) => ({
  request: one(rentalRequests, {
    fields: [rentals.requestId],
    references: [rentalRequests.id],
  }),
  listing: one(listings, {
    fields: [rentals.listingId],
    references: [listings.id],
  }),
  renter: one(user, {
    fields: [rentals.renterId],
    references: [user.id],
    relationName: "renterRentals", // Add explicit relation name
  }),
  owner: one(user, {
    fields: [rentals.ownerId],
    references: [user.id],
    relationName: "ownerRentals", // Add explicit relation name
  }),
  reviews: many(reviews),
  payments: many(payments),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  rental: one(rentals, {
    fields: [reviews.rentalId],
    references: [rentals.id],
  }),
  reviewer: one(user, {
    fields: [reviews.reviewerId],
    references: [user.id],
    relationName: "reviewsGiven", // Add explicit relation name
  }),
  reviewee: one(user, {
    fields: [reviews.revieweeId],
    references: [user.id],
    relationName: "reviewsReceived", // Add explicit relation name
  }),
  listing: one(listings, {
    fields: [reviews.listingId],
    references: [listings.id],
  }),
}));
