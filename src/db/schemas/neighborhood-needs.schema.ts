import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./user.schema";
import { communities } from "./communities.schema";
import { needTypeEnum, needStatusEnum, needCloseReasonEnum } from "./_enums";

export const neighborhoodNeeds = pgTable(
  "neighborhood_needs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdByUserId: text("created_by_user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    type: needTypeEnum("type").notNull(),
    // No DB FK — references listing_categories OR service_listing_categories
    // based on `type`; validated in the service layer (D4).
    categoryId: uuid("category_id").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    neededStartDate: date("needed_start_date"),
    neededEndDate: date("needed_end_date"),
    status: needStatusEnum("status").default("open").notNull(),
    closeReason: needCloseReasonEnum("close_reason"),
    closedAt: timestamp("closed_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    communityStatusIdx: index("neighborhood_needs_community_status_idx").on(
      t.communityId,
      t.status,
    ),
    creatorIdx: index("neighborhood_needs_creator_idx").on(t.createdByUserId),
  }),
);

export const neighborhoodNeedListings = pgTable(
  "neighborhood_need_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    neighborhoodNeedId: uuid("neighborhood_need_id")
      .references(() => neighborhoodNeeds.id, { onDelete: "cascade" })
      .notNull(),
    // Polymorphic: 'rental' -> listings.id, 'service' -> service_listings.id
    listingType: needTypeEnum("listing_type").notNull(),
    listingId: uuid("listing_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    needIdx: index("neighborhood_need_listings_need_idx").on(
      t.neighborhoodNeedId,
    ),
    // A listing belongs to at most ONE originating need (R3.2)
    listingUniqueIdx: uniqueIndex("neighborhood_need_listings_listing_idx").on(
      t.listingType,
      t.listingId,
    ),
  }),
);

export const neighborhoodNeedsRelations = relations(
  neighborhoodNeeds,
  ({ one, many }) => ({
    creator: one(user, {
      fields: [neighborhoodNeeds.createdByUserId],
      references: [user.id],
    }),
    community: one(communities, {
      fields: [neighborhoodNeeds.communityId],
      references: [communities.id],
    }),
    linkedListings: many(neighborhoodNeedListings),
  }),
);

export const neighborhoodNeedListingsRelations = relations(
  neighborhoodNeedListings,
  ({ one }) => ({
    need: one(neighborhoodNeeds, {
      fields: [neighborhoodNeedListings.neighborhoodNeedId],
      references: [neighborhoodNeeds.id],
    }),
  }),
);

export type NeighborhoodNeed = typeof neighborhoodNeeds.$inferSelect;
export type NewNeighborhoodNeed = typeof neighborhoodNeeds.$inferInsert;
export type NeighborhoodNeedListing =
  typeof neighborhoodNeedListings.$inferSelect;
