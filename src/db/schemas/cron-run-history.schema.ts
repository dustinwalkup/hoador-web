import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

/**
 * Cron run history for operational visibility (Phase 4 — Requirements 9.1, 9.2).
 * Records each cron job execution: job name, timestamps, status, and result counts.
 */
export const cronRunHistory = pgTable(
  "cron_run_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobName: varchar("job_name", { length: 100 }).notNull(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    status: varchar("status", { length: 20 }).notNull(),
    recordsEligible: integer("records_eligible"),
    recordsSucceeded: integer("records_succeeded"),
    recordsFailed: integer("records_failed"),
    errorMessage: text("error_message"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("crh_job_name_idx").on(table.jobName),
    index("crh_started_at_idx").on(table.startedAt),
  ],
);

export type CronRunHistoryRow = typeof cronRunHistory.$inferSelect;
export type NewCronRunHistoryEntry = typeof cronRunHistory.$inferInsert;
