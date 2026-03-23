import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { user } from "./user.schema";
import { serviceBookings, serviceListings } from "./services.schema";

export const serviceReviews = pgTable(
  "service_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .references(() => serviceBookings.id, { onDelete: "cascade" })
      .notNull(),
    listingId: uuid("listing_id")
      .references(() => serviceListings.id, { onDelete: "cascade" })
      .notNull(),
    reviewerId: text("reviewer_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    revieweeId: text("reviewee_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueReviewerBooking: uniqueIndex("sr_reviewer_booking_idx").on(
      table.bookingId,
      table.reviewerId,
    ),
    revieweeIdx: index("sr_reviewee_idx").on(table.revieweeId),
    listingIdx: index("sr_listing_idx").on(table.listingId),
  }),
);

export const serviceReviewsRelations = relations(serviceReviews, ({ one }) => ({
  booking: one(serviceBookings, {
    fields: [serviceReviews.bookingId],
    references: [serviceBookings.id],
  }),
  listing: one(serviceListings, {
    fields: [serviceReviews.listingId],
    references: [serviceListings.id],
  }),
  reviewer: one(user, {
    fields: [serviceReviews.reviewerId],
    references: [user.id],
    relationName: "serviceReviewReviewer",
  }),
  reviewee: one(user, {
    fields: [serviceReviews.revieweeId],
    references: [user.id],
    relationName: "serviceReviewReviewee",
  }),
}));

export type ServiceReview = typeof serviceReviews.$inferSelect;
export type NewServiceReview = typeof serviceReviews.$inferInsert;
