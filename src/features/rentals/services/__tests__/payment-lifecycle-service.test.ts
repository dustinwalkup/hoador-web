import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const mockFindEligibleForPayout = vi.fn();
const mockClaimForProcessing = vi.fn();
const mockFindScheduledDepositsNearPickup = vi.fn();
const mockFindExpiringDeposits = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();
const mockUpdateOwnerTransferStatus = vi.fn();
const mockUpdatePayoutStatus = vi.fn();

vi.mock("@/dal", () => ({
  paymentLifecycleDAL: {
    findEligibleForPayout: (...args: unknown[]) =>
      mockFindEligibleForPayout(...args),
    claimForProcessing: (...args: unknown[]) => mockClaimForProcessing(...args),
    findScheduledDepositsNearPickup: (...args: unknown[]) =>
      mockFindScheduledDepositsNearPickup(...args),
    findExpiringDeposits: (...args: unknown[]) =>
      mockFindExpiringDeposits(...args),
    updateDepositHoldStatus: (...args: unknown[]) =>
      mockUpdateDepositHoldStatus(...args),
    updateOwnerTransferStatus: (...args: unknown[]) =>
      mockUpdateOwnerTransferStatus(...args),
    updatePayoutStatus: (...args: unknown[]) => mockUpdatePayoutStatus(...args),
  },
}));

const mockReleaseDepositHold = vi.fn();
const mockPlaceDepositHold = vi.fn();
vi.mock("@/services/stripe/deposit-hold", () => ({
  releaseDepositHold: (...args: unknown[]) => mockReleaseDepositHold(...args),
  placeDepositHold: (...args: unknown[]) => mockPlaceDepositHold(...args),
}));

const mockCreateOwnerTransfer = vi.fn();
vi.mock("@/services/stripe/payout", () => ({
  createOwnerTransfer: (...args: unknown[]) => mockCreateOwnerTransfer(...args),
}));

vi.mock("@/constants/payments", () => ({
  PLATFORM_FEE_PERCENTAGE: 0.2,
}));

const mockSendOpsAlert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));

vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

const mockSendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
vi.mock("@/db/db", () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock("@/db/schemas/rentals.schema", () => ({
  rentals: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

const mockPaymentIntentsRetrieve = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockPaymentMethodsList = vi.fn();
vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentIntents: {
      retrieve: (...args: unknown[]) => mockPaymentIntentsRetrieve(...args),
    },
    customers: {
      retrieve: (...args: unknown[]) => mockCustomersRetrieve(...args),
    },
    paymentMethods: {
      list: (...args: unknown[]) => mockPaymentMethodsList(...args),
    },
  },
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

import { PaymentLifecycleService } from "../payment-lifecycle-service";

// --- Helpers ---
function createMockPayoutRental(overrides = {}) {
  return {
    lifecycle: {
      rentalChargeId: "ch_abc",
      depositHoldStatus: "held",
      ownerTransferStatus: "pending",
      payoutStatus: "pending",
    },
    rentalId: "rental-1",
    rentalRequestId: "req-1",
    ownerId: "owner-1",
    ownerConnectedAccountId: "acct_123",
    totalAmount: "100.00",
    securityDepositAuthId: "pi_dep_123",
    ...overrides,
  };
}

function createMockDepositRental(overrides = {}) {
  return {
    lifecycle: { depositHoldStatus: "scheduled" },
    rentalId: "rental-1",
    rentalRequestId: "req-1",
    renterId: "renter-1",
    ownerId: "owner-1",
    renterStripeCustomerId: "cus_123",
    renterPaymentMethodId: "pm_456",
    securityDeposit: "200.00",
    listingId: "listing-1",
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function createMockExpiryDeposit(overrides = {}) {
  return {
    lifecycle: {
      depositHoldStatus: "held",
      depositHoldPlacedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    rentalId: "rental-1",
    securityDepositAuthId: "pi_dep_123",
    ...overrides,
  };
}

// =====================
// processPayouts
// =====================
describe("PaymentLifecycleService.processPayouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindEligibleForPayout.mockResolvedValue([]);
    mockClaimForProcessing.mockResolvedValue(true);
    mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
    mockUpdateOwnerTransferStatus.mockResolvedValue(undefined);
    mockUpdatePayoutStatus.mockResolvedValue(undefined);
  });

  it("returns processedCount: 0 when no eligible rentals", async () => {
    const result = await PaymentLifecycleService.processPayouts(20);

    expect(result).toEqual({
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
    });
  });

  it("queries with the provided batch size", async () => {
    await PaymentLifecycleService.processPayouts(10);

    expect(mockFindEligibleForPayout).toHaveBeenCalledWith(10);
  });

  it("claims rental with atomic lock before processing", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_123",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockClaimForProcessing).toHaveBeenCalledWith("rental-1");
  });

  it("skips rental when claim fails (already processing)", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockClaimForProcessing.mockResolvedValue(false);

    await PaymentLifecycleService.processPayouts(20);

    expect(mockReleaseDepositHold).not.toHaveBeenCalled();
    expect(mockCreateOwnerTransfer).not.toHaveBeenCalled();
  });

  it("releases deposit hold when depositHoldStatus is 'held'", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_123",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockReleaseDepositHold).toHaveBeenCalledWith("pi_dep_123");
  });

  it("skips deposit release when depositHoldStatus is NOT 'held'", async () => {
    const rental = createMockPayoutRental({
      lifecycle: {
        rentalChargeId: "ch_abc",
        depositHoldStatus: "not_applicable",
        ownerTransferStatus: "pending",
        payoutStatus: "pending",
      },
    });
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_123",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockReleaseDepositHold).not.toHaveBeenCalled();
  });

  it("creates owner transfer when ownerTransferStatus is 'pending'", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_123",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockCreateOwnerTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: "rental-1",
        rentalRequestId: "req-1",
        ownerId: "owner-1",
        ownerConnectedAccountId: "acct_123",
        rentalChargeId: "ch_abc",
        totalAmount: 100,
        platformFeePercentage: 0.2,
      }),
    );
  });

  it("sets payoutStatus to 'completed' when all operations succeed", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_123",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockUpdatePayoutStatus).toHaveBeenCalledWith(
      "rental-1",
      "completed",
    );
  });

  it("sets payoutStatus to 'failed' when deposit release fails", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockRejectedValue(new Error("Stripe error"));

    await PaymentLifecycleService.processPayouts(20);

    expect(mockUpdatePayoutStatus).toHaveBeenCalledWith("rental-1", "failed");
    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "release_failed",
    );
  });

  it("sets payoutStatus to 'failed' when transfer fails", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: false,
      error: "Insufficient funds",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockUpdatePayoutStatus).toHaveBeenCalledWith("rental-1", "failed");
  });

  it("alerts ops on any failure", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: false,
      error: "Transfer failed",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "transfer_failed",
        rentalId: "rental-1",
        sendEmailAlert: true,
      }),
    );
  });

  it("processes each rental independently (one failure doesn't block others)", async () => {
    const rental1 = createMockPayoutRental({ rentalId: "rental-1" });
    const rental2 = createMockPayoutRental({
      rentalId: "rental-2",
      securityDepositAuthId: "pi_dep_456",
      lifecycle: {
        rentalChargeId: "ch_def",
        depositHoldStatus: "held",
        ownerTransferStatus: "pending",
        payoutStatus: "pending",
      },
    });
    mockFindEligibleForPayout.mockResolvedValue([rental1, rental2]);
    mockReleaseDepositHold
      .mockRejectedValueOnce(new Error("Release error"))
      .mockResolvedValueOnce(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_456",
    });

    const result = await PaymentLifecycleService.processPayouts(20);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
  });

  it("handles rental with no deposit — skips release, creates transfer", async () => {
    const rental = createMockPayoutRental({
      lifecycle: {
        rentalChargeId: "ch_abc",
        depositHoldStatus: "not_applicable",
        ownerTransferStatus: "pending",
        payoutStatus: "pending",
      },
      securityDepositAuthId: null,
    });
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_789",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockReleaseDepositHold).not.toHaveBeenCalled();
    expect(mockCreateOwnerTransfer).toHaveBeenCalled();
  });

  it("fails when owner has no connected account ID", async () => {
    const rental = createMockPayoutRental({
      ownerConnectedAccountId: null,
      lifecycle: {
        rentalChargeId: "ch_abc",
        depositHoldStatus: "not_applicable",
        ownerTransferStatus: "pending",
        payoutStatus: "pending",
      },
    });
    mockFindEligibleForPayout.mockResolvedValue([rental]);

    const result = await PaymentLifecycleService.processPayouts(20);

    expect(result.failureCount).toBe(1);
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "transfer_failed",
        message: "Owner has no connected account ID",
      }),
    );
  });

  it("fails when missing rental charge ID (source_transaction)", async () => {
    const rental = createMockPayoutRental({
      lifecycle: {
        rentalChargeId: null,
        depositHoldStatus: "not_applicable",
        ownerTransferStatus: "pending",
        payoutStatus: "pending",
      },
    });
    mockFindEligibleForPayout.mockResolvedValue([rental]);

    const result = await PaymentLifecycleService.processPayouts(20);

    expect(result.failureCount).toBe(1);
  });

  it("stores stripeTransferId and ownerTransferredAt on success", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_xyz",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockUpdateOwnerTransferStatus).toHaveBeenCalledWith(
      "rental-1",
      "completed",
      expect.objectContaining({
        stripeTransferId: "tr_xyz",
        ownerTransferredAt: expect.any(Date),
      }),
    );
  });
});

// =====================
// scheduleDepositHolds
// =====================
describe("PaymentLifecycleService.scheduleDepositHolds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindScheduledDepositsNearPickup.mockResolvedValue([]);
    mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
  });

  it("returns processedCount: 0 when no eligible rentals", async () => {
    const result = await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(result).toEqual({
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
    });
  });

  it("queries with the provided batch size", async () => {
    await PaymentLifecycleService.scheduleDepositHolds(15);

    expect(mockFindScheduledDepositsNearPickup).toHaveBeenCalledWith(15);
  });

  it("places deposit hold for eligible rental", async () => {
    const rental = createMockDepositRental();
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_123",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: "rental-1",
        customerId: "cus_123",
        paymentMethodId: "pm_456",
        amount: 200,
      }),
    );
  });

  it("updates depositHoldStatus to 'held' on success", async () => {
    const rental = createMockDepositRental();
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_123",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "held",
      expect.objectContaining({ depositHoldPlacedAt: expect.any(Date) }),
    );
  });

  it("updates depositHoldStatus to 'failed' on hold failure", async () => {
    const rental = createMockDepositRental();
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);
    mockPlaceDepositHold.mockResolvedValue({
      success: false,
      error: "Card declined",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "failed",
    );
  });

  it("notifies renter and owner on hold failure", async () => {
    const rental = createMockDepositRental();
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);
    mockPlaceDepositHold.mockResolvedValue({
      success: false,
      error: "Card declined",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    // Renter notification
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "renter-1",
        type: "payment_failed",
      }),
    );
    // Owner notification
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner-1",
        type: "payment_failed",
      }),
    );
  });

  it("skips rental when renter has no Stripe customer ID", async () => {
    const rental = createMockDepositRental({ renterStripeCustomerId: null });
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);

    const result = await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockPlaceDepositHold).not.toHaveBeenCalled();
    expect(result.failureCount).toBe(1);
  });

  it("resolves payment method from Stripe when not stored on rental", async () => {
    const rental = createMockDepositRental({ renterPaymentMethodId: null });
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);
    mockCustomersRetrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: "pm_default" },
    });
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_123",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodId: "pm_default",
      }),
    );
  });

  it("falls back to first card payment method when no default set", async () => {
    const rental = createMockDepositRental({ renterPaymentMethodId: null });
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);
    mockCustomersRetrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: null },
    });
    mockPaymentMethodsList.mockResolvedValue({
      data: [{ id: "pm_card_1" }],
    });
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_123",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodId: "pm_card_1",
      }),
    );
  });

  it("continues processing other rentals when one fails", async () => {
    const rental1 = createMockDepositRental({ rentalId: "rental-1" });
    const rental2 = createMockDepositRental({
      rentalId: "rental-2",
      renterPaymentMethodId: "pm_789",
    });
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental1, rental2]);
    mockPlaceDepositHold
      .mockResolvedValueOnce({ success: false, error: "Declined" })
      .mockResolvedValueOnce({ success: true, paymentIntentId: "pi_dep_2" });

    const result = await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
  });

  it("sends ops alert on deposit hold failure", async () => {
    const rental = createMockDepositRental();
    mockFindScheduledDepositsNearPickup.mockResolvedValue([rental]);
    mockPlaceDepositHold.mockResolvedValue({
      success: false,
      error: "Card declined",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deposit_hold_failed",
        rentalId: "rental-1",
        sendEmailAlert: true,
      }),
    );
  });
});

// =====================
// monitorDepositExpiry
// =====================
describe("PaymentLifecycleService.monitorDepositExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindExpiringDeposits.mockResolvedValue([]);
    mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
  });

  it("returns checkedCount: 0 when no at-risk deposits", async () => {
    const result = await PaymentLifecycleService.monitorDepositExpiry(6);

    expect(result).toEqual({ checkedCount: 0, expiredCount: 0 });
  });

  it("queries with the provided days threshold", async () => {
    await PaymentLifecycleService.monitorDepositExpiry(5);

    expect(mockFindExpiringDeposits).toHaveBeenCalledWith(5);
  });

  it("skips deposits without securityDepositAuthId", async () => {
    const deposit = createMockExpiryDeposit({ securityDepositAuthId: null });
    mockFindExpiringDeposits.mockResolvedValue([deposit]);

    const result = await PaymentLifecycleService.monitorDepositExpiry(6);

    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
    expect(result.expiredCount).toBe(0);
  });

  it("marks deposit as expired when Stripe shows 'canceled'", async () => {
    const deposit = createMockExpiryDeposit();
    mockFindExpiringDeposits.mockResolvedValue([deposit]);
    mockPaymentIntentsRetrieve.mockResolvedValue({ status: "canceled" });

    const result = await PaymentLifecycleService.monitorDepositExpiry(6);

    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "expired",
    );
    expect(result.expiredCount).toBe(1);
  });

  it("does not mark deposit as expired when Stripe status is not 'canceled'", async () => {
    const deposit = createMockExpiryDeposit();
    mockFindExpiringDeposits.mockResolvedValue([deposit]);
    mockPaymentIntentsRetrieve.mockResolvedValue({
      status: "requires_capture",
    });

    const result = await PaymentLifecycleService.monitorDepositExpiry(6);

    expect(mockUpdateDepositHoldStatus).not.toHaveBeenCalled();
    expect(result.expiredCount).toBe(0);
  });

  it("sends ops alert for expired deposits", async () => {
    const deposit = createMockExpiryDeposit();
    mockFindExpiringDeposits.mockResolvedValue([deposit]);
    mockPaymentIntentsRetrieve.mockResolvedValue({ status: "canceled" });

    await PaymentLifecycleService.monitorDepositExpiry(6);

    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deposit_hold_expired",
        rentalId: "rental-1",
        sendEmailAlert: true,
      }),
    );
  });

  it("continues processing when Stripe retrieval fails", async () => {
    const deposit1 = createMockExpiryDeposit({
      rentalId: "rental-1",
      securityDepositAuthId: "pi_1",
    });
    const deposit2 = createMockExpiryDeposit({
      rentalId: "rental-2",
      securityDepositAuthId: "pi_2",
    });
    mockFindExpiringDeposits.mockResolvedValue([deposit1, deposit2]);
    mockPaymentIntentsRetrieve
      .mockRejectedValueOnce(new Error("Stripe down"))
      .mockResolvedValueOnce({ status: "canceled" });

    const result = await PaymentLifecycleService.monitorDepositExpiry(6);

    expect(result.expiredCount).toBe(1);
    expect(result.checkedCount).toBe(2);
  });
});
