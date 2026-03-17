import { describe, it, expect, vi, beforeEach } from "vitest";
import { cronRunHistoryDAL } from "../index";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

describe("CronRunHistoryDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("inserts record with all fields", async () => {
      const startedAt = new Date("2025-01-15T10:00:00Z");
      const completedAt = new Date("2025-01-15T10:05:00Z");
      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        jobName: "process-payouts",
        startedAt,
        completedAt,
        status: "success",
        recordsEligible: 10,
        recordsSucceeded: 8,
        recordsFailed: 2,
        errorMessage: null,
        metadata: null,
        createdAt: new Date("2025-01-15T10:05:00Z"),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      const result = await cronRunHistoryDAL.create({
        jobName: "process-payouts",
        startedAt,
        completedAt,
        status: "success",
        recordsEligible: 10,
        recordsSucceeded: 8,
        recordsFailed: 2,
      });

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith({
        jobName: "process-payouts",
        startedAt,
        completedAt,
        status: "success",
        recordsEligible: 10,
        recordsSucceeded: 8,
        recordsFailed: 2,
        errorMessage: null,
        metadata: null,
      });
      expect(result).toEqual(mockRow);
    });
  });

  describe("getRecent", () => {
    it("returns records ordered by startedAt desc", async () => {
      const rows = [
        {
          id: "1",
          jobName: "process-payouts",
          startedAt: new Date("2025-01-15T11:00:00Z"),
          completedAt: new Date("2025-01-15T11:05:00Z"),
          status: "success",
          recordsEligible: 5,
          recordsSucceeded: 5,
          recordsFailed: 0,
          errorMessage: null,
          metadata: null,
          createdAt: new Date("2025-01-15T11:05:00Z"),
        },
      ];
      const mockLimit = vi.fn().mockResolvedValue(rows);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await cronRunHistoryDAL.getRecent(undefined, 50);

      expect(result).toEqual(rows);
      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it("filters by job name when provided", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      await cronRunHistoryDAL.getRecent("process-payouts", 10);

      expect(mockWhere).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("limits results to specified count", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      await cronRunHistoryDAL.getRecent(undefined, 5);

      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("returns empty array when no records", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await cronRunHistoryDAL.getRecent();

      expect(result).toEqual([]);
    });
  });
});
