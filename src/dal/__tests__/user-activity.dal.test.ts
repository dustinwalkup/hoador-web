import { describe, it, expect, vi, beforeEach } from "vitest";
import { userActivityDAL } from "../index";
import { ValidationError } from "../errors";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

describe("UserActivityDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logActivity", () => {
    it("should insert activity log and update user lastActiveAt in a transaction", async () => {
      const userId = "user-123";
      const activityType = "login";
      const metadata = { ip: "1.2.3.4" };
      const ipAddress = "1.2.3.4";
      const userAgent = "Mozilla/5.0";

      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

      const mockTx = {
        insert: mockInsert,
        update: mockUpdate,
      };
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any);
      });

      await userActivityDAL.logActivity({
        userId,
        activityType,
        metadata,
        ipAddress,
        userAgent,
      });

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          activityType,
          metadata,
          ipAddress,
          userAgent,
        }),
      );
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ lastActiveAt: expect.any(Date) }),
      );
    });

    it("should coerce undefined metadata, ipAddress, userAgent to null", async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
      const mockTx = { insert: mockInsert, update: mockUpdate };
      vi.mocked(db.transaction).mockImplementation(async (callback) =>
        callback(mockTx as any),
      );

      await userActivityDAL.logActivity({
        userId: "user-1",
        activityType: "logout",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          activityType: "logout",
          metadata: null,
          ipAddress: null,
          userAgent: null,
        }),
      );
    });
  });

  describe("getActivityForUser", () => {
    it("should return paginated activity for user with no filters", async () => {
      const userId = "user-123";
      const mockRows = [
        {
          id: "log-1",
          userId,
          activityType: "login",
          metadata: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date("2025-01-01"),
        },
      ];
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 1 }]),
        }),
      };
      const mockRowsSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockRows),
              }),
            }),
          }),
        }),
      };
      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockRowsSelect as any);

      const result = await userActivityDAL.getActivityForUser(userId, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "log-1",
        userId,
        activityType: "login",
        metadata: null,
        ipAddress: null,
        userAgent: null,
      });
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should apply activityType, dateFrom, dateTo filters when provided", async () => {
      const userId = "user-123";
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }]),
        }),
      };
      const mockRowsSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };
      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockRowsSelect as any);

      const dateFrom = new Date("2025-01-01");
      const dateTo = new Date("2025-01-31");
      await userActivityDAL.getActivityForUser(userId, {
        page: 1,
        limit: 20,
        activityType: "profile_updated",
        dateFrom,
        dateTo,
      });

      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it("should throw ValidationError when page is less than 1", async () => {
      await expect(
        userActivityDAL.getActivityForUser("user-1", { page: 0, limit: 10 }),
      ).rejects.toThrow(ValidationError);
      await expect(
        userActivityDAL.getActivityForUser("user-1", { page: -1, limit: 10 }),
      ).rejects.toThrow("Page must be greater than 0");
    });

    it("should throw ValidationError when limit is invalid", async () => {
      await expect(
        userActivityDAL.getActivityForUser("user-1", { page: 1, limit: 0 }),
      ).rejects.toThrow(ValidationError);
      await expect(
        userActivityDAL.getActivityForUser("user-1", { page: 1, limit: 101 }),
      ).rejects.toThrow("Limit must be between 1 and 100");
    });
  });

  describe("getInactiveUsers", () => {
    it("should return paginated inactive users", async () => {
      const mockUsers = [
        {
          id: "user-1",
          name: "Inactive User",
          email: "inactive@example.com",
          status: "active",
          userType: "standard",
          lastActiveAt: new Date("2024-01-01"),
          createdAt: new Date("2023-06-01"),
        },
      ];
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 1 }]),
        }),
      };
      const mockRowsSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockUsers),
              }),
            }),
          }),
        }),
      };
      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockRowsSelect as any);

      const result = await userActivityDAL.getInactiveUsers(30, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "user-1",
        name: "Inactive User",
        email: "inactive@example.com",
        status: "active",
        userType: "standard",
      });
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it("should apply status and userType filters when provided", async () => {
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }]),
        }),
      };
      const mockRowsSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };
      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockRowsSelect as any);

      await userActivityDAL.getInactiveUsers(60, {
        page: 1,
        limit: 20,
        status: "active",
        userType: "admin",
      });

      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it("should throw ValidationError for invalid pagination", async () => {
      await expect(
        userActivityDAL.getInactiveUsers(30, { page: 0, limit: 10 }),
      ).rejects.toThrow(ValidationError);
      await expect(
        userActivityDAL.getInactiveUsers(30, { page: 1, limit: 101 }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("getActivityStats", () => {
    it("should return all activity stats from parallel queries", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      } as any);

      const result = await userActivityDAL.getActivityStats();

      expect(result).toEqual({
        activeLast24h: 42,
        activeLast7d: 42,
        activeLast30d: 42,
        activeLast90d: 42,
        inactive30d: 42,
        inactive60d: 42,
        inactive90d: 42,
      });
      expect(db.select).toHaveBeenCalledTimes(7);
    });

    it("should return zeros when count results are empty or undefined", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await userActivityDAL.getActivityStats();

      expect(result).toEqual({
        activeLast24h: 0,
        activeLast7d: 0,
        activeLast30d: 0,
        activeLast90d: 0,
        inactive30d: 0,
        inactive60d: 0,
        inactive90d: 0,
      });
    });
  });

  describe("getRecentActivity", () => {
    it("should return recent activity entries with user name and email", async () => {
      const mockRows = [
        {
          id: "log-1",
          userId: "user-1",
          activityType: "login",
          metadata: null,
          createdAt: new Date("2025-02-01"),
          userName: "Alice",
          userEmail: "alice@example.com",
        },
      ];
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await userActivityDAL.getRecentActivity(10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "log-1",
        userId: "user-1",
        activityType: "login",
        metadata: null,
        userName: "Alice",
        userEmail: "alice@example.com",
      });
      expect(mockFrom).toHaveBeenCalled();
    });

    it("should cap limit at 100 when requested limit exceeds 100", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ limit: mockLimit }),
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await userActivityDAL.getRecentActivity(500);

      expect(mockLimit).toHaveBeenCalledWith(100);
    });
  });
});
