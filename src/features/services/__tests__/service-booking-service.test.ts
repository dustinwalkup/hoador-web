import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServiceBookingService } from "../services/service-booking-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";
import { calculateServiceFee } from "@/constants/payments";

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => fn(),
}));

const mockCloseNeedsFulfilledByBooking = vi.fn();
vi.mock(
  "@/features/neighborhood-needs/services/neighborhood-needs-service",
  () => ({
    closeNeedsFulfilledByBooking: (...args: unknown[]) =>
      mockCloseNeedsFulfilledByBooking(...args),
  }),
);

const mockListingGetById = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingGetById = vi.fn();
const mockBookingUpdate = vi.fn();
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
const mockSendJobCompleted = vi.fn();
const mockCaptureError = vi.fn();
const mockSendOpsAlert = vi.fn();
const mockGetPaymentErrorMessage = vi.fn();
const mockLifecycleCreate = vi.fn();
const mockLifecycleUpdatePayout = vi.fn();
const mockLifecycleGetByBookingId = vi.fn();
const mockLifecycleMarkCancelled = vi.fn();
const mockLifecycleUpdateOwnerTransfer = vi.fn();
const mockCreateServiceTransfer = vi.fn();

const { mockLegalGetAllVersions } = vi.hoisted(() => ({
  mockLegalGetAllVersions: vi.fn(),
}));

vi.mock("@/dal", () => ({
  auditLogDAL: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  disputeDAL: {
    getActiveByServiceBookingId: vi.fn().mockResolvedValue(null),
  },
  legalDocumentDAL: {
    getAllCurrentVersions: (...a: unknown[]) => mockLegalGetAllVersions(...a),
  },
  paymentDAL: { createPayment: (...a: unknown[]) => mockPaymentCreate(...a) },
  serviceBookingDAL: {
    create: (...a: unknown[]) => mockBookingCreate(...a),
    getById: (...a: unknown[]) => mockBookingGetById(...a),
    update: (...a: unknown[]) => mockBookingUpdate(...a),
  },
  serviceListingDAL: { getById: (...a: unknown[]) => mockListingGetById(...a) },
  servicePaymentLifecycleDAL: {
    create: (...a: unknown[]) => mockLifecycleCreate(...a),
    updatePayoutStatus: (...a: unknown[]) => mockLifecycleUpdatePayout(...a),
    getByBookingId: (...a: unknown[]) => mockLifecycleGetByBookingId(...a),
    markCancelled: (...a: unknown[]) => mockLifecycleMarkCancelled(...a),
    updateOwnerTransferStatus: (...a: unknown[]) =>
      mockLifecycleUpdateOwnerTransfer(...a),
  },
  userDAL: {
    getUserById: (...a: unknown[]) => mockGetUserById(...a),
    updateConnectOnboardingStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/stripe/payment-method", () => ({
  getStripeCustomerContext: (...a: unknown[]) => mockGetStripePm(...a),
}));

vi.mock("@/services/stripe/service-payments", () => ({
  chargeServicePayment: (...a: unknown[]) => mockChargeServicePayment(...a),
  createServiceTransfer: (...a: unknown[]) => mockCreateServiceTransfer(...a),
}));

vi.mock("@/services/stripe/refund", () => ({
  processRefund: (...a: unknown[]) => mockProcessRefund(...a),
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  getPaymentErrorMessage: (...a: unknown[]) => mockGetPaymentErrorMessage(...a),
  isRetryablePaymentError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/services/stripe/connect", () => ({
  getAccountStatus: vi
    .fn()
    .mockResolvedValue({ chargesEnabled: true, payoutsEnabled: true }),
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
  selectedPaymentMethodId: null as string | null,
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
    mockLegalGetAllVersions.mockResolvedValue({});
    mockLifecycleCreate.mockResolvedValue({});
    mockLifecycleGetByBookingId.mockResolvedValue(null);
    mockCloseNeedsFulfilledByBooking.mockResolvedValue(undefined);
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
      serviceAgreementAccepted: true,
      cancellationRefundAcknowledged: true,
      safetyLiabilityAccepted: true,
      paymentPayoutAccepted: true,
      platformTermsAccepted: true,
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

    it("stores selectedPaymentMethodId when form includes paymentMethodId", async () => {
      mockListingGetById.mockResolvedValue(listingActive);
      mockGetStripePm.mockResolvedValue({
        customerId: "cus_1",
        paymentMethodId: "pm_default",
      });
      mockBookingCreate.mockResolvedValue(bookingPending);

      await ServiceBookingService.createBooking(
        { ...form, paymentMethodId: "pm_user_selected" },
        "req-1",
        ctx,
      );

      const createArg = mockBookingCreate.mock.calls[0][0] as {
        selectedPaymentMethodId: string | null;
      };
      expect(createArg.selectedPaymentMethodId).toBe("pm_user_selected");
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
          serviceAgreementAccepted: true,
          cancellationRefundAcknowledged: true,
          safetyLiabilityAccepted: true,
          paymentPayoutAccepted: true,
          platformTermsAccepted: true,
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

    it("does not charge Stripe on a duplicate acceptance attempt (UAT-SVC-26)", async () => {
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        status: "accepted" as const,
        stripePaymentIntentId: "pi_already_captured",
        stripeChargeId: "ch_already_captured",
      });

      await expect(
        ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
      ).rejects.toThrow(ValidationError);

      expect(mockChargeServicePayment).not.toHaveBeenCalled();
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
      expect(mockLifecycleCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "book-1",
          chargeId: "ch_1",
          providerPayout: "80",
          payoutStatus: "pending",
        }),
      );
    });

    it("charges selectedPaymentMethodId from booking over Stripe default", async () => {
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        selectedPaymentMethodId: "pm_from_booking",
      });
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
      });
      mockGetStripePm.mockResolvedValue({
        customerId: "cus",
        paymentMethodId: "pm_default",
      });
      mockChargeServicePayment.mockResolvedValue({
        paymentIntent: { id: "pi_1", status: "succeeded" },
        chargeId: "ch_1",
      });
      const accepted = { ...bookingPending, status: "accepted" as const };
      mockBookingUpdate.mockResolvedValue(accepted);

      await ServiceBookingService.acceptBooking("book-1", "prov-1", ctx);

      expect(mockChargeServicePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "cus",
          paymentMethodId: "pm_from_booking",
        }),
      );
      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethodId: "pm_from_booking",
        }),
      );
    });

    it("uses retry idempotency key when booking status is payment_failed", async () => {
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        status: "payment_failed" as const,
      });
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

      await ServiceBookingService.acceptBooking("book-1", "prov-1", ctx);

      expect(mockChargeServicePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(
            /^service-charge-book-1-retry-\d+$/,
          ),
        }),
      );
      expect(mockSendAccepted).toHaveBeenCalled();
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
      ).rejects.toThrow(/could not process the requester's payment/i);

      expect(mockBookingUpdate).toHaveBeenCalledWith(
        "book-1",
        expect.objectContaining({ status: "payment_failed" }),
      );
      expect(mockSendNotification).toHaveBeenCalled();
      expect(mockSendNotification.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("dates the acceptance, and only after the charge succeeded (P-E9-4)", async () => {
      // `accepted_at` did not exist until 2026-08-31 — the rental side has had
      // `approvedAt` since its schema was written, and services were missed.
      // Without it the booking Timeline (mobile Req 5.7.6) cannot date the one
      // transition a service booking turns on.
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
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "accepted" as const,
      });

      await ServiceBookingService.acceptBooking("book-1", "prov-1", ctx);

      const [, patch] = mockBookingUpdate.mock.calls[0];
      expect(patch.status).toBe("accepted");
      expect(patch.acceptedAt).toBeInstanceOf(Date);
      expect(patch.declinedAt).toBeUndefined();
    });

    it("does not date an acceptance that failed to charge", async () => {
      // The timestamp belongs to the transition, not the attempt: a booking
      // sitting in `payment_failed` was never accepted, and a Timeline that
      // dated it would say the client was charged when they were not.
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
      ).rejects.toThrow();

      const [, patch] = mockBookingUpdate.mock.calls[0];
      expect(patch.status).toBe("payment_failed");
      expect(patch.acceptedAt).toBeUndefined();
    });

    it("records the card that failed, so the guard has something true to compare (F12)", async () => {
      // The guard's whole job is "do not re-charge a card we know is dead". It
      // compared the current default against the card chosen at BOOKING time —
      // a field nothing ever updated — so it worked once and then stopped.
      mockBookingGetById.mockResolvedValue(bookingPending);
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
      });
      mockGetStripePm.mockResolvedValue({
        customerId: "cus",
        paymentMethodId: "pm_default",
      });
      mockChargeServicePayment.mockRejectedValue(new Error("declined"));
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "payment_failed",
      });

      await expect(
        ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
      ).rejects.toThrow();

      const [, patch] = mockBookingUpdate.mock.calls[0];
      expect(patch.selectedPaymentMethodId).toBe("pm_default");
    });

    it("records the CHOSEN card when that is the one that failed", async () => {
      // A client who picked a non-default card: the attempt used their choice,
      // so that is the card the guard must remember.
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        selectedPaymentMethodId: "pm_chosen",
      });
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
      });
      mockGetStripePm.mockResolvedValue({
        customerId: "cus",
        paymentMethodId: "pm_default",
      });
      mockChargeServicePayment.mockRejectedValue(new Error("declined"));
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "payment_failed",
      });

      await expect(
        ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
      ).rejects.toThrow();

      const [, patch] = mockBookingUpdate.mock.calls[0];
      expect(patch.selectedPaymentMethodId).toBe("pm_chosen");
      // And the charge really was on the chosen card, not the default.
      expect(mockChargeServicePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethodId: "pm_chosen" }),
      );
    });

    it("refuses a retry against the card that just failed (F12)", async () => {
      // Previously reachable in two ways the guard could not see: a booking
      // made with no explicit card (the field was null, so the `!= null` check
      // skipped the guard entirely), and any second retry after a fallback to
      // the default had itself failed.
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        status: "payment_failed" as const,
        selectedPaymentMethodId: "pm_default",
      });
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
      });
      mockGetStripePm.mockResolvedValue({
        customerId: "cus",
        paymentMethodId: "pm_default",
      });

      await expect(
        ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
      ).rejects.toThrow(/Payment method is unchanged/);

      // Refused BEFORE Stripe — a repeated decline on a card the issuer has
      // already rejected is what trips fraud flags.
      expect(mockChargeServicePayment).not.toHaveBeenCalled();
    });

    it("allows the retry once the client has actually changed their card", async () => {
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        status: "payment_failed" as const,
        selectedPaymentMethodId: "pm_dead",
      });
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
      });
      mockGetStripePm.mockResolvedValue({
        customerId: "cus",
        paymentMethodId: "pm_new",
      });
      mockChargeServicePayment.mockResolvedValue({
        paymentIntent: { id: "pi_1", status: "succeeded" },
        chargeId: "ch_1",
      });
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "accepted" as const,
      });

      await ServiceBookingService.acceptBooking("book-1", "prov-1", ctx);

      expect(mockChargeServicePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethodId: "pm_new" }),
      );
    });

    describe("Stripe Connect gating", () => {
      it("throws PaymentSetupRequiredError with not_started when provider has no Stripe Connect account", async () => {
        mockBookingGetById.mockResolvedValue(bookingPending);
        mockGetUserById.mockResolvedValue({
          stripeConnectedAccountId: null,
          connectChargesEnabled: false,
          connectPayoutsEnabled: false,
          connectOnboardingComplete: false,
        });

        await expect(
          ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
        ).rejects.toMatchObject({
          code: "PAYMENT_SETUP_REQUIRED",
          details: {
            onboardingStatus: "not_started",
            missingCapabilities: ["charges", "payouts"],
          },
        });
        // Booking state SHALL NOT change when the gate throws.
        expect(mockBookingUpdate).not.toHaveBeenCalled();
        expect(mockChargeServicePayment).not.toHaveBeenCalled();
      });

      it("throws with pending when account exists but capabilities are off", async () => {
        mockBookingGetById.mockResolvedValue(bookingPending);
        mockGetUserById.mockResolvedValue({
          stripeConnectedAccountId: "acct_123",
          connectChargesEnabled: false,
          connectPayoutsEnabled: false,
          connectOnboardingComplete: false,
        });

        await expect(
          ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
        ).rejects.toMatchObject({
          code: "PAYMENT_SETUP_REQUIRED",
          details: { onboardingStatus: "pending" },
        });
        expect(mockChargeServicePayment).not.toHaveBeenCalled();
      });

      it("throws with restricted when payouts capability is off", async () => {
        mockBookingGetById.mockResolvedValue(bookingPending);
        mockGetUserById.mockResolvedValue({
          stripeConnectedAccountId: "acct_123",
          connectChargesEnabled: true,
          connectPayoutsEnabled: false,
          connectOnboardingComplete: true,
        });

        await expect(
          ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
        ).rejects.toMatchObject({
          code: "PAYMENT_SETUP_REQUIRED",
          details: {
            onboardingStatus: "restricted",
            missingCapabilities: ["payouts"],
          },
        });
      });

      it("throws with regression when live retrieve shows capability loss after cached said verified", async () => {
        mockBookingGetById.mockResolvedValue(bookingPending);
        mockGetUserById.mockResolvedValue({
          stripeConnectedAccountId: "acct_123",
          connectChargesEnabled: true,
          connectPayoutsEnabled: true,
          connectOnboardingComplete: true,
        });
        const { getAccountStatus } = await import("@/services/stripe/connect");
        vi.mocked(getAccountStatus).mockResolvedValueOnce({
          chargesEnabled: true,
          payoutsEnabled: false,
        });

        await expect(
          ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
        ).rejects.toMatchObject({
          code: "PAYMENT_SETUP_REQUIRED",
          details: {
            onboardingStatus: "restricted",
            missingCapabilities: ["payouts"],
          },
        });
        expect(mockChargeServicePayment).not.toHaveBeenCalled();
      });

      it("throws with reason=stripe_unreachable when live retrieve fails", async () => {
        mockBookingGetById.mockResolvedValue(bookingPending);
        mockGetUserById.mockResolvedValue({
          stripeConnectedAccountId: "acct_123",
          connectChargesEnabled: true,
          connectPayoutsEnabled: true,
          connectOnboardingComplete: true,
        });
        const { getAccountStatus } = await import("@/services/stripe/connect");
        vi.mocked(getAccountStatus).mockRejectedValueOnce(
          new Error("non-transient"),
        );

        await expect(
          ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
        ).rejects.toMatchObject({
          code: "PAYMENT_SETUP_REQUIRED",
          details: {
            onboardingStatus: "unknown",
            reason: "stripe_unreachable",
          },
        });
      });
    });
  });

  describe("completeBooking", () => {
    it("sets completed, payout pending on lifecycle, and notifies requester", async () => {
      const accepted = { ...bookingPending, status: "accepted" as const };
      mockBookingGetById.mockResolvedValue(accepted);
      const completed = {
        ...accepted,
        status: "completed" as const,
        completedAt: new Date(),
      };
      mockBookingUpdate.mockResolvedValue(completed);

      const out = await ServiceBookingService.completeBooking(
        "book-1",
        "prov-1",
        ctx,
      );

      expect(out.status).toBe("completed");
      expect(mockLifecycleUpdatePayout).toHaveBeenCalledWith(
        "book-1",
        "pending",
      );
      expect(mockSendJobCompleted).toHaveBeenCalledWith("req-1", completed);
    });
  });

  describe("cancelBooking", () => {
    beforeEach(() => {
      // Default: provider has no connected account so no transfer is attempted
      mockGetUserById.mockResolvedValue(null);
    });

    it("cancels pending booking without Stripe refund", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "cancelled",
      });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "n", ctx);

      expect(mockProcessRefund).not.toHaveBeenCalled();
      expect(mockLifecycleMarkCancelled).not.toHaveBeenCalled();
    });

    const accepted = {
      ...bookingPending,
      status: "accepted" as const,
      stripeChargeId: "ch_1",
      requesterId: "req-1",
      providerId: "prov-1",
      servicePrice: "100.00",
      serviceFee: "3.30",
      totalAmount: "103.30",
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
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({
        success: true,
        refundId: "re_1",
      });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      expect(mockLifecycleMarkCancelled).toHaveBeenCalledWith("book-1");
      // Full refund uses totalAmount (service fee refunded)
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 10330 }),
      );
    });

    it("reads the job time in the MARKET zone, not the server's (F4)", async () => {
      // The regression the timezone fix exists for, placed in the six-hour
      // window where the old and new implementations disagree.
      //
      // The job is 14:00 on Dec 20 in Chicago = 20:00Z (CST, UTC-6). At
      // 17:00Z on Dec 19 the client is **27 real hours** from it, so Req
      // 11.1.5 gives them a full refund.
      //
      // The old code parsed the wall clock as server-local — UTC in CI and on
      // Vercel — making the job 14:00Z, putting the client 21 hours out and
      // charging them the 50% tier. It was correct in UTC, so every existing
      // test here passed straight through it.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-19T17:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      // 10330 (the full total) — NOT 5000, which is what the bug charged.
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 10330 }),
      );
      // And no provider transfer, because nothing was retained.
      expect(mockCreateServiceTransfer).not.toHaveBeenCalled();
    });

    it("uses 50% refund for requester within 24h of proposed start", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-20T13:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({
        success: true,
        refundId: "re_1",
      });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      expect(mockLifecycleMarkCancelled).toHaveBeenCalledWith("book-1");
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 5000 }),
      );
    });

    it("uses 100% refund when provider cancels", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-20T13:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({
        success: true,
        refundId: "re_1",
      });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "prov-1", "bye", ctx);

      expect(mockLifecycleMarkCancelled).toHaveBeenCalledWith("book-1");
      // Full refund uses totalAmount (service fee refunded when provider cancels)
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 10330 }),
      );
    });

    it("50% refund is based on servicePrice, not totalAmount — service fee excluded", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-20T13:00:00Z"));

      // servicePrice: $100.00, serviceFee: $3.30, totalAmount: $103.30
      mockBookingGetById.mockResolvedValue(accepted);
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      // 50% of $100 servicePrice = $50 (5000 cents), NOT 50% of $103.30 = $51.65
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountCents: 5000 }),
      );
    });

    it("transfers 30% of servicePrice to provider when requester cancels within 24h", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-20T13:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct_provider",
      });
      mockCreateServiceTransfer.mockResolvedValue({
        success: true,
        transferId: "tr_1",
      });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      // Provider gets retained 50% minus 20% platform fee = 30% of $100 = $30
      expect(mockCreateServiceTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "service-cancel-transfer-book-1",
          chargeId: "ch_1",
          providerConnectedAccountId: "acct_provider",
          providerPayoutAmount: 30,
        }),
      );
      expect(mockLifecycleUpdateOwnerTransfer).toHaveBeenCalledWith(
        "book-1",
        "completed",
        expect.objectContaining({ stripeTransferId: "tr_1" }),
      );
    });

    it("sends ops alert when provider transfer fails but cancellation still succeeds", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-20T13:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });
      mockGetUserById.mockResolvedValue({
        stripeConnectedAccountId: "acct_provider",
      });
      mockCreateServiceTransfer.mockResolvedValue({
        success: false,
        error: "Connect account deactivated",
      });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      expect(mockSendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "service_booking_cancel_transfer_failed",
          serviceBookingId: "book-1",
          sendEmailAlert: true,
        }),
      );
      // Booking was still cancelled
      expect(mockBookingUpdate).toHaveBeenCalledWith(
        "book-1",
        expect.objectContaining({ status: "cancelled" }),
      );
    });

    it("does not transfer to provider when requester cancels more than 24h before", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-18T12:00:00Z"));

      mockBookingGetById.mockResolvedValue(accepted);
      mockLifecycleGetByBookingId.mockResolvedValue({ id: "spl-1" });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockBookingUpdate.mockResolvedValue({ ...accepted, status: "cancelled" });

      await ServiceBookingService.cancelBooking("book-1", "req-1", "bye", ctx);

      expect(mockCreateServiceTransfer).not.toHaveBeenCalled();
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

    it("dates the decline (P-E9-4)", async () => {
      mockBookingGetById.mockResolvedValue(bookingPending);
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "declined" as const,
      });

      await ServiceBookingService.declineBooking(
        "book-1",
        "prov-1",
        "busy",
        ctx,
      );

      const [, patch] = mockBookingUpdate.mock.calls[0];
      expect(patch.status).toBe("declined");
      expect(patch.declinedAt).toBeInstanceOf(Date);
      expect(patch.acceptedAt).toBeUndefined();
    });

    it("declines when status is payment_failed", async () => {
      mockBookingGetById.mockResolvedValue({
        ...bookingPending,
        status: "payment_failed" as const,
      });
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

  describe("acceptBooking — closeNeedsFulfilledByBooking (Phase 11)", () => {
    beforeEach(() => {
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
      mockBookingUpdate.mockResolvedValue({
        ...bookingPending,
        status: "accepted" as const,
      });
    });

    it("calls closeNeedsFulfilledByBooking with service listingId and requesterId on success", async () => {
      await ServiceBookingService.acceptBooking("book-1", "prov-1", ctx);

      expect(mockCloseNeedsFulfilledByBooking).toHaveBeenCalledWith({
        listingType: "service",
        listingId: "list-1",
        bookerUserId: "req-1",
      });
    });

    it("does not fail the acceptance when closeNeedsFulfilledByBooking throws", async () => {
      mockCloseNeedsFulfilledByBooking.mockRejectedValue(
        new Error("needs error"),
      );

      const out = await ServiceBookingService.acceptBooking(
        "book-1",
        "prov-1",
        ctx,
      );

      expect(out.status).toBe("accepted");
    });
  });
});
