import { describe, it, expect, vi, beforeEach } from "vitest";
import { serviceBookingDAL } from "../index";
import { NotFoundError } from "../errors";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

const bookingRow = {
  id: "book-1",
  listingId: "list-1",
  requesterId: "req-1",
  providerId: "prov-1",
  communityId: "comm-1",
  proposedDate: "2025-06-01",
  proposedTime: "10:00",
  hours: null as string | null,
  notes: null as string | null,
  declineReason: null as string | null,
  servicePrice: "100.00",
  serviceFee: "10.00",
  totalAmount: "110.00",
  status: "pending" as const,
  stripePaymentIntentId: null as string | null,
  stripeChargeId: "ch_1" as string | null,
  paymentStatus: null as string | null,
  refundAmount: null as string | null,
  stripeRefundId: null as string | null,
  cancelledAt: null as Date | null,
  cancelledBy: null as string | null,
  cancellationReason: null as string | null,
  completedAt: null as Date | null,
  payoutStatus: "pending" as const,
  stripeTransferId: null as string | null,
  ownerTransferredAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ServiceBookingDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("inserts and returns the booking", async () => {
      const mockReturning = vi.fn().mockResolvedValue([bookingRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const result = await serviceBookingDAL.create({
        listingId: bookingRow.listingId,
        requesterId: bookingRow.requesterId,
        providerId: bookingRow.providerId,
        communityId: bookingRow.communityId,
        proposedDate: bookingRow.proposedDate,
        proposedTime: bookingRow.proposedTime,
        hours: null,
        notes: null,
        declineReason: null,
        servicePrice: bookingRow.servicePrice,
        serviceFee: bookingRow.serviceFee,
        totalAmount: bookingRow.totalAmount,
        status: "pending",
        stripePaymentIntentId: null,
        stripeChargeId: null,
        paymentStatus: null,
        refundAmount: null,
        stripeRefundId: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        completedAt: null,
        payoutStatus: null,
        stripeTransferId: null,
        ownerTransferredAt: null,
      });

      expect(result).toEqual(bookingRow);
    });

    it("throws when insert returns empty", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      await expect(
        serviceBookingDAL.create({
          listingId: "l",
          requesterId: "r",
          providerId: "p",
          communityId: "c",
          proposedDate: "2025-01-01",
          proposedTime: "09:00",
          hours: null,
          notes: null,
          declineReason: null,
          servicePrice: "1",
          serviceFee: "0",
          totalAmount: "1",
          status: "pending",
          stripePaymentIntentId: null,
          stripeChargeId: null,
          paymentStatus: null,
          refundAmount: null,
          stripeRefundId: null,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          completedAt: null,
          payoutStatus: null,
          stripeTransferId: null,
          ownerTransferredAt: null,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getCancellationContext", () => {
    it("returns required fields for cancellation", async () => {
      const mockLimit = vi.fn().mockResolvedValue([
        {
          status: "accepted",
          proposedDate: "2025-06-15",
          totalAmount: "100.00",
          stripeChargeId: "ch_abc",
          requesterId: "req-1",
          providerId: "prov-1",
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const ctx = await serviceBookingDAL.getCancellationContext("book-1");

      expect(ctx).toEqual({
        status: "accepted",
        proposedDate: "2025-06-15",
        totalAmount: "100.00",
        stripeChargeId: "ch_abc",
        requesterId: "req-1",
        providerId: "prov-1",
      });
    });

    it("returns null when booking missing", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const ctx = await serviceBookingDAL.getCancellationContext("missing");
      expect(ctx).toBeNull();
    });
  });

  describe("claimForPayoutProcessing", () => {
    it("returns true when a row was updated", async () => {
      const mockReturning = vi.fn().mockResolvedValue([bookingRow]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const claimed =
        await serviceBookingDAL.claimForPayoutProcessing("book-1");
      expect(claimed).toBe(true);
    });

    it("returns false when no row matched (already processing)", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const claimed =
        await serviceBookingDAL.claimForPayoutProcessing("book-1");
      expect(claimed).toBe(false);
    });
  });

  describe("findEligibleForPayout", () => {
    it("orders by completedAt asc and respects limit", async () => {
      const eligible = {
        ...bookingRow,
        completedAt: new Date("2025-01-01T12:00:00Z"),
        payoutStatus: "pending" as const,
        providerConnectedAccountId: "acct_123",
      };
      const mockLimit = vi.fn().mockResolvedValue([eligible]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const cutoff = new Date("2025-01-02T00:00:00Z");
      const rows = await serviceBookingDAL.findEligibleForPayout(cutoff, 3);

      expect(rows).toHaveLength(1);
      expect(rows[0].providerConnectedAccountId).toBe("acct_123");
      expect(mockLimit).toHaveBeenCalledWith(3);
    });
  });
});
