import { describe, it, expect, vi, beforeEach } from "vitest";
import { paymentDAL } from "../index";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("PaymentDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserEarningsForMonth", () => {
    const userId = "user-123";
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-30T23:59:59.999");

    it("should return sum of earnings for payee in date range", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ total: "387.50" }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await paymentDAL.getUserEarningsForMonth(
        userId,
        start,
        end,
      );

      expect(result).toBe(387.5);
      expect(db.select).toHaveBeenCalled();
    });

    it("should return 0 when no payments in range", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ total: "0" }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await paymentDAL.getUserEarningsForMonth(
        userId,
        start,
        end,
      );

      expect(result).toBe(0);
    });

    it("should return 0 when row total is null/undefined", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await paymentDAL.getUserEarningsForMonth(
        userId,
        start,
        end,
      );

      expect(result).toBe(0);
    });
  });
});
