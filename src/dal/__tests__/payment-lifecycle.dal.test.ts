import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { paymentLifecycleDAL } from "../index";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

/** Render a captured drizzle WHERE clause to SQL text and bound params. */
const renderWhere = (where: unknown) =>
  new PgDialect().sqlToQuery(where as SQL);

/** Stub a `db.select()` chain; every builder step returns the chain. */
function stubSelect(rows: unknown[] = []) {
  const mockWhere = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const step of ["from", "innerJoin", "orderBy"]) {
    chain[step] = vi.fn().mockReturnValue(chain);
  }
  chain.where = mockWhere.mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  vi.mocked(db.select).mockReturnValue(chain as never);
  return { mockWhere };
}

describe("PaymentLifecycleDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("findScheduledDepositsNearPickup", () => {
    it("selects only scheduled holds, never failed ones", async () => {
      const { mockWhere } = stubSelect();

      await paymentLifecycleDAL.findScheduledDepositsNearPickup(20);

      // A failed hold belongs to the renter's retry; if the cron also picked
      // it up, the two could place competing holds on different keys.
      const { sql, params } = renderWhere(mockWhere.mock.calls[0][0]);
      expect(sql).toContain(
        '"rental_payment_lifecycle"."deposit_hold_status" = $',
      );
      expect(params).toContain("scheduled");
      expect(params).not.toContain("failed");
    });
  });
});
