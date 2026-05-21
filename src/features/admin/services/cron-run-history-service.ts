import type { CreateCronRunHistoryInput } from "@/dal/cron-run-history.dal";
import type { CronRunHistoryRow } from "@/db/schemas/cron-run-history.schema";
import { cronRunHistoryDAL } from "@/dal";
import { getLogger } from "@/lib/logger";

/**
 * Service for recording and querying cron run history (Phase 4 — Requirements 9.1, 9.3, 9.4).
 * recordRun is best-effort: errors are logged and not propagated so crons can complete.
 */
export const CronRunHistoryService = {
  /**
   * Record a cron run. Best-effort: on DAL failure, logs error and does not throw.
   *
   * @param params - Job name, timestamps, status, and optional counts/error
   */
  async recordRun(params: CreateCronRunHistoryInput): Promise<void> {
    try {
      await cronRunHistoryDAL.create(params);
    } catch (error) {
      getLogger().error(
        { err: error, jobName: params.jobName, status: params.status },
        "CronRunHistoryService.recordRun failed",
      );
    }
  },

  /**
   * Get recent cron runs, optionally filtered by job name.
   *
   * @param jobName - Optional job name filter
   * @param limit - Max records (default 50)
   * @returns Recent cron run rows
   */
  async getRecentRuns(
    jobName?: string,
    limit: number = 50,
  ): Promise<CronRunHistoryRow[]> {
    return cronRunHistoryDAL.getRecent(jobName, limit);
  },

  /**
   * Delete cron run records older than the specified age.
   *
   * @param daysOld - Age threshold in days (must be >= 1)
   * @returns Number of rows deleted
   */
  async deleteOldRuns(daysOld: number): Promise<number> {
    return cronRunHistoryDAL.deleteOldRuns(daysOld);
  },
};
