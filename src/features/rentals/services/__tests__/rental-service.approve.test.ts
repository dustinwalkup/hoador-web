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
  sendPaymentSucceededNotificationToOwner: vi
    .fn()
    .mockResolvedValue(undefined),
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

vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: vi.fn(),
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
    mockGetRentalRequestById.mockResolvedValue(createMockRentalRequest());
    mockGetOrCreateStripeCustomerId.mockResolvedValue("cus_123");
    mockAssertConnectReady.mockResolvedValue(undefined);
    mockAuditLogCreate.mockResolvedValue(undefined);
    mockApproveRentalRequest.mockResolvedValue(undefined);
    mockGetRentalByRequestId.mockResolvedValue({ id: "rental-1" });
    mockCreatePayment.mockResolvedValue(undefined);
    mockLifecycleCreate.mockResolvedValue(undefined);
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

  // Service test 3 from plan 005 (unexpected throw after the claim resets
  // paymentStatus to "failed") is intentionally absent: plan 005 Step 3 is
  // BLOCKED on its STOP condition 4 — see plans/README.md.
});
