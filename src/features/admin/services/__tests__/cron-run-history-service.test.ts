import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockGetRecent = vi.fn();

vi.mock("@/dal", () => ({
  cronRunHistoryDAL: {
    create: (...args: unknown[]) => mockCreate(...args),
    getRecent: (...args: unknown[]) => mockGetRecent(...args),
  },
}));

const mockLoggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    error: (...args: unknown[]) => mockLoggerError(...args),
  }),
}));

import { CronRunHistoryService } from "../cron-run-history-service";

describe("CronRunHistoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordRun", () => {
    it("calls DAL create with params when successful", async () => {
      mockCreate.mockResolvedValue(undefined);

      await CronRunHistoryService.recordRun({
        jobName: "process-payouts",
        startedAt: new Date(),
        completedAt: new Date(),
        status: "success",
        recordsEligible: 10,
        recordsSucceeded: 8,
        recordsFailed: 2,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "process-payouts",
          status: "success",
          recordsEligible: 10,
          recordsSucceeded: 8,
          recordsFailed: 2,
        }),
      );
    });

    it("logs error and does not propagate when DAL throws", async () => {
      mockCreate.mockRejectedValue(new Error("DB connection failed"));

      await CronRunHistoryService.recordRun({
        jobName: "detect-stale-processing",
        startedAt: new Date(),
        completedAt: new Date(),
        status: "failure",
        errorMessage: "timeout",
      });

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "detect-stale-processing",
          status: "failure",
        }),
        "CronRunHistoryService.recordRun failed",
      );
      await expect(
        CronRunHistoryService.recordRun({
          jobName: "x",
          startedAt: new Date(),
          completedAt: new Date(),
          status: "success",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("getRecentRuns", () => {
    it("delegates to DAL with jobName and limit", async () => {
      const rows = [
        {
          id: "1",
          jobName: "process-payouts",
          startedAt: new Date(),
          completedAt: new Date(),
          status: "success",
          recordsEligible: 5,
          recordsSucceeded: 5,
          recordsFailed: 0,
          errorMessage: null,
          metadata: null,
          createdAt: new Date(),
        },
      ];
      mockGetRecent.mockResolvedValue(rows);

      const result = await CronRunHistoryService.getRecentRuns(
        "process-payouts",
        25,
      );

      expect(mockGetRecent).toHaveBeenCalledWith("process-payouts", 25);
      expect(result).toEqual(rows);
    });

    it("uses default limit 50 when not provided", async () => {
      mockGetRecent.mockResolvedValue([]);

      await CronRunHistoryService.getRecentRuns();

      expect(mockGetRecent).toHaveBeenCalledWith(undefined, 50);
    });
  });
});
