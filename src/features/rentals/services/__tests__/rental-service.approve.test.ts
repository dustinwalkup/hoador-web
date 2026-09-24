import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const mockGetRentalRequestById = vi.fn();
const mockClaimRentalRequestPaymentProcessing = vi.fn();
const mockUpdateRentalRequestPaymentStatus = vi.fn();
const mockUpdateRentalRequestPaymentMethod = vi.fn();
const mockApproveRentalRequest = vi.fn();
const mockGetRentalByRequestId = vi.fn();
const mockGetOrCreateStripeCustomerId = vi.fn();
const mockGetUserById = vi.fn();
const mockIsActiveAccount = vi.fn().mockResolvedValue(true);
const mockAuditLogCreate = vi.fn();
const mockCreatePayment = vi.fn();
const mockLifecycleCreate = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();
const mockGetApprovedRentalCountForRenter = vi.fn();

vi.mock("@/dal", () => ({
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditLogCreate(...args),
  },
  legalDocumentDAL: {},
  listingDAL: {},
  paymentDAL: {
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
  },
  paymentLifecycleDAL: {
    create: (...args: unknown[]) => mockLifecycleCreate(...args),
    updateDepositHoldStatus: (...args: unknown[]) =>
      mockUpdateDepositHoldStatus(...args),
  },
  rentalDAL: {
    getRentalRequestById: (...args: unknown[]) =>
      mockGetRentalRequestById(...args),
    claimRentalRequestPaymentProcessing: (...args: unknown[]) =>
      mockClaimRentalRequestPaymentProcessing(...args),
    updateRentalRequestPaymentStatus: (...args: unknown[]) =>
      mockUpdateRentalRequestPaymentStatus(...args),
    updateRentalRequestPaymentMethod: (...args: unknown[]) =>
      mockUpdateRentalRequestPaymentMethod(...args),
    approveRentalRequest: (...args: unknown[]) =>
      mockApproveRentalRequest(...args),
    getRentalByRequestId: (...args: unknown[]) =>
      mockGetRentalByRequestId(...args),
    getApprovedRentalCountForRenter: (...args: unknown[]) =>
      mockGetApprovedRentalCountForRenter(...args),
  },
  userDAL: {
    getOrCreateStripeCustomerId: (...args: unknown[]) =>
      mockGetOrCreateStripeCustomerId(...args),
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
    isActiveAccount: (...args: unknown[]) => mockIsActiveAccount(...args),
  },
}));

const mockChargeRentalPayment = vi.fn();
vi.mock("@/services/stripe/rental-payments", () => ({
  chargeRentalPayment: (...args: unknown[]) => mockChargeRentalPayment(...args),
  getPaymentErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Payment failed",
  isRetryablePaymentError: () => false,
}));

const mockPlaceDepositHold = vi.fn();
vi.mock("@/services/stripe/deposit-hold", () => ({
  placeDepositHold: (...args: unknown[]) => mockPlaceDepositHold(...args),
}));

const mockAssertConnectReady = vi.fn();
vi.mock("@/features/payments/lib/assert-connect-ready", () => ({
  assertConnectReady: (...args: unknown[]) => mockAssertConnectReady(...args),
}));

vi.mock("@/lib/integrations/meta/meta-capi", () => ({
  sendMetaPurchase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

vi.mock("@/features/rentals/notifications/payment-failure", () => ({
  sendPaymentFailureNotificationToOwner: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailureNotificationToRenter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/rentals/notifications/payment-succeeded", () => ({
  sendPaymentSucceededNotificationToOwner: vi.fn().mockResolvedValue(undefined),
  sendPaymentSucceededNotificationToRenter: vi
    .fn()
    .mockResolvedValue(undefined),
}));

vi.mock("@/features/rentals/notifications/rental-approved", () => ({
  sendRentalApprovedNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/rentals/notifications/rental-request-created", () => ({
  sendRentalRequestCreatedNotification: vi.fn().mockResolvedValue(undefined),
}));

const mockSendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

const mockCaptureNonCriticalError = vi.fn();
vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...args: unknown[]) =>
    mockCaptureNonCriticalError(...args),
}));

vi.mock("next/server", () => ({
  after: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

import { RentalService } from "../rental-service";
import {
  CounterpartyUnavailableError,
  RentalRequestNotPendingError,
} from "@/dal/errors";

// --- Helpers ---
function createMockRentalRequest(overrides = {}) {
  return {
    id: "req-1",
    listingId: "listing-1",
    listingName: "Pressure Washer",
    ownerId: "owner-1",
    renterId: "renter-1",
    status: "pending",
    paymentStatus: "pending",
    paymentMethodId: "pm_123",
    totalAmount: "100.00",
    applicationFeeAmount: "20.00",
    securityDeposit: "0",
    startDate: new Date("2026-07-01"),
    endDate: new Date("2026-07-05"),
    ...overrides,
  };
}

const context = { ipAddress: "127.0.0.1", userAgent: "vitest" };

describe("RentalService.approveRentalRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsActiveAccount.mockResolvedValue(true);
    mockGetRentalRequestById.mockResolvedValue(createMockRentalRequest());
    mockGetOrCreateStripeCustomerId.mockResolvedValue("cus_123");
    mockAssertConnectReady.mockResolvedValue(undefined);
    mockAuditLogCreate.mockResolvedValue(undefined);
    mockApproveRentalRequest.mockResolvedValue(undefined);
    mockGetRentalByRequestId.mockResolvedValue({ id: "rental-1" });
    mockCreatePayment.mockResolvedValue(undefined);
    mockLifecycleCreate.mockResolvedValue(undefined);
  });

  // BIZ-01: cancel, decline and expiry never touch paymentStatus, so the
  // payment claim alone could not stop a stale owner screen charging a renter
  // for a request that no longer exists. Refused before anything reaches
  // Stripe, customer lookup included.
  it.each(["cancelled", "denied", "approved", "active"])(
    "refuses a %s request before any Stripe call",
    async (status) => {
      mockGetRentalRequestById.mockResolvedValue(
        createMockRentalRequest({ status, paymentStatus: "pending" }),
      );

      await expect(
        RentalService.approveRentalRequest("req-1", "owner-1", {}, context),
      ).rejects.toThrow(RentalRequestNotPendingError);

      expect(mockGetOrCreateStripeCustomerId).not.toHaveBeenCalled();
      expect(mockAssertConnectReady).not.toHaveBeenCalled();
      expect(mockClaimRentalRequestPaymentProcessing).not.toHaveBeenCalled();
      expect(mockChargeRentalPayment).not.toHaveBeenCalled();
      expect(mockPlaceDepositHold).not.toHaveBeenCalled();
      expect(mockApproveRentalRequest).not.toHaveBeenCalled();
    },
  );

  // BIZ-07: a renter who deleted their account (or is otherwise inactive) can
  // no longer see or dispute a charge. Refused before any Stripe work.
  it("refuses to charge a renter whose account is no longer active", async () => {
    mockIsActiveAccount.mockResolvedValue(false);

    await expect(
      RentalService.approveRentalRequest("req-1", "owner-1", {}, context),
    ).rejects.toThrow(CounterpartyUnavailableError);

    expect(mockIsActiveAccount).toHaveBeenCalledWith("renter-1");
    expect(mockGetOrCreateStripeCustomerId).not.toHaveBeenCalled();
    expect(mockClaimRentalRequestPaymentProcessing).not.toHaveBeenCalled();
    expect(mockChargeRentalPayment).not.toHaveBeenCalled();
  });

  // The claim re-checks atomically; if the renter went between the pre-check
  // and the claim, the owner is told why, not "already being processed".
  it("reports an account deleted between check and claim as unavailable", async () => {
    mockIsActiveAccount
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockClaimRentalRequestPaymentProcessing.mockResolvedValue(false);

    await expect(
      RentalService.approveRentalRequest("req-1", "owner-1", {}, context),
    ).rejects.toThrow(CounterpartyUnavailableError);
    expect(mockChargeRentalPayment).not.toHaveBeenCalled();
  });

  // An expired request is `cancelled` with reason expired_no_acceptance.
  it("refuses an expired request before any Stripe call", async () => {
    mockGetRentalRequestById.mockResolvedValue(
      createMockRentalRequest({
        status: "cancelled",
        cancellationReason: "expired_no_acceptance",
      }),
    );

    await expect(
      RentalService.approveRentalRequest("req-1", "owner-1", {}, context),
    ).rejects.toThrow(RentalRequestNotPendingError);
    expect(mockChargeRentalPayment).not.toHaveBeenCalled();
  });

  it("returns already-processing failure without charging when the claim is lost", async () => {
    mockClaimRentalRequestPaymentProcessing.mockResolvedValue(false);

    const result = await RentalService.approveRentalRequest(
      "req-1",
      "owner-1",
      {},
      context,
    );

    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.error).toContain("already being processed");
    expect(mockClaimRentalRequestPaymentProcessing).toHaveBeenCalledWith(
      "req-1",
    );
    expect(mockChargeRentalPayment).not.toHaveBeenCalled();
    expect(mockUpdateRentalRequestPaymentStatus).not.toHaveBeenCalled();
  });

  it("charges and approves when the claim is won (happy path)", async () => {
    mockClaimRentalRequestPaymentProcessing.mockResolvedValue(true);
    mockChargeRentalPayment.mockResolvedValue({
      id: "pi_123",
      status: "succeeded",
      latest_charge: "ch_123",
    });

    const result = await RentalService.approveRentalRequest(
      "req-1",
      "owner-1",
      {},
      context,
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.paymentIntentId).toBe("pi_123");
    expect(mockChargeRentalPayment).toHaveBeenCalledTimes(1);
    expect(mockChargeRentalPayment).toHaveBeenCalledWith(
      "cus_123",
      "pm_123",
      100,
      expect.objectContaining({ rentalRequestId: "req-1" }),
      "rental-charge-req-1",
    );
    expect(mockApproveRentalRequest).toHaveBeenCalledWith(
      "req-1",
      "owner-1",
      expect.objectContaining({ rentalPaymentIntentId: "pi_123" }),
    );
  });

  it("still approves when the post-charge audit log write fails", async () => {
    mockClaimRentalRequestPaymentProcessing.mockResolvedValue(true);
    mockChargeRentalPayment.mockResolvedValue({
      id: "pi_123",
      status: "succeeded",
      latest_charge: "ch_123",
    });
    mockAuditLogCreate.mockRejectedValue(new Error("audit insert failed"));

    const result = await RentalService.approveRentalRequest(
      "req-1",
      "owner-1",
      {},
      context,
    );

    // A throw here would strand the charged request in `processing`.
    expect(result.success).toBe(true);
    expect(mockApproveRentalRequest).toHaveBeenCalled();
    expect(mockCaptureNonCriticalError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: "audit_payment_captured" }),
    );
  });

  // There is deliberately no catch-all that resets paymentStatus to "failed"
  // after the claim: once the charge has succeeded, a reset would let a retry
  // charge again under a fresh Date.now() key. A claim left behind is surfaced
  // by the detect-stale-charge-claims cron instead.
});
