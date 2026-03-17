import { and, desc, eq } from "drizzle-orm";

import { cronRunHistory } from "@/db/schemas/cron-run-history.schema";
import type {
  CronRunHistoryRow,
  NewCronRunHistoryEntry,
} from "@/db/schemas/cron-run-history.schema";
import { BaseDAL } from "./base";

/**
 * Input for creating a cron run history record (Phase 4 — Requirements 9.1, 9.4).
 */
export interface CreateCronRunHistoryInput {
  jobName: string;
  startedAt: Date;
  completedAt?: Date | null;
  status: string;
  recordsEligible?: number | null;
  recordsSucceeded?: number | null;
  recordsFailed?: number | null;
  errorMessage?: string | null;
  metadata?: string | null;
}

/**
 * Data Access Layer for cron run history (operational visibility).
 */
export class CronRunHistoryDAL extends BaseDAL {
  /**
   * Insert a cron run record.
   *
   * @param data - Job name, timestamps, status, and optional counts/error
   * @returns The inserted row
   */
  async create(data: CreateCronRunHistoryInput): Promise<CronRunHistoryRow> {
    try {
      const values: NewCronRunHistoryEntry = {
        jobName: data.jobName,
        startedAt: data.startedAt,
        completedAt: data.completedAt ?? null,
        status: data.status,
        recordsEligible: data.recordsEligible ?? null,
        recordsSucceeded: data.recordsSucceeded ?? null,
        recordsFailed: data.recordsFailed ?? null,
        errorMessage: data.errorMessage ?? null,
        metadata: data.metadata ?? null,
      };

      const [record] = await this.db
        .insert(cronRunHistory)
        .values(values)
        .returning();

      if (!record) {
        throw new Error("Cron run history insert returned no row");
      }

      return record;
    } catch (error) {
      this.handleError(error, "CronRunHistoryDAL.create");
    }
  }

  /**
   * Get recent cron runs, optionally filtered by job name, ordered by startedAt desc.
   *
   * @param jobName - Optional job name filter
   * @param limit - Max records to return (default 50)
   * @returns Recent cron run rows
   */
  async getRecent(
    jobName?: string,
    limit: number = 50,
  ): Promise<CronRunHistoryRow[]> {
    try {
      const conditions = [];
      if (jobName?.trim()) {
        conditions.push(eq(cronRunHistory.jobName, jobName.trim()));
      }
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await this.db
        .select()
        .from(cronRunHistory)
        .where(whereClause)
        .orderBy(desc(cronRunHistory.startedAt))
        .limit(limit);

      return rows;
    } catch (error) {
      this.handleError(error, "CronRunHistoryDAL.getRecent");
    }
  }
}
