import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

import { userActivityTypeEnum } from "./_enums";
import { user } from "./user.schema";

/**
 * Log of user activity events for admin analytics and inactivity filtering.
 * Each row represents one tracked action (login, listing created, etc.).
 */
export const userActivityLog = pgTable(
  "user_activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activityType: userActivityTypeEnum("activity_type").notNull(),
    metadata: jsonb("metadata"), // Contextual data (listingId, rentalId, etc.)
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdCreatedAtIdx: index("user_activity_log_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    createdAtIdx: index("user_activity_log_created_at_idx").on(table.createdAt),
  }),
);

export type UserActivityLogDB = typeof userActivityLog.$inferSelect;
export type NewUserActivityLog = typeof userActivityLog.$inferInsert;
