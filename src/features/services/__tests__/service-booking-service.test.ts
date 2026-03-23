import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServiceBookingService } from "../services/service-booking-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";
import { calculateServiceFee } from "@/constants/payments";

const mockListingGetById = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingGetById = vi.fn();
const mockBookingUpdate = vi.fn();
const mockCreateNoShow = vi.fn();
const mockGetStripePm = vi.fn();
const mockGetUserById = vi.fn();
const mockAuditCreate = vi.fn();
const mockPaymentCreate = vi.fn();
const mockChargeServicePayment = vi.fn();
const mockProcessRefund = vi.fn();
const mockSendNotification = vi.fn();
const mockSendNewBooking = vi.fn();
const mockSendAccepted = vi.fn();
const mockSendDeclined = vi.fn();
const mockSendNoShowAdmin = vi.fn();
const mockSendJobCompleted = vi.fn();
const mockCaptureError = vi.fn();
const mockSendOpsAlert = vi.fn();
const mockGetPaymentErrorMessage = vi.fn();

vi.mock("@/dal", () => ({
  auditLogDAL: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  paymentDAL: { createPayment: (...a: unknown[]) => mockPaymentCreate(...a) },
  serviceBookingDAL: {
    create: (...a: unknown[]) => mockBookingCreate(...a),
    getById: (...a: unknown[]) => mockBookingGetById(...a),
    update: (...a: unknown[]) => mockBookingUpdate(...a),
    createNoShowReport: (...a: unknown[]) => mockCreateNoShow(...a),
  },
  serviceListingDAL: { getById: (...a: unknown[]) => mockListingGetById(...a) },
  userDAL: {
    getUserById: (...a: unknown[]) => mockGetUserById(...a),
    getStripeCustomerAndDefaultPaymentMethod: (...a: unknown[]) =>
      mockGetStripePm(...a),
  },
}));

vi.mock("@/services/stripe/service-payments", () => ({
  chargeServicePayment: (...a: unknown[]) => mockChargeServicePayment(...a),
}));

vi.mock("@/services/stripe/refund", () => ({
  processRefund: (...a: unknown[]) => mockProcessRefund(...a),
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  getPaymentErrorMessage: (...a: unknown[]) => mockGetPaymentErrorMessage(...a),
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...a: unknown[]) => mockCaptureError(...a),
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...a: unknown[]) => mockSendOpsAlert(...a),
}));

vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendNewBookingRequestNotification: (...a: unknown[]) =>
    mockSendNewBooking(...a),
  sendBookingAcceptedNotification: (...a: unknown[]) => mockSendAccepted(...a),
  sendBookingDeclinedNotification: (...a: unknown[]) => mockSendDeclined(...a),
  sendJobCompletedNotification: (...a: unknown[]) => mockSendJobCompleted(...a),
  sendNoShowReportAdminNotification: (...a: unknown[]) =>
    mockSendNoShowAdmin(...a),
}));

const listingActive = {
  id: "list-1",
  status: "active" as const,
  providerId: "prov-1",
  communityId: "comm-1",
  pricingType: "fixed" as const,
  price: "100.00",
  category: { id: "c", name: "n", description: null },
  provider: {
    id: "prov-1",
    firstName: "P",
    lastName: "Q",
    profileImageUrl: null,
    email: "p@q.com",
  },
};

const bookingPending = {
  id: "book-1",
  listingId: "list-1",
  requesterId: "req-1",
  providerId: "prov-1",
  communityId: "comm-1",
  proposedDate: "2025-06-15",
  proposedTime: "10:00",
  hours: null,
  notes: null,
  declineReason: null,
  servicePrice: "100.00",
  serviceFee: "10.00",
  totalAmount: "110.00",
  status: "pending" as const,
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
  createdAt: new Date(),
  updatedAt: new Date(),
  listing: {} as never,
  requester: {} as never,
  provider: {} as never,
};

const ctx = { ipAddress: "127.0.0.1", userAgent: "vitest" };

describe("ServiceBookingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPaymentErrorMessage.mockReturnValue("card declined");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createBooking", () => {
    const form = {
      listingId: "list-1",
      proposedDate: "2025-07-01",
      proposedTime: "09:00",
      notes: null as string | null,
    };

    it("throws NotFoundError when listing is not active", async () => {
      mockListingGetById.mockResolvedValue(null);

      await expect(
        ServiceBookingService.createBooking(form, "req-1", ctx),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when requester is the provider", async () => {
      mockListingGetById.mockResolvedValue(listingActive);

      await expect(
        ServiceBookingService.createBooking(form, "prov-1", ctx),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ValidationError when requester has no default payment method", async () => {
      mockListingGetById.mockResolvedValue(listingActive);
      mockGetStripePm.mockResolvedValue(null);

      await expect(
        ServiceBookingService.createBooking(form, "req-1", ctx),
      ).rejects.toThrow(ValidationError);
    });

    it("creates booking and notifies provider", async () => {
      mockListingGetById.mockResolvedValue(listingActive);
      mockGetStripePm.mockResolvedValue({
        customerId: "cus_1",
        paymentMethodId: "pm_1",
      });
      mockBookingCreate.mockResolvedValue(bookingPending);

      const booking = await ServiceBookingService.createBooking(
        form,
        "req-1",
        ctx,
      );

      expect(booking.id).toBe("book-1");
      expect(mockSendNewBooking).toHaveBeenCalledWith("prov-1", bookingPending);
      expect(mockAuditCreate).toHaveBeenCalled();
    });

    it("does not call Stripe during createBooking", async () => {
      mockListingGetById.mockResolvedValue(listingActive);
      mockGetStripePm.mockResolvedValue({
        customerId: "cus_1",
        paymentMethodId: "pm_1",
      });
      mockBookingCreate.mockResolvedValue(bookingPending);

      await ServiceBookingService.createBooking(form, "req-1", ctx);

      expect(mockChargeServicePayment).not.toHaveBeenCalled();
    });

    it("stores servicePrice, serviceFee, totalAmount using calculateServiceFee for fixed price", async () => {
      mockListingGetById.mockResolvedValue(listingActive);
      mockGetStripePm.mockResolvedValue({
        customerId: "cus_1",
        paymentMethodId: "pm_1",
      });
      mockBookingCreate.mockResolvedValue(bookingPending);

      await ServiceBookingService.createBooking(form, "req-1", ctx);

      const createArg = mockBookingCreate.mock.calls[0][0] as {
        servicePrice: string;
        serviceFee: string;
        totalAmount: string;
        status: string;
      };
      expect(createArg.status).toBe("pending");
      const sp = Number(createArg.servicePrice);
      const fee = Number(createArg.serviceFee);
      const total = Number(createArg.totalAmount);
      expect(fee).toBe(calculateServiceFee(sp));
      expect(total).toBe(Math.round((sp + fee) * 100) / 100);
    });

    it("creates hourly booking with hours and correct totals", async () => {
      const hourlyListing = {
        ...listingActive,
        pricingType: "hourly" as const,
        price: "25.00",
      };
      mockListingGetById.mockResolvedValue(hourlyListing);
      mockGetStripePm.mockResolvedValue({
        customerId: "cus_1",
        paymentMethodId: "pm_1",
      });
      mockBookingCreate.mockResolvedValue({
        ...bookingPending,
        hours: "2",
      });

      await ServiceBookingService.createBooking(
        {
          listingId: "list-1",
          proposedDate: "2025-07-01",
          proposedTime: "09:00",
          hours: 2,
          notes: null,
        },
        "req-1",
        ctx,
      );

      const createArg = mockBookingCreate.mock.calls[0][0] as {
        hours: string | null;
        servicePrice: string;
      };
      expect(createArg.hours).toBe("2");
      expect(Number(createArg.servicePrice)).toBe(50);
    });
  });

  describe("acceptBooking", () => {
    it("rejects when caller is not the provider", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);

      await expect(
        ServiceBookingService.acceptBooking("book-1", "wrong-user", ctx),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejects when booking is not pending", async () => {
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        status: "accepted",
      });

      await expect(
        ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
      ).rejects.toThrow(ValidationError);
    });

    it("charges and sets accepted on success", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
      });
      mockGetStripePm.mockResolvedValue({
        customerId: "cus",
        paymentMethodId: "pm",
      });
      mockChargeServicePayment.mockResolvedValue({
        paymentIntent: { id: "pi_1", status: "succeeded" },
        chargeId: "ch_1",
      });
      const accepted = { ...bookingPending, status: "accepted" as const };
      mockBookingUpdate.mockResolvedValue(accepted);

      const out = await ServiceBookingService.acceptBooking(
        "book-1",
        "prov-1",
        ctx,
      );

      expect(mockChargeServicePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "service-charge-book-1",
          metadata: expect.objectContaining({
            paymentType: "service_charge",
            bookingId: "book-1",
          }),
        }),
      );
      expect(out.status).toBe("accepted");
      expect(mockSendAccepted).toHaveBeenCalled();
      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentType: "service_charge",
          status: "succeeded",
        }),
      );
    });

    it("sets payment_failed and notifies both parties on charge error", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
      });
      mockGetStripePm.mockResolvedValue({
        customerId: "cus",
        paymentMethodId: "pm",
      });
      mockChargeServicePayment.mockRejectedValue(new Error("fail"));
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "payment_failed",
      });

      await expect(
        ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
      ).rejects.toThrow("fail");

      expect(mockBookingUpdate).toHaveBeenCalledWith(
        "book-1",
        expect.objectContaining({ status: "payment_failed" }),
      );
      expect(mockSendNotification).toHaveBeenCalled();
      expect(mockSendNotification.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("completeBooking", () => {
    it("sets completed, payout pending, and notifies requester", async () => {
      const accepted = { ...bookingPending, status: "accepted" as const };
      mockBookingGetById.mockResolvedValue(accepted);
      const completed = {
        ...accepted,
        status: "completed" as const,
        completedAt: new Date(),
        payoutStatus: "pending" as const,
      };
      mockBookingUpdate.mockResolvedValue(completed);

      const out = await ServiceBookingService.completeBooking(
        "book-1",
        "prov-1",
        ctx,
      );

      expect(out.status).toBe("completed");
      expect(mockSendJobCompleted).toHaveBeenCalledWith("req-1", completed);
    });
  });

  describe("cancelBooking", () => {
    it("cancels pending booking without Stripe refund", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "cancelled",
      });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "n", ctx);

      expect(mockProcessRefund).not.toHaveBeenCalled();
    });

    const accepted = {
      ...bookingPending,
      status: "accepted" as const,
      stripeChargeId: "ch_1",
      requesterId: "req-1",
      providerId: "prov-1",
      totalAmount: "100.00",
      proposedDate: "2025-12-20",
      proposedTime: "14:00",
      listing: {} as never,
      requester: {} as never,
      provider: {} as never,
    };

    it("uses 100% refund for requester when more than 24h before proposed start", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-18T12:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockProcessRefund.mockResolvedValue({
        success: true,
        refundId: "re_1",
      });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 10000 }),
      );
    });

    it("uses 50% refund for requester within 24h of proposed start", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-20T13:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockProcessRefund.mockResolvedValue({
        success: true,
        refundId: "re_1",
      });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 5000 }),
      );
    });

    it("uses 100% refund when provider cancels", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-20T13:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockProcessRefund.mockResolvedValue({
        success: true,
        refundId: "re_1",
      });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "prov-1", "bye", ctx);

      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 10000 }),
      );
    });
  });

  describe("declineBooking", () => {
    it("requires a trimmed reason", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);

      await expect(
        ServiceBookingService.declineBooking("book-1", "prov-1", "  ", ctx),
      ).rejects.toThrow(ValidationError);
    });

    it("sets declined and notifies requester", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);
      const declined = { ...bookingPending, status: "declined" as const };
      mockBookingUpdate.mockResolvedValue(declined);

      const out = await ServiceBookingService.declineBooking(
        "book-1",
        "prov-1",
        "busy",
        ctx,
      );

      expect(out.status).toBe("declined");
      expect(mockSendDeclined).toHaveBeenCalledWith("req-1", declined, "busy");
    });
  });

  describe("reportNoShow", () => {
    it("creates report and notifies admin", async () => {
      const accepted = {
        ...bookingPending,
        status: "accepted" as const,
        listing: {} as never,
        requester: {} as never,
        provider: {} as never,
      };
      mockBookingGetById.mockResolvedValue(accepted);
      const report = { id: "ns-1", bookingId: "book-1", reportedBy: "req-1" };
      mockCreateNoShow.mockResolvedValue(report);

      const out = await ServiceBookingService.reportNoShow(
        "book-1",
        "req-1",
        "n",
      );

      expect(out).toEqual(report);
      expect(mockSendNoShowAdmin).toHaveBeenCalledWith(report, accepted);
    });
  });
});
