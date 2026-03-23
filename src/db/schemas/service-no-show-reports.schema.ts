import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { user } from "./user.schema";
import { serviceBookings } from "./services.schema";

export const serviceNoShowReports = pgTable("service_no_show_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .references(() => serviceBookings.id, { onDelete: "cascade" })
    .notNull(),
  reportedBy: text("reported_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  notes: text("notes"),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
});

export const serviceNoShowReportsRelations = relations(
  serviceNoShowReports,
  ({ one }) => ({
    booking: one(serviceBookings, {
      fields: [serviceNoShowReports.bookingId],
      references: [serviceBookings.id],
    }),
    reporter: one(user, {
      fields: [serviceNoShowReports.reportedBy],
      references: [user.id],
    }),
  }),
);

export type ServiceNoShowReport = typeof serviceNoShowReports.$inferSelect;
export type NewServiceNoShowReport = typeof serviceNoShowReports.$inferInsert;
