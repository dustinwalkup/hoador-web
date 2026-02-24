import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

import { user } from "./user.schema";

/**
 * Append-only audit log for business-critical events (LOG-AUD-001, LOG-RET-003).
 * No update or delete; all writes are inserts.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 128 }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_entity_type_entity_id_idx").on(
      table.entityType,
      table.entityId,
    ),
    index("audit_logs_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("audit_logs_action_created_at_idx").on(table.action, table.createdAt),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogEntry = typeof auditLogs.$inferInsert;
