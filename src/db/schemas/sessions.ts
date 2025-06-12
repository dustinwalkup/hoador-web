import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// User sessions (for login tracking)
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
    deviceInfo: jsonb("device_info")
      .$type<Record<string, string | number | boolean | string[] | null>>()
      .default({})
      .notNull(),

    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
    sessionTokenIdx: uniqueIndex("user_sessions_session_token_idx").on(
      table.sessionToken,
    ),
    isActiveIdx: index("user_sessions_is_active_idx").on(table.isActive),
  }),
);
