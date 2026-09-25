import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { paymentLifecycleDAL } from "../index";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

/** Render a captured drizzle WHERE clause to SQL text and bound params. */
const renderWhere = (where: unknown) =>
  new PgDialect().sqlToQuery(where as SQL);

/** Stub a `db.select()` chain; every builder step returns the chain. */
function stubSelect(rows: unknown[] = []) {
  const mockWhere = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const step of ["from", "innerJoin", "leftJoin", "orderBy"]) {
    chain[step] = vi.fn().mockReturnValue(chain);
  }
  chain.where = mockWhere.mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  vi.mocked(db.select).mockReturnValue(chain as never);
  return { mockWhere };
}

/** Stub a `db.update().set().where().returning()` chain. */
function stubUpdate(returned: unknown[]) {
  const mockReturning = vi.fn().mockResolvedValue(returned);
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);
  return { mockSet, mockWhere };
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

  describe("findEligibleForPayout", () => {
    // BIZ-05: a transfer frozen by a dispute stays out of the payout cron until
    // /resolve unfreezes it, even after the dispute row reads `resolved` (which
    // the open-dispute join no longer counts as blocking).
    it("excludes rows whose owner transfer is frozen", async () => {
      const { mockWhere } = stubSelect();

      await paymentLifecycleDAL.findEligibleForPayout(20);

      const { sql, params } = renderWhere(mockWhere.mock.calls[0][0]);
      const match = sql.match(
        /"rental_payment_lifecycle"\."owner_transfer_status" <> \$(\d+)/,
      );
      expect(match).not.toBeNull();
      expect(params[Number(match![1]) - 1]).toBe("frozen");
    });

    // CONC-02: a refunded charge must never fund an owner payout — Stripe's
    // `source_transaction` transfer is not reduced by the refund, so the
    // platform would pay it. NOT EXISTS, not a join, so a rental with several
    // payment rows is not returned (and paid) more than once.
    it("excludes rentals whose charge was refunded", async () => {
      const { mockWhere } = stubSelect();

      await paymentLifecycleDAL.findEligibleForPayout(20);

      const { sql, params } = renderWhere(mockWhere.mock.calls[0][0]);
      const match = sql.match(
        /NOT EXISTS \(SELECT 1 FROM "payments" WHERE "payments"\."rental_id" = "rentals"\."id" AND "payments"\."status" = \$(\d+)\)/,
      );
      expect(match).not.toBeNull();
      expect(params[Number(match![1]) - 1]).toBe("refunded");
    });
  });

  // CONC-10: placement claims the row first, so the cron, a retry and a
  // cancel can't all act on one `scheduled` snapshot.
  describe("claimForDepositHold", () => {
    it("claims only a scheduled or failed hold, into placing", async () => {
      const { mockSet, mockWhere } = stubUpdate([{ rentalId: "rental-1" }]);

      const claimed = await paymentLifecycleDAL.claimForDepositHold("rental-1");

      expect(claimed).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ depositHoldStatus: "placing" }),
      );
      const { sql, params } = renderWhere(mockWhere.mock.calls[0][0]);
      expect(sql).toContain(
        '"rental_payment_lifecycle"."deposit_hold_status" in ($2, $3)',
      );
      expect(params).toEqual(["rental-1", "scheduled", "failed"]);
    });

    it("returns false when the row is no longer claimable", async () => {
      stubUpdate([]);

      expect(await paymentLifecycleDAL.claimForDepositHold("rental-1")).toBe(
        false,
      );
    });
  });

  describe("updateDepositHoldStatus", () => {
    it("writes unconditionally without fromStatus", async () => {
      const { mockWhere } = stubUpdate([{ rentalId: "rental-1" }]);

      const updated = await paymentLifecycleDAL.updateDepositHoldStatus(
        "rental-1",
        "released",
      );

      expect(updated).toBe(true);
      const { sql } = renderWhere(mockWhere.mock.calls[0][0]);
      expect(sql).not.toContain("deposit_hold_status");
    });

    it("is a compare-and-swap with fromStatus, and reports a lost swap", async () => {
      const { mockWhere } = stubUpdate([]);

      const updated = await paymentLifecycleDAL.updateDepositHoldStatus(
        "rental-1",
        "held",
        { fromStatus: "placing" },
      );

      expect(updated).toBe(false);
      const { sql, params } = renderWhere(mockWhere.mock.calls[0][0]);
      expect(sql).toContain(
        '"rental_payment_lifecycle"."deposit_hold_status" in ($2)',
      );
      expect(params).toEqual(["rental-1", "placing"]);
    });

    it("accepts several fromStatus values", async () => {
      const { mockWhere } = stubUpdate([{ rentalId: "rental-1" }]);

      await paymentLifecycleDAL.updateDepositHoldStatus(
        "rental-1",
        "released",
        {
          fromStatus: ["scheduled", "placing"],
        },
      );

      expect(renderWhere(mockWhere.mock.calls[0][0]).params).toEqual([
        "rental-1",
        "scheduled",
        "placing",
      ]);
    });
  });
});
