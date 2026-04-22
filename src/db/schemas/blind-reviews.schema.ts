import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { user } from "./user.schema";
import { rentals } from "./rentals.schema";
import { serviceBookings } from "./services.schema";

export const blindReviews = pgTable(
  "blind_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rentalId: uuid("rental_id").references(() => rentals.id),
    serviceBookingId: uuid("service_booking_id").references(
      () => serviceBookings.id,
    ),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id),
    revieweeId: text("reviewee_id")
      .notNull()
      .references(() => user.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    reviewWindowEndAt: timestamp("review_window_end_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    // Check constraint: exactly one booking FK is non-null
    check(
      "booking_ref_check",
      sql`num_nonnulls(${table.rentalId}, ${table.serviceBookingId}) = 1`,
    ),

    // Partial unique indexes (one review per user per booking)
    uniqueIndex("blind_reviews_reviewer_rental_idx")
      .on(table.reviewerId, table.rentalId)
      .where(sql`${table.rentalId} IS NOT NULL`),
    uniqueIndex("blind_reviews_reviewer_service_booking_idx")
      .on(table.reviewerId, table.serviceBookingId)
      .where(sql`${table.serviceBookingId} IS NOT NULL`),

    // Query indexes
    index("blind_reviews_rental_id_idx").on(table.rentalId),
    index("blind_reviews_service_booking_id_idx").on(table.serviceBookingId),
    index("blind_reviews_reviewee_id_idx").on(table.revieweeId),
    index("blind_reviews_released_at_idx").on(table.releasedAt),

    // Partial index for cron job: unreleased + expired window
    index("blind_reviews_pending_release_idx")
      .on(table.reviewWindowEndAt)
      .where(sql`${table.releasedAt} IS NULL`),
  ],
);

export const blindReviewsRelations = relations(blindReviews, ({ one }) => ({
  rental: one(rentals, {
    fields: [blindReviews.rentalId],
    references: [rentals.id],
  }),
  serviceBooking: one(serviceBookings, {
    fields: [blindReviews.serviceBookingId],
    references: [serviceBookings.id],
  }),
  reviewer: one(user, {
    fields: [blindReviews.reviewerId],
    references: [user.id],
    relationName: "blindReviewsAsReviewer",
  }),
  reviewee: one(user, {
    fields: [blindReviews.revieweeId],
    references: [user.id],
    relationName: "blindReviewsAsReviewee",
  }),
}));

export type BlindReview = typeof blindReviews.$inferSelect;
export type NewBlindReview = typeof blindReviews.$inferInsert;
