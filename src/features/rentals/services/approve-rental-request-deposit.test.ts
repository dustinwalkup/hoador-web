import { describe, it, expect, vi, beforeEach } from "vitest";

const mockChargeRentalPayment = vi.fn();
const mockPlaceDepositHold = vi.fn();
vi.mock("@/services/stripe/rental-payments", () => ({
  chargeRentalPayment: (...args: unknown[]) => mockChargeRentalPayment(...args),
  getPaymentErrorMessage: vi.fn((err: unknown) => (err as Error)?.message),
  isRetryablePaymentError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/services/stripe/connect", () => ({
  getAccountStatus: vi
    .fn()
    .mockResolvedValue({ chargesEnabled: true, payoutsEnabled: true }),
}));

vi.mock("@/services/stripe/deposit-hold", () => ({
  placeDepositHold: (...args: unknown[]) => mockPlaceDepositHold(...args),
}));

const mockSendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

const mockSendPaymentSucceededToRenter = vi.fn().mockResolvedValue(undefined);
const mockSendPaymentSucceededToOwner = vi.fn().mockResolvedValue(undefined);
const mockSendRentalApproved = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/rentals/notifications/payment-succeeded", () => ({
  sendPaymentSucceededNotificationToRenter: (...args: unknown[]) =>
    mockSendPaymentSucceededToRenter(...args),
  sendPaymentSucceededNotificationToOwner: (...args: unknown[]) =>
    mockSendPaymentSucceededToOwner(...args),
}));
vi.mock("@/features/rentals/notifications/rental-approved", () => ({
  sendRentalApprovedNotification: (...args: unknown[]) =>
    mockSendRentalApproved(...args),
}));
vi.mock("@/features/rentals/notifications/payment-failure", () => ({
  sendPaymentFailureNotificationToRenter: vi.fn(),
  sendPaymentFailureNotificationToOwner: vi.fn(),
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: vi.fn(),
}));

const afterCallbacks: Array<Promise<void>> = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((cb: () => Promise<void>) => {
      afterCallbacks.push(cb());
    }),
  };
});

const mockGetRentalRequestById = vi.fn();
const mockApproveRentalRequest = vi.fn();
const mockGetRentalByRequestId = vi.fn();
const mockUpdateRentalRequestPaymentStatus = vi.fn();
const mockUpdateRentalRequestPaymentMethod = vi.fn();
const mockGetApprovedRentalCountForRenter = vi.fn();
const mockGetOrCreateStripeCustomerId = vi.fn();
const mockGetConnectedAccountId = vi.fn();
const mockIsConnectOnboardingComplete = vi.fn();
const mockPaymentCreate = vi.fn();
const mockPaymentLifecycleCreate = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockGetUserById = vi.fn();

vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: (...args: unknown[]) =>
      mockGetRentalRequestById(...args),
    approveRentalRequest: (...args: unknown[]) =>
      mockApproveRentalRequest(...args),
    getRentalByRequestId: (...args: unknown[]) =>
      mockGetRentalByRequestId(...args),
    updateRentalRequestPaymentStatus: (...args: unknown[]) =>
      mockUpdateRentalRequestPaymentStatus(...args),
    updateRentalRequestPaymentMethod: (...args: unknown[]) =>
      mockUpdateRentalRequestPaymentMethod(...args),
    getApprovedRentalCountForRenter: (...args: unknown[]) =>
      mockGetApprovedRentalCountForRenter(...args),
  },
  userDAL: {
    getOrCreateStripeCustomerId: (...args: unknown[]) =>
      mockGetOrCreateStripeCustomerId(...args),
    getConnectedAccountId: (...args: unknown[]) =>
      mockGetConnectedAccountId(...args),
    isConnectOnboardingComplete: (...args: unknown[]) =>
      mockIsConnectOnboardingComplete(...args),
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
  },
  paymentDAL: {
    createPayment: (...args: unknown[]) => mockPaymentCreate(...args),
  },
  paymentLifecycleDAL: {
    create: (...args: unknown[]) => mockPaymentLifecycleCreate(...args),
    updateDepositHoldStatus: vi.fn(),
  },
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditLogCreate(...args),
  },
  listingDAL: {},
  legalDocumentDAL: {},
}));

import { RentalService } from "./rental-service";

const ownerId = "owner-1";
const renterId = "renter-1";
const requestId = "req-approve-1";

const context = { ipAddress: "127.0.0.1", userAgent: "test-agent" };

function buildRentalRequest() {
  const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  return {
    id: requestId,
    listingId: "listing-1",
    listingName: "Power Drill",
    listingImageUrl: null,
    renterId,
    ownerId,
    ownerName: "Owner Name",
    startDate,
    endDate,
    totalDays: 3,
    dailyRate: "25",
    totalAmount: "100.00",
    securityDeposit: "200.00",
    deliveryRequested: false,
    deliveryAddress: null,
    deliveryFee: "0",
    setupRequested: false,
    setupFee: "0",
    serviceFee: "10",
    applicationFeeAmount: "15.00",
    ownerPayout: "85",
    platformNetRevenue: "5",
    message: null,
    paymentIntentId: null,
    paymentMethodId: "pm_approve_test",
    paymentStatus: "pending",
    status: "pending",
    createdAt: new Date(),
  };
}

describe("RentalService.approveRentalRequest — deposit hold failure (UAT-P1-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateStripeCustomerId.mockResolvedValue("cus_renter");
    mockGetConnectedAccountId.mockResolvedValue("acct_owner");
    mockIsConnectOnboardingComplete.mockResolvedValue(true);
    mockGetRentalRequestById.mockResolvedValue(buildRentalRequest());
    mockApproveRentalRequest.mockResolvedValue(undefined);
    mockGetRentalByRequestId.mockResolvedValue({ id: "rental-created-1" });
    mockChargeRentalPayment.mockResolvedValue({
      id: "pi_approve_charge",
      status: "succeeded",
      latest_charge: "ch_approve",
    });
    mockPlaceDepositHold.mockResolvedValue({
      success: false,
      error: "insufficient_funds",
    });
    mockPaymentCreate.mockResolvedValue(undefined);
    mockPaymentLifecycleCreate.mockResolvedValue(undefined);
    mockGetApprovedRentalCountForRenter.mockResolvedValue(2);
    mockGetUserById.mockImplementation((id: string) =>
      Promise.resolve(
        id === renterId
          ? {
              id: renterId,
              email: "renter@test.com",
              firstName: "Renter",
              lastName: "Test",
            }
          : {
              id: ownerId,
              email: "owner@test.com",
              firstName: "Owner",
              lastName: "Test",
              stripeConnectedAccountId: "acct_123",
              connectChargesEnabled: true,
              connectPayoutsEnabled: true,
              connectOnboardingComplete: true,
            },
      ),
    );
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.VERCEL_URL;
  });

  /**
   * UAT "one notification per party" for deposit: exactly one in-app row per user with
   * deposit-failure titles. Payment-success emails/notifications may still run separately
   * (different titles, e.g. Payment Successful).
   */
  it("proceeds with approval, records failed deposit hold, and notifies both parties once for deposit failure", async () => {
    const result = await RentalService.approveRentalRequest(
      requestId,
      ownerId,
      {},
      context,
    );
    // Flush after() callbacks so notification side effects complete
    await Promise.all(afterCallbacks.splice(0));

    expect(result).toEqual({
      success: true,
      paymentIntentId: "pi_approve_charge",
      depositHoldStatus: "failed",
    });

    expect(mockApproveRentalRequest).toHaveBeenCalled();
    expect(mockPaymentLifecycleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: "rental-created-1",
        depositHoldStatus: "failed",
      }),
    );

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: renterId,
        title: "Security Deposit Hold Failed",
      }),
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ownerId,
        title: "Deposit Hold Not Placed",
      }),
    );

    const depositFailureTitles = mockSendNotification.mock.calls
      .map((c) => (c[0] as { title?: string }).title)
      .filter(
        (t) =>
          t === "Security Deposit Hold Failed" ||
          t === "Deposit Hold Not Placed",
      );
    expect(depositFailureTitles).toHaveLength(2);

    expect(mockSendPaymentSucceededToRenter).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: renterId,
        depositHoldStatus: "failed",
      }),
    );
    expect(mockSendPaymentSucceededToOwner).toHaveBeenCalled();
  });
});
