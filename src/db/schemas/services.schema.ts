import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  jsonb,
  numeric,
  integer,
  date,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import {
  serviceBookingStatusEnum,
  serviceListingStatusEnum,
  servicePricingTypeEnum,
} from "./_enums";
import { communities } from "./communities.schema";
import { user } from "./user.schema";

export const serviceListingCategories = pgTable("service_listing_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceListings = pgTable(
  "service_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    providerId: text("provider_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    categoryId: uuid("category_id")
      .references(() => serviceListingCategories.id)
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    pricingType: servicePricingTypeEnum("pricing_type").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    photos: jsonb("photos").$type<string[]>().default([]),
    serviceNotes: text("service_notes"),
    ownerPoliciesAcknowledged: boolean("owner_policies_acknowledged")
      .default(false)
      .notNull(),
    status: serviceListingStatusEnum("status")
      .default("pending_approval")
      .notNull(),
    adminNote: text("admin_note"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    communityStatusIdx: index("sl_community_status_idx").on(
      table.communityId,
      table.status,
    ),
    providerIdx: index("sl_provider_idx").on(table.providerId),
    categoryIdx: index("sl_category_idx").on(table.categoryId),
  }),
);

export const serviceBookings = pgTable(
  "service_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .references(() => serviceListings.id, { onDelete: "restrict" })
      .notNull(),
    requesterId: text("requester_id")
      .references(() => user.id, { onDelete: "restrict" })
      .notNull(),
    providerId: text("provider_id")
      .references(() => user.id, { onDelete: "restrict" })
      .notNull(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "restrict" })
      .notNull(),
    proposedDate: date("proposed_date").notNull(),
    proposedTime: varchar("proposed_time", { length: 10 }).notNull(),
    hours: numeric("hours", { precision: 4, scale: 2 }),
    notes: text("notes"),
    declineReason: text("decline_reason"),
    servicePrice: numeric("service_price", {
      precision: 10,
      scale: 2,
    }).notNull(),
    serviceFee: numeric("service_fee", { precision: 10, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", {
      precision: 10,
      scale: 2,
    }).notNull(),
    status: serviceBookingStatusEnum("status").default("pending").notNull(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    paymentStatus: varchar("payment_status", { length: 50 }),
    refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
    stripeRefundId: varchar("stripe_refund_id", { length: 255 }),
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => user.id),
    cancellationReason: text("cancellation_reason"),
    completedAt: timestamp("completed_at"),
    /** Stripe payment method id chosen at booking time (used when provider accepts). */
    selectedPaymentMethodId: varchar("selected_payment_method_id", {
      length: 255,
    }),
    /**
     * Hard deadline for a pending booking. After this time, the cron at
     * /api/cron/expire-pending-bookings transitions the row to `cancelled` with
     * cancellationReason='expired_no_acceptance'. Set at insert time to
     * createdAt + PENDING_BOOKING_EXPIRY_WINDOW_HOURS.
     */
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    completedAtIdx: index("sb_completed_at_idx").on(table.completedAt),
    providerIdx: index("sb_provider_idx").on(table.providerId),
    requesterIdx: index("sb_requester_idx").on(table.requesterId),
    pendingExpiresAtIdx: index("sb_pending_expires_at_idx")
      .on(table.expiresAt)
      .where(sql`status = 'pending'`),
  }),
);

export const serviceProviderProfiles = pgTable("service_provider_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  bio: text("bio"),
  aggregateRating: numeric("aggregate_rating", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const serviceListingCategoriesRelations = relations(
  serviceListingCategories,
  ({ many }) => ({
    listings: many(serviceListings),
  }),
);

export const serviceListingsRelations = relations(
  serviceListings,
  ({ one, many }) => ({
    category: one(serviceListingCategories, {
      fields: [serviceListings.categoryId],
      references: [serviceListingCategories.id],
    }),
    community: one(communities, {
      fields: [serviceListings.communityId],
      references: [communities.id],
    }),
    provider: one(user, {
      fields: [serviceListings.providerId],
      references: [user.id],
    }),
    bookings: many(serviceBookings),
  }),
);

export const serviceBookingsRelations = relations(
  serviceBookings,
  ({ one }) => ({
    listing: one(serviceListings, {
      fields: [serviceBookings.listingId],
      references: [serviceListings.id],
    }),
    requester: one(user, {
      fields: [serviceBookings.requesterId],
      references: [user.id],
      relationName: "serviceBookingRequester",
    }),
    provider: one(user, {
      fields: [serviceBookings.providerId],
      references: [user.id],
      relationName: "serviceBookingProvider",
    }),
    community: one(communities, {
      fields: [serviceBookings.communityId],
      references: [communities.id],
    }),
  }),
);

export const serviceProviderProfilesRelations = relations(
  serviceProviderProfiles,
  ({ one }) => ({
    user: one(user, {
      fields: [serviceProviderProfiles.userId],
      references: [user.id],
    }),
  }),
);

export type ServiceListingCategory =
  typeof serviceListingCategories.$inferSelect;
export type NewServiceListingCategory =
  typeof serviceListingCategories.$inferInsert;

export type ServiceListing = typeof serviceListings.$inferSelect;
export type NewServiceListing = typeof serviceListings.$inferInsert;

export type ServiceBooking = typeof serviceBookings.$inferSelect;
export type NewServiceBooking = typeof serviceBookings.$inferInsert;

export type ServiceProviderProfile =
  typeof serviceProviderProfiles.$inferSelect;
export type NewServiceProviderProfile =
  typeof serviceProviderProfiles.$inferInsert;
