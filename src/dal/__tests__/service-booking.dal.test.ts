import { describe, it, expect, vi, beforeEach } from "vitest";
import { serviceBookingDAL } from "../index";
import { NotFoundError } from "../errors";
import { db } from "@/db/db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

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
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
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
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateIfStatus", () => {
    const stubUpdate = (rows: unknown[]) => {
      const mockReturning = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);
      return { mockSet, mockWhere };
    };

    it("returns the row when the expected status still holds", async () => {
      const completed = { ...bookingRow, status: "completed" as const };
      const { mockSet, mockWhere } = stubUpdate([completed]);

      const result = await serviceBookingDAL.updateIfStatus(
        "book-1",
        "accepted",
        { status: "completed" },
      );

      expect(result).toEqual(completed);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
      );
      const sql = whereSql(mockWhere.mock.calls[0][0]);
      expect(sql).toContain('"service_bookings"."status" = $');
      // No payment-processing guard unless asked for.
      expect(sql).not.toContain("payment_status");
    });

    it("returns null when the guard fails (0 rows)", async () => {
      stubUpdate([]);

      const result = await serviceBookingDAL.updateIfStatus(
        "book-1",
        "accepted",
        { status: "completed" },
      );

      expect(result).toBeNull();
    });

    it("refuses while an accept-charge claim is held when asked to", async () => {
      const { mockWhere } = stubUpdate([]);

      await serviceBookingDAL.updateIfStatus(
        "book-1",
        "pending",
        { status: "cancelled" },
        { blockWhilePaymentProcessing: true },
      );

      const sql = whereSql(mockWhere.mock.calls[0][0]);
      expect(sql).toContain('"service_bookings"."payment_status" is null');
      expect(sql).toContain('"service_bookings"."payment_status" <> $');
    });
  });

  describe("claimForAcceptance", () => {
    it("returns true when a row is claimed", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: "book-1" }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const result = await serviceBookingDAL.claimForAcceptance("book-1");

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: "processing" }),
      );
      // Claim only an acceptable booking that nobody else holds.
      const sql = whereSql(mockWhere.mock.calls[0][0]);
      expect(sql).toContain('"service_bookings"."status" in');
      expect(sql).toContain('"service_bookings"."payment_status" is null');
    });

    it("returns false when no row matches (already claimed or succeeded)", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const result = await serviceBookingDAL.claimForAcceptance("book-1");

      expect(result).toBe(false);
    });
  });

  describe("markExpired", () => {
    it("never expires a booking an accept call has claimed", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      await serviceBookingDAL.markExpired("book-1");

      // A claimed pending booking may already be charged; expiring it would
      // cancel a paid booking with no refund.
      expect(whereSql(mockWhere.mock.calls[0][0])).toContain(
        '"service_bookings"."payment_status" is null',
      );
    });
  });

  describe("findStaleProcessingBookings", () => {
    it("selects claims older than the threshold", async () => {
      const staleRow = {
        id: "book-1",
        status: "pending",
        updatedAt: new Date(),
      };
      const mockWhere = vi.fn().mockResolvedValue([staleRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const before = Date.now();
      const result = await serviceBookingDAL.findStaleProcessingBookings(15);

      expect(result).toEqual([staleRow]);
      const { sql, params } = new PgDialect().sqlToQuery(
        mockWhere.mock.calls[0][0] as SQL,
      );
      expect(sql).toContain('"service_bookings"."payment_status" = $');
      expect(sql).toContain('"service_bookings"."updated_at" <= $');
      expect(params).toContain("processing");
      // The timestamp column serializes the cutoff when the SQL is rendered.
      const cutoffMs = params
        .map((p) => new Date(p as string | Date).getTime())
        .find((ms) => !Number.isNaN(ms)) as number;
      expect(before - cutoffMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
      expect(before - cutoffMs).toBeLessThan(16 * 60 * 1000);
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
});
