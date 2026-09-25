import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const mockFindEligibleForPayout = vi.fn();
const mockClaimForProcessing = vi.fn();
const mockFindScheduledDepositsNearPickup = vi.fn();
const mockFindExpiringDeposits = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();
const mockClaimForDepositHold = vi.fn();
const mockUpdateOwnerTransferStatus = vi.fn();
const mockUpdatePayoutStatus = vi.fn();
const mockGetByRentalId = vi.fn();
const mockGetRentalRequestById = vi.fn();
const mockGetRentalByRequestId = vi.fn();
const mockUpdateRentalRequestPaymentMethod = vi.fn();

vi.mock("@/dal", () => ({
  paymentLifecycleDAL: {
    findEligibleForPayout: (...args: unknown[]) =>
      mockFindEligibleForPayout(...args),
    claimForProcessing: (...args: unknown[]) => mockClaimForProcessing(...args),
    claimForDepositHold: (...args: unknown[]) =>
      mockClaimForDepositHold(...args),
    findScheduledDepositsNearPickup: (...args: unknown[]) =>
      mockFindScheduledDepositsNearPickup(...args),
    findExpiringDeposits: (...args: unknown[]) =>
      mockFindExpiringDeposits(...args),
    updateDepositHoldStatus: (...args: unknown[]) =>
      mockUpdateDepositHoldStatus(...args),
    updateOwnerTransferStatus: (...args: unknown[]) =>
      mockUpdateOwnerTransferStatus(...args),
    updatePayoutStatus: (...args: unknown[]) => mockUpdatePayoutStatus(...args),
    getByRentalId: (...args: unknown[]) => mockGetByRentalId(...args),
  },
  rentalDAL: {
    getRentalRequestById: (...args: unknown[]) =>
      mockGetRentalRequestById(...args),
    getRentalByRequestId: (...args: unknown[]) =>
      mockGetRentalByRequestId(...args),
    updateRentalRequestPaymentMethod: (...args: unknown[]) =>
      mockUpdateRentalRequestPaymentMethod(...args),
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

const mockCaptureNonCriticalError = vi.fn();
vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...args: unknown[]) =>
    mockCaptureNonCriticalError(...args),
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
const mockDbSelectResult: unknown[] = [];
const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockImplementation(() => mockDbSelectResult),
    }),
  }),
});
vi.mock("@/db/db", () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("@/db/schemas/rentals.schema", () => ({
  rentals: { id: "id" },
}));

vi.mock("@/db/schemas/user.schema", () => ({
  user: { id: "id", stripeCustomerId: "stripeCustomerId" },
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
      ownerTransferRetryCount: 0,
      payoutStatus: "pending",
    },
    rentalId: "rental-1",
    rentalRequestId: "req-1",
    ownerId: "owner-1",
    ownerConnectedAccountId: "acct_123",
    totalAmount: "100.00",
    ownerPayout: "80.00",
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
        ownerPayoutAmount: 80,
        retryCount: 0,
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

  /**
   * UAT-P1-23 (process-payouts cron): transfer API failure — ownerTransferStatus and
   * payoutStatus set to failed, ops email via sendOpsAlert. createOwnerTransfer is
   * invoked once per run (no in-loop retry); a later cron pass will not re-attempt
   * transfer while eligibility excludes non-pending ownerTransferStatus.
   */
  it("UAT-P1-23: createOwnerTransfer failure sets ownerTransfer + payout failed and ops alert", async () => {
    const rental = createMockPayoutRental();
    mockFindEligibleForPayout.mockResolvedValue([rental]);
    mockReleaseDepositHold.mockResolvedValue(undefined);
    mockCreateOwnerTransfer.mockResolvedValue({
      success: false,
      error: "Connected account no longer valid",
    });

    await PaymentLifecycleService.processPayouts(20);

    expect(mockUpdateOwnerTransferStatus).toHaveBeenCalledWith(
      "rental-1",
      "failed",
    );
    expect(mockUpdatePayoutStatus).toHaveBeenCalledWith("rental-1", "failed");
    expect(mockCreateOwnerTransfer).toHaveBeenCalledTimes(1);
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "transfer_failed",
        rentalId: "rental-1",
        sendEmailAlert: true,
        message: expect.stringContaining("Owner transfer failed"),
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

  /**
   * BIZ-05: a dispute "resolved" through the state route left the transfer
   * `frozen`; the cron skipped the transfer and still marked the payout
   * `completed`, so the owner's money silently never moved.
   */
  describe("a transfer that is not due (BIZ-05)", () => {
    const rentalWithTransfer = (ownerTransferStatus: string) =>
      createMockPayoutRental({
        lifecycle: {
          ...createMockPayoutRental().lifecycle,
          ownerTransferStatus,
        },
      });

    it.each(["frozen", "processing", "failed"])(
      "fails a %s transfer's payout with an ops alert, never 'completed'",
      async (status) => {
        mockFindEligibleForPayout.mockResolvedValue([
          rentalWithTransfer(status),
        ]);

        const result = await PaymentLifecycleService.processPayouts(20);

        expect(mockUpdatePayoutStatus).toHaveBeenCalledWith(
          "rental-1",
          "failed",
        );
        expect(mockUpdatePayoutStatus).not.toHaveBeenCalledWith(
          "rental-1",
          "completed",
        );
        expect(mockSendOpsAlert).toHaveBeenCalledWith(
          expect.objectContaining({
            event: "payout_skipped_transfer_not_pending",
            rentalId: "rental-1",
          }),
        );
        expect(result).toEqual({
          processedCount: 1,
          successCount: 0,
          failureCount: 1,
        });
      },
    );

    // The dispute still owns the deposit decision: letting the hold go before
    // bailing out would hand the renter back money the dispute may capture.
    it("does not release a frozen dispute's deposit or send a transfer", async () => {
      mockFindEligibleForPayout.mockResolvedValue([
        rentalWithTransfer("frozen"),
      ]);

      await PaymentLifecycleService.processPayouts(20);

      expect(mockReleaseDepositHold).not.toHaveBeenCalled();
      expect(mockUpdateDepositHoldStatus).not.toHaveBeenCalled();
      expect(mockCreateOwnerTransfer).not.toHaveBeenCalled();
    });

    // A transfer that already went out (payout status write lost) still
    // completes: releasing the deposit and marking the payout is all that is
    // left, and no second transfer is sent.
    it("completes a payout whose transfer already completed, without a second transfer", async () => {
      mockFindEligibleForPayout.mockResolvedValue([
        rentalWithTransfer("completed"),
      ]);
      mockReleaseDepositHold.mockResolvedValue(undefined);

      const result = await PaymentLifecycleService.processPayouts(20);

      expect(mockCreateOwnerTransfer).not.toHaveBeenCalled();
      expect(mockUpdatePayoutStatus).toHaveBeenCalledWith(
        "rental-1",
        "completed",
      );
      expect(result.successCount).toBe(1);
    });
  });
});

// =====================
// scheduleDepositHolds
// =====================
describe("PaymentLifecycleService.scheduleDepositHolds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindScheduledDepositsNearPickup.mockResolvedValue([]);
    // The claim wins and every compare-and-swap lands by default (CONC-10).
    mockClaimForDepositHold.mockResolvedValue(true);
    mockUpdateDepositHoldStatus.mockResolvedValue(true);
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
    // The cron keeps placeDepositHold's default deposit-hold-{rentalId} key.
    expect(mockPlaceDepositHold.mock.calls[0][0]).not.toHaveProperty(
      "idempotencyKey",
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
      { fromStatus: "placing" },
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
    // Handed back to `scheduled`, so the next run sees it, as before.
    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "scheduled",
      { fromStatus: "placing" },
    );
  });

  // CONC-10: the eligible list is a snapshot. A renter's cancel or an
  // overlapping run can take the row before this run reaches it.
  it("skips a rental whose claim is lost, without calling Stripe", async () => {
    mockFindScheduledDepositsNearPickup.mockResolvedValue([
      createMockDepositRental({ rentalId: "rental-1" }),
      createMockDepositRental({ rentalId: "rental-2" }),
    ]);
    mockClaimForDepositHold.mockImplementation(
      async (id: string) => id === "rental-2",
    );
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_2",
    });

    const result = await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockPlaceDepositHold).toHaveBeenCalledTimes(1);
    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: "rental-2" }),
    );
    expect(result.successCount).toBe(1);
    expect(mockUpdateDepositHoldStatus).not.toHaveBeenCalledWith(
      "rental-1",
      expect.anything(),
      expect.anything(),
    );
  });

  it("finalizes the hold only while the claim is still ours", async () => {
    mockFindScheduledDepositsNearPickup.mockResolvedValue([
      createMockDepositRental(),
    ]);
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_123",
    });

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "held",
      expect.objectContaining({ fromStatus: "placing" }),
    );
    // The auth id lands before `held`, so a reader of `held` can release it.
    expect(mockDbUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateDepositHoldStatus.mock.invocationCallOrder[0],
    );
  });

  it("releases a hold placed on a rental cancelled mid-placement, and alerts", async () => {
    mockFindScheduledDepositsNearPickup.mockResolvedValue([
      createMockDepositRental(),
    ]);
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_123",
    });
    mockUpdateDepositHoldStatus.mockResolvedValue(false);
    mockReleaseDepositHold.mockResolvedValue(undefined);

    const result = await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockReleaseDepositHold).toHaveBeenCalledWith("pi_dep_123");
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deposit_hold_released_after_race",
        rentalId: "rental-1",
      }),
    );
    expect(result).toMatchObject({ successCount: 0, failureCount: 1 });
  });

  it("pages ops by email when releasing a raced hold fails", async () => {
    mockFindScheduledDepositsNearPickup.mockResolvedValue([
      createMockDepositRental(),
    ]);
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_123",
    });
    mockUpdateDepositHoldStatus.mockResolvedValue(false);
    mockReleaseDepositHold.mockRejectedValue(new Error("stripe down"));

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deposit_hold_race_release_failed",
        sendEmailAlert: true,
      }),
    );
  });

  it("stays silent when a failed hold's row was already taken by a cancel", async () => {
    mockFindScheduledDepositsNearPickup.mockResolvedValue([
      createMockDepositRental(),
    ]);
    mockPlaceDepositHold.mockResolvedValue({
      success: false,
      error: "Card declined",
    });
    mockUpdateDepositHoldStatus.mockResolvedValue(false);

    await PaymentLifecycleService.scheduleDepositHolds(20);

    expect(mockSendNotification).not.toHaveBeenCalled();
    expect(mockSendOpsAlert).not.toHaveBeenCalled();
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

// =====================
// retryDepositHold
// =====================
describe("PaymentLifecycleService.retryDepositHold", () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // pm_456 is the stored card whose hold failed; pm_new is the renter's
  // current default.
  const mockRentalRequest = {
    id: "req-1",
    renterId: "renter-1",
    startDate: futureDate,
    paymentMethodId: "pm_456",
    securityDeposit: "200.00",
    listingId: "listing-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRentalRequestById.mockResolvedValue(mockRentalRequest);
    mockGetRentalByRequestId.mockResolvedValue({ id: "rental-1" });
    mockGetByRentalId.mockResolvedValue({ depositHoldStatus: "failed" });
    mockClaimForDepositHold.mockResolvedValue(true);
    mockUpdateDepositHoldStatus.mockResolvedValue(true);
    mockUpdateRentalRequestPaymentMethod.mockResolvedValue(undefined);
    mockCustomersRetrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: "pm_new" },
    });
    mockPaymentMethodsList.mockResolvedValue({ data: [] });
    // Mock db.select for user lookup
    mockDbSelectResult.length = 0;
    mockDbSelectResult.push({ stripeCustomerId: "cus_123" });
  });

  it("returns success when deposit hold is placed successfully", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({ success: true });
    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: "rental-1",
        customerId: "cus_123",
        paymentMethodId: "pm_new",
        amount: 200,
      }),
    );
  });

  it("uses the renter's current default card, not the stored card that failed", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockCustomersRetrieve).toHaveBeenCalledWith("cus_123");
    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethodId: "pm_new" }),
    );
  });

  it("keys the hold on the rental and the card", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "deposit-hold-rental-1-pm_new",
      }),
    );
  });

  it("updates deposit status to 'held' on success", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "held",
      expect.objectContaining({ depositHoldPlacedAt: expect.any(Date) }),
    );
  });

  it("updates rentals table with security deposit auth ID on success", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("records the new card on the rental request on success", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockUpdateRentalRequestPaymentMethod).toHaveBeenCalledWith(
      "req-1",
      "pm_new",
    );
  });

  it("does not rewrite the stored card when the default is the same card", async () => {
    mockCustomersRetrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: "pm_456" },
    });
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockUpdateRentalRequestPaymentMethod).not.toHaveBeenCalled();
  });

  it("still succeeds when recording the new card fails", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });
    mockUpdateRentalRequestPaymentMethod.mockRejectedValue(
      new Error("DB down"),
    );

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({ success: true });
    expect(mockCaptureNonCriticalError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: "record_deposit_payment_method" }),
    );
  });

  it("returns error when rental request not found", async () => {
    mockGetRentalRequestById.mockRejectedValue(new Error("not found"));

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-999",
      "renter-1",
    );

    expect(result).toEqual({ success: false, error: "Rental not found" });
    expect(mockPlaceDepositHold).not.toHaveBeenCalled();
  });

  it("returns error when user is not the renter", async () => {
    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "different-user",
    );

    expect(result).toEqual({ success: false, error: "Not authorized" });
    expect(mockPlaceDepositHold).not.toHaveBeenCalled();
  });

  it("returns error when rental not found by request ID", async () => {
    mockGetRentalByRequestId.mockResolvedValue(null);

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({ success: false, error: "Rental not found" });
  });

  it("returns error when deposit status is not 'failed'", async () => {
    mockGetByRentalId.mockResolvedValue({ depositHoldStatus: "held" });

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({
      success: false,
      error: "Deposit hold is not in a failed state",
    });
    expect(mockPlaceDepositHold).not.toHaveBeenCalled();
  });

  it("returns error when lifecycle record not found", async () => {
    mockGetByRentalId.mockResolvedValue(null);

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({
      success: false,
      error: "Deposit hold is not in a failed state",
    });
  });

  it("returns error when rental has already started", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockGetRentalRequestById.mockResolvedValue({
      ...mockRentalRequest,
      startDate: pastDate,
    });

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({
      success: false,
      error: "Rental has already started",
    });
  });

  it("returns error when renter has no Stripe customer ID", async () => {
    mockDbSelectResult.length = 0;
    mockDbSelectResult.push({ stripeCustomerId: null });

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({
      success: false,
      error: "No payment account found",
    });
  });

  it("falls back to first card when no default payment method", async () => {
    mockCustomersRetrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: null },
    });
    mockPaymentMethodsList.mockResolvedValue({
      data: [{ id: "pm_card_fallback" }],
    });
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockPlaceDepositHold).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethodId: "pm_card_fallback" }),
    );
  });

  it("returns error when no payment method can be resolved, even with a stored card", async () => {
    mockCustomersRetrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: null },
    });
    mockPaymentMethodsList.mockResolvedValue({ data: [] });

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({
      success: false,
      error: "No payment method found. Please add a payment method first.",
    });
    expect(mockPlaceDepositHold).not.toHaveBeenCalled();
  });

  it("returns error from placeDepositHold on failure", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: false,
      error: "Card was declined",
    });

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({
      success: false,
      error: "Card was declined",
    });
    // The claim is handed back so the renter can try again (CONC-10).
    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledTimes(1);
    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "failed",
      { fromStatus: "placing" },
    );
    expect(mockUpdateRentalRequestPaymentMethod).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  // CONC-10: a second concurrent retry (e.g. on another card, so another
  // idempotency key) or a racing cancel took the row first.
  it("refuses without calling Stripe when the claim is lost", async () => {
    mockClaimForDepositHold.mockResolvedValue(false);

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result).toEqual({
      success: false,
      error: "Deposit hold is not in a failed state",
    });
    expect(mockClaimForDepositHold).toHaveBeenCalledWith("rental-1");
    expect(mockPlaceDepositHold).not.toHaveBeenCalled();
    expect(mockUpdateDepositHoldStatus).not.toHaveBeenCalled();
  });

  it("claims only after its pre-checks, so none of them strands a claim", async () => {
    mockCustomersRetrieve.mockResolvedValue({ invoice_settings: {} });
    mockPaymentMethodsList.mockResolvedValue({ data: [] });

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result.success).toBe(false);
    expect(mockClaimForDepositHold).not.toHaveBeenCalled();
  });

  it("finalizes the hold only while the claim is still ours", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });

    await PaymentLifecycleService.retryDepositHold("req-1", "renter-1");

    expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
      "rental-1",
      "held",
      expect.objectContaining({ fromStatus: "placing" }),
    );
  });

  it("releases a hold whose rental was cancelled mid-placement", async () => {
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_dep_new",
    });
    mockUpdateDepositHoldStatus.mockResolvedValue(false);
    mockReleaseDepositHold.mockResolvedValue(undefined);

    const result = await PaymentLifecycleService.retryDepositHold(
      "req-1",
      "renter-1",
    );

    expect(result.success).toBe(false);
    expect(mockReleaseDepositHold).toHaveBeenCalledWith("pi_dep_new");
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deposit_hold_released_after_race",
        rentalId: "rental-1",
      }),
    );
    expect(mockUpdateRentalRequestPaymentMethod).not.toHaveBeenCalled();
  });
});
