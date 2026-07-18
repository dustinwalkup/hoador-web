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

vi.mock("@/dal", () => ({
  accountDeletionDAL: { ...mockCounts, anonymizeUser: mockAnonymizeUser },
  auditLogDAL: { create: mockAuditCreate },
}));

const mockDetach = vi.hoisted(() => vi.fn());
vi.mock("@/services/stripe/payment-method", () => ({
  detachPaymentMethod: (...a: unknown[]) => mockDetach(...a),
}));

const mockCapture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...a: unknown[]) => mockCapture(...a),
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

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allClear();
    mockAnonymizeUser.mockResolvedValue({ paymentMethodIds: [] });
    mockAuditCreate.mockResolvedValue({ id: "audit-1" });
    mockDetach.mockResolvedValue(undefined);
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

  it("anonymizes then detaches payment methods after the transaction commits", async () => {
    mockAnonymizeUser.mockResolvedValue({ paymentMethodIds: ["pm_1", "pm_2"] });
    const order: string[] = [];
    mockAnonymizeUser.mockImplementation(async () => {
      order.push("anonymize");
      return { paymentMethodIds: ["pm_1", "pm_2"] };
    });
    mockDetach.mockImplementation(async (id) => {
      order.push(`detach:${id}`);
    });

    await deleteOwnAccount("user-1");

    expect(mockDetach).toHaveBeenCalledWith("pm_1");
    expect(mockDetach).toHaveBeenCalledWith("pm_2");
    // Detach must happen after the DB anonymize commits, never before.
    expect(order[0]).toBe("anonymize");
  });

  it("does not fail the deletion when a Stripe detach errors", async () => {
    // A Stripe outage must not leave the user un-deletable — the local PM rows
    // are already deactivated in the transaction.
    mockAnonymizeUser.mockResolvedValue({ paymentMethodIds: ["pm_1"] });
    mockDetach.mockRejectedValue(new Error("stripe down"));

    await expect(deleteOwnAccount("user-1")).resolves.toBeUndefined();
    expect(mockCapture).toHaveBeenCalled();
    // The account is still recorded as deleted.
    expect(mockAuditCreate).toHaveBeenCalled();
  });

  it("writes an audit row with no PII in metadata", async () => {
    mockAnonymizeUser.mockResolvedValue({ paymentMethodIds: ["pm_1"] });

    await deleteOwnAccount("user-1");

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "user",
        entityId: "user-1",
        action: "user.self_deleted",
        userId: "user-1",
      }),
    );
    // The metadata is retained 5 years and append-only — it must not re-record
    // the email/name we just scrubbed.
    const metadata = mockAuditCreate.mock.calls[0][0].metadata;
    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toMatch(/@|email|name|phone/i);
  });
});
