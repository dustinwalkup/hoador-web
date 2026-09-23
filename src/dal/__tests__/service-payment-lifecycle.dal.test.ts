import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { servicePaymentLifecycleDAL } from "../index";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

/** Render a captured drizzle WHERE clause to SQL text for guard assertions. */
const whereSql = (where: unknown) =>
  new PgDialect().sqlToQuery(where as SQL).sql;

const lifecycleRow = {
  id: "spl-1",
  bookingId: "book-1",
  chargeId: "ch_1",
  providerPayout: "80.00",
  ownerTransferStatus: "pending" as const,
  payoutStatus: "pending" as const,
  stripeTransferId: null,
  transferAmount: null,
  ownerTransferredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Stub `db.update(...).set(...).where(...)[.returning()]`. */
function stubUpdate(returningRows?: unknown[]) {
  const mockReturning = vi.fn().mockResolvedValue(returningRows ?? []);
  const whereResult = returningRows
    ? { returning: mockReturning }
    : Promise.resolve(undefined);
  const mockWhere = vi.fn().mockReturnValue(whereResult);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);
  return { mockSet, mockWhere };
}

describe("ServicePaymentLifecycleDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("create", () => {
    it("inserts with pending defaults and returns the row", async () => {
      const mockReturning = vi.fn().mockResolvedValue([lifecycleRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const result = await servicePaymentLifecycleDAL.create({
        bookingId: "book-1",
        chargeId: "ch_1",
        providerPayout: "80.00",
      });

      expect(result).toEqual(lifecycleRow);
      expect(mockValues).toHaveBeenCalledWith({
        bookingId: "book-1",
        chargeId: "ch_1",
        providerPayout: "80.00",
        ownerTransferStatus: "pending",
        payoutStatus: "pending",
      });
    });
  });

  describe("claimForProcessing", () => {
    it("claims a pending payout", async () => {
      const { mockSet, mockWhere } = stubUpdate([lifecycleRow]);

      await expect(
        servicePaymentLifecycleDAL.claimForProcessing("book-1"),
      ).resolves.toBe(true);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ payoutStatus: "processing" }),
      );
      // The guard the payout cron's concurrency safety rests on.
      expect(whereSql(mockWhere.mock.calls[0][0])).toContain(
        '"service_payment_lifecycle"."payout_status" = $',
      );
    });

    it("returns false when another run already claimed it", async () => {
      stubUpdate([]);

      await expect(
        servicePaymentLifecycleDAL.claimForProcessing("book-1"),
      ).resolves.toBe(false);
    });
  });

  describe("updateOwnerTransferStatus", () => {
    it("records the transfer id, time and amount (as a string)", async () => {
      const { mockSet } = stubUpdate();
      const at = new Date("2026-06-10T12:00:00Z");

      await servicePaymentLifecycleDAL.updateOwnerTransferStatus(
        "book-1",
        "completed",
        {
          stripeTransferId: "tr_1",
          ownerTransferredAt: at,
          transferAmount: 30,
        },
      );

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerTransferStatus: "completed",
          stripeTransferId: "tr_1",
          ownerTransferredAt: at,
          transferAmount: "30",
        }),
      );
    });

    it("writes only the status when no extras are given", async () => {
      const { mockSet } = stubUpdate();

      await servicePaymentLifecycleDAL.updateOwnerTransferStatus(
        "book-1",
        "failed",
      );

      const patch = mockSet.mock.calls[0][0];
      expect(patch).toMatchObject({ ownerTransferStatus: "failed" });
      expect(patch).not.toHaveProperty("stripeTransferId");
      expect(patch).not.toHaveProperty("ownerTransferredAt");
      expect(patch).not.toHaveProperty("transferAmount");
    });
  });

  describe("updatePayoutStatus", () => {
    it("sets the payout status", async () => {
      const { mockSet } = stubUpdate();

      await servicePaymentLifecycleDAL.updatePayoutStatus("book-1", "failed");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ payoutStatus: "failed" }),
      );
    });
  });

  describe("findEligibleForPayout", () => {
    it("maps rows and pays the locked lifecycle payout, as a string", async () => {
      const mockLimit = vi.fn().mockResolvedValue([
        {
          lifecycle: lifecycleRow,
          bookingId: "book-1",
          providerId: "prov-1",
          providerConnectedAccountId: "acct_1",
        },
      ]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const joins = {
        innerJoin: vi.fn(),
        leftJoin: vi.fn(),
        where: mockWhere,
      };
      joins.innerJoin.mockReturnValue(joins);
      joins.leftJoin.mockReturnValue(joins);
      const mockFrom = vi.fn().mockReturnValue(joins);
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const cutoff = new Date("2026-06-01T00:00:00Z");
      const result = await servicePaymentLifecycleDAL.findEligibleForPayout(
        cutoff,
        10,
      );

      expect(result).toEqual([
        {
          lifecycle: lifecycleRow,
          bookingId: "book-1",
          providerId: "prov-1",
          providerPayout: "80.00",
          providerConnectedAccountId: "acct_1",
        },
      ]);
      expect(mockLimit).toHaveBeenCalledWith(10);
      // Never pay a frozen transfer, a booking under active dispute, or one
      // without a locked payout amount.
      const sql = whereSql(mockWhere.mock.calls[0][0]);
      expect(sql).toContain(
        '"service_payment_lifecycle"."owner_transfer_status" <> $',
      );
      expect(sql).toContain('"disputes"."id" is null');
      expect(sql).toContain(
        '"service_payment_lifecycle"."provider_payout" is not null',
      );
    });
  });

  describe("markCancelled", () => {
    it("completes the payout so the cron skips it", async () => {
      const { mockSet } = stubUpdate();

      await expect(
        servicePaymentLifecycleDAL.markCancelled("book-1"),
      ).resolves.toBeUndefined();

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ payoutStatus: "completed" }),
      );
    });
  });

  describe("unfreezeAfterResolution", () => {
    it("unfreezes only a frozen transfer and reports whether it did", async () => {
      const { mockSet, mockWhere } = stubUpdate([lifecycleRow]);

      await expect(
        servicePaymentLifecycleDAL.unfreezeAfterResolution("book-1"),
      ).resolves.toBe(true);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ ownerTransferStatus: "pending" }),
      );
      expect(whereSql(mockWhere.mock.calls[0][0])).toContain(
        '"service_payment_lifecycle"."owner_transfer_status" = $',
      );
    });

    it("returns false when the transfer was not frozen", async () => {
      stubUpdate([]);

      await expect(
        servicePaymentLifecycleDAL.unfreezeAfterResolution("book-1"),
      ).resolves.toBe(false);
    });
  });
});
