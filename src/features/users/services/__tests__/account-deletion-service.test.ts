import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Requirements: 2.5.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.1
 */

const { mockCounts, mockAnonymizeUser, mockAuditCreate } = vi.hoisted(() => ({
  mockCounts: {
    countActiveRentals: vi.fn(),
    countActiveBookings: vi.fn(),
    countPendingOwnedRequests: vi.fn(),
    countActiveDepositHolds: vi.fn(),
    countIncompletePayouts: vi.fn(),
    countOpenDisputes: vi.fn(),
  },
  mockAnonymizeUser: vi.fn(),
  mockAuditCreate: vi.fn(),
}));

const mockGetUserById = vi.hoisted(() => vi.fn());
vi.mock("@/dal", () => ({
  accountDeletionDAL: { ...mockCounts, anonymizeUser: mockAnonymizeUser },
  auditLogDAL: { create: mockAuditCreate },
  userDAL: { getUserById: (...a: unknown[]) => mockGetUserById(...a) },
}));

const mockDetachAll = vi.hoisted(() => vi.fn());
vi.mock("@/services/stripe/payment-method", () => ({
  detachAllPaymentMethodsForCustomer: (...a: unknown[]) => mockDetachAll(...a),
}));

const mockCapture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...a: unknown[]) => mockCapture(...a),
}));

const mockOpsAlert = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...a: unknown[]) => mockOpsAlert(...a),
}));

const mockRevokeApple = vi.hoisted(() => vi.fn());
vi.mock("@/services/better-auth/apple-tokens", () => ({
  revokeAppleRefreshToken: (...a: unknown[]) => mockRevokeApple(...a),
  appleWebClientId: () => "com.hoador.web",
}));

const mockRentalCancelled = vi.hoisted(() => vi.fn());
vi.mock("@/features/rentals/notifications/rental-cancelled", () => ({
  sendRentalCancelledNotification: (...a: unknown[]) =>
    mockRentalCancelled(...a),
}));

const mockSendNotification = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

import {
  getDeletionBlockers,
  deleteOwnAccount,
} from "../account-deletion-service";
import { AccountDeletionBlockedError } from "../../lib/account-deletion-errors";

const allClear = () =>
  Object.values(mockCounts).forEach((m) => m.mockResolvedValue(0));

describe("getDeletionBlockers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allClear();
  });

  it("returns no blockers for a clean account", async () => {
    expect(await getDeletionBlockers("user-1")).toEqual([]);
  });

  it.each([
    ["active_rentals", "countActiveRentals"],
    ["active_bookings", "countActiveBookings"],
    ["pending_requests", "countPendingOwnedRequests"],
    ["deposit_holds", "countActiveDepositHolds"],
    ["incomplete_payouts", "countIncompletePayouts"],
    ["open_disputes", "countOpenDisputes"],
  ] as const)("reports the %s blocker with its count", async (type, method) => {
    mockCounts[method].mockResolvedValue(3);

    const blockers = await getDeletionBlockers("user-1");

    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({ type, count: 3 });
    expect(blockers[0].message).toBeTruthy();
  });

  it("reports every blocker at once, not just the first", async () => {
    // Req 2.5.2: the app shows the full list, so a single-blocker short-circuit
    // would strand the user fixing them one deletion attempt at a time.
    mockCounts.countActiveRentals.mockResolvedValue(1);
    mockCounts.countOpenDisputes.mockResolvedValue(2);

    const blockers = await getDeletionBlockers("user-1");

    expect(blockers.map((b) => b.type).sort()).toEqual([
      "active_rentals",
      "open_disputes",
    ]);
  });

  it("runs the checks concurrently", async () => {
    let live = 0;
    let maxLive = 0;
    const gate = () =>
      new Promise<number>((resolve) => {
        live += 1;
        maxLive = Math.max(maxLive, live);
        setTimeout(() => {
          live -= 1;
          resolve(0);
        }, 5);
      });
    Object.values(mockCounts).forEach((m) => m.mockImplementation(gate));

    await getDeletionBlockers("user-1");

    // All six independent reads should overlap, not run in series.
    expect(maxLive).toBeGreaterThan(1);
  });

  it("pluralizes the count message", async () => {
    mockCounts.countActiveRentals.mockResolvedValue(1);
    const one = await getDeletionBlockers("user-1");
    expect(one[0].message).toContain("1 active rental.");

    vi.clearAllMocks();
    allClear();
    mockCounts.countActiveRentals.mockResolvedValue(2);
    const many = await getDeletionBlockers("user-1");
    expect(many[0].message).toContain("2 active rentals.");
  });
});

/** What `anonymizeUser` returns for a user with nothing outstanding. */
const anonymized = (over: Record<string, unknown> = {}) => ({
  paymentMethodIds: [],
  stripeCustomerId: "cus_1",
  appleTokens: [],
  cancelledRentalRequests: [],
  cancelledServiceBookings: [],
  ...over,
});

/** Let fire-and-forget notifications settle before asserting on them. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allClear();
    mockAnonymizeUser.mockResolvedValue(anonymized());
    mockAuditCreate.mockResolvedValue({ id: "audit-1" });
    mockDetachAll.mockResolvedValue({ detached: 0, failed: 0 });
    mockRevokeApple.mockResolvedValue(undefined);
    mockOpsAlert.mockResolvedValue(undefined);
    mockRentalCancelled.mockResolvedValue(undefined);
    mockSendNotification.mockResolvedValue(undefined);
    mockGetUserById.mockResolvedValue({
      id: "owner-1",
      name: "Olive Owner",
      firstName: "Olive",
      lastName: "Owner",
    });
  });

  it("throws a 409 AccountDeletionBlockedError and mutates nothing when blocked", async () => {
    mockCounts.countOpenDisputes.mockResolvedValue(1);

    await expect(deleteOwnAccount("user-1")).rejects.toBeInstanceOf(
      AccountDeletionBlockedError,
    );
    // Blockers are checked before any write — a blocked attempt is a no-op.
    expect(mockAnonymizeUser).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("carries the blocker list on the error", async () => {
    mockCounts.countActiveRentals.mockResolvedValue(2);

    await expect(deleteOwnAccount("user-1")).rejects.toMatchObject({
      code: "ACCOUNT_DELETION_BLOCKED",
      statusCode: 409,
      details: {
        blockers: [expect.objectContaining({ type: "active_rentals" })],
      },
    });
  });

  // BIZ-07: the local card table is empty in practice, so every card must be
  // detached from the Stripe customer itself.
  it("detaches every card on the Stripe customer, after the transaction commits", async () => {
    const order: string[] = [];
    mockAnonymizeUser.mockImplementation(async () => {
      order.push("anonymize");
      return anonymized({ stripeCustomerId: "cus_42" });
    });
    mockDetachAll.mockImplementation(async (customerId: string) => {
      order.push(`detach-all:${customerId}`);
      return { detached: 3, failed: 0 };
    });

    await deleteOwnAccount("user-1");

    // Detach must happen after the DB anonymize commits, never before.
    expect(order).toEqual(["anonymize", "detach-all:cus_42"]);
    expect(mockOpsAlert).not.toHaveBeenCalled();
  });

  it("skips the Stripe call for a user who never had a customer", async () => {
    mockAnonymizeUser.mockResolvedValue(anonymized({ stripeCustomerId: null }));

    await deleteOwnAccount("user-1");

    expect(mockDetachAll).not.toHaveBeenCalled();
  });

  // Req 2.5.5 (P-E14-4): Apple's deletion guidance says to revoke the tokens.
  describe("Sign in with Apple", () => {
    it("revokes each token after the commit, the web one with the Services ID", async () => {
      const order: string[] = [];
      mockAnonymizeUser.mockImplementation(async () => {
        order.push("anonymize");
        return anonymized({
          appleTokens: [
            { refreshToken: "r-native", clientId: "com.hoador.app" },
            { refreshToken: "r-web", clientId: null },
          ],
        });
      });
      mockRevokeApple.mockImplementation(async ({ refreshToken }) => {
        order.push(`revoke:${refreshToken}`);
      });

      await deleteOwnAccount("user-1");

      expect(order).toEqual(["anonymize", "revoke:r-native", "revoke:r-web"]);
      expect(mockRevokeApple).toHaveBeenCalledWith({
        refreshToken: "r-native",
        clientId: "com.hoador.app",
      });
      expect(mockRevokeApple).toHaveBeenCalledWith({
        refreshToken: "r-web",
        clientId: "com.hoador.web",
      });
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ appleTokensRevoked: 2 }),
        }),
      );
    });

    it("makes no Apple call for a user with no stored token", async () => {
      await deleteOwnAccount("user-1");

      expect(mockRevokeApple).not.toHaveBeenCalled();
    });

    it("still deletes, and reports to Sentry, when Apple refuses a revocation", async () => {
      mockAnonymizeUser.mockResolvedValue(
        anonymized({
          appleTokens: [
            { refreshToken: "r-bad", clientId: "com.hoador.app" },
            { refreshToken: "r-good", clientId: "com.hoador.app" },
          ],
        }),
      );
      mockRevokeApple.mockImplementation(async ({ refreshToken }) => {
        if (refreshToken === "r-bad") throw new Error("apple down");
      });

      await expect(deleteOwnAccount("user-1")).resolves.toBeUndefined();

      expect(mockRevokeApple).toHaveBeenCalledTimes(2);
      expect(mockCapture).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ action: "revoke-apple-token" }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ appleTokensRevoked: 1 }),
        }),
      );
    });
  });

  // A card left attached can still be charged: that needs a human, not a log.
  it("alerts ops, and still deletes, when some cards fail to detach", async () => {
    mockDetachAll.mockResolvedValue({ detached: 1, failed: 2 });

    await expect(deleteOwnAccount("user-1")).resolves.toBeUndefined();

    expect(mockOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "account_deletion_card_detach_failed",
        metadata: expect.objectContaining({ failed: 2 }),
      }),
    );
    expect(mockAuditCreate).toHaveBeenCalled();
  });

  it("does not fail the deletion when Stripe cannot list the cards", async () => {
    // A Stripe outage must not leave the user un-deletable.
    mockDetachAll.mockRejectedValue(new Error("stripe down"));

    await expect(deleteOwnAccount("user-1")).resolves.toBeUndefined();
    expect(mockCapture).toHaveBeenCalled();
    expect(mockOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({ event: "account_deletion_card_detach_failed" }),
    );
    // The account is still recorded as deleted.
    expect(mockAuditCreate).toHaveBeenCalled();
  });

  // BIZ-07: the requests anonymize withdrew would otherwise vanish from the
  // owner's and provider's view with no explanation.
  it("tells each owner and provider whose request was withdrawn", async () => {
    mockAnonymizeUser.mockResolvedValue(
      anonymized({
        cancelledRentalRequests: [
          { id: "req-1", ownerId: "owner-1", listingName: "Pressure Washer" },
        ],
        cancelledServiceBookings: [
          { id: "sb-1", providerId: "prov-1", serviceTitle: "Lawn mowing" },
        ],
      }),
    );

    await deleteOwnAccount("user-1");
    await flush();

    expect(mockRentalCancelled).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "owner-1",
        recipientName: "Olive Owner",
        listingName: "Pressure Washer",
        rentalId: "req-1",
        cancelledBy: "renter",
      }),
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "prov-1",
        type: "system",
        title: "Booking cancelled",
        data: { bookingId: "sb-1" },
      }),
    );
  });

  it("does not fail the deletion when a notification fails", async () => {
    mockAnonymizeUser.mockResolvedValue(
      anonymized({
        cancelledRentalRequests: [
          { id: "req-1", ownerId: "owner-1", listingName: "Drill" },
        ],
      }),
    );
    mockRentalCancelled.mockRejectedValue(new Error("push down"));

    await expect(deleteOwnAccount("user-1")).resolves.toBeUndefined();
    await flush();
    expect(mockCapture).toHaveBeenCalled();
  });

  it("writes an audit row with no PII in metadata", async () => {
    mockDetachAll.mockResolvedValue({ detached: 2, failed: 0 });

    await deleteOwnAccount("user-1");

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "user",
        entityId: "user-1",
        action: "user.self_deleted",
        userId: "user-1",
        metadata: expect.objectContaining({ paymentMethodsDetached: 2 }),
      }),
    );
    // The metadata is retained 5 years and append-only — it must not re-record
    // the email/name we just scrubbed.
    const metadata = mockAuditCreate.mock.calls[0][0].metadata;
    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toMatch(/@|email|name|phone/i);
  });
});
