import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Expo push receipt checking — the native counterpart to web push's inline
 * 410/404 pruning.
 *
 * Requirements: 2.2.4
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.2.2
 */

const mockGetReceipts = vi.fn();
const mockChunkReceiptIds = vi.fn();
vi.mock("expo-server-sdk", () => ({
  Expo: class {
    chunkPushNotificationReceiptIds(ids: string[]) {
      return mockChunkReceiptIds(ids);
    }
    getPushNotificationReceiptsAsync(chunk: string[]) {
      return mockGetReceipts(chunk);
    }
  },
}));

const mockGetPendingReceipts = vi.fn();
const mockResolveReceipt = vi.fn();
const mockExpireStaleReceipts = vi.fn();
const mockDeactivateByToken = vi.fn();
vi.mock("@/dal", () => ({
  pushSubscriptionDAL: {
    getPendingReceipts: (...a: unknown[]) => mockGetPendingReceipts(...a),
    resolveReceipt: (...a: unknown[]) => mockResolveReceipt(...a),
    expireStaleReceipts: (...a: unknown[]) => mockExpireStaleReceipts(...a),
    deactivateByToken: (...a: unknown[]) => mockDeactivateByToken(...a),
    createAuditLog: vi.fn(),
  },
}));

import { checkExpoPushReceipts } from "../expo-push-service";

const TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";

const pendingRow = (over: Record<string, unknown> = {}) => ({
  id: "audit-1",
  userId: "user-1",
  subscriptionId: "sub-ios-1",
  expoTicketId: "ticket-1",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockExpireStaleReceipts.mockResolvedValue(0);
  mockChunkReceiptIds.mockImplementation((ids: string[]) => {
    const out = [];
    for (let i = 0; i < ids.length; i += 300) out.push(ids.slice(i, i + 300));
    return out;
  });
});

describe("checkExpoPushReceipts", () => {
  it("resolves a delivered receipt without touching the subscription", async () => {
    mockGetPendingReceipts.mockResolvedValue([pendingRow()]);
    mockGetReceipts.mockResolvedValue({ "ticket-1": { status: "ok" } });

    const result = await checkExpoPushReceipts();

    expect(mockResolveReceipt).toHaveBeenCalledWith("audit-1", "ok");
    expect(mockDeactivateByToken).not.toHaveBeenCalled();
    expect(result).toMatchObject({ checked: 1, ok: 1, deactivated: 0 });
  });

  it("deactivates the device on a DeviceNotRegistered receipt", async () => {
    mockGetPendingReceipts.mockResolvedValue([pendingRow()]);
    mockGetReceipts.mockResolvedValue({
      "ticket-1": {
        status: "error",
        message: "device not registered",
        details: { error: "DeviceNotRegistered", expoPushToken: TOKEN_A },
      },
    });

    const result = await checkExpoPushReceipts();

    expect(mockDeactivateByToken).toHaveBeenCalledWith(TOKEN_A);
    expect(mockResolveReceipt).toHaveBeenCalledWith(
      "audit-1",
      "error",
      "device not registered",
    );
    expect(result).toMatchObject({ errored: 1, deactivated: 1 });
  });

  it.each([
    "MessageRateExceeded",
    "MessageTooBig",
    "ProviderError",
    "ExpoError",
  ])(
    "records a %s receipt without killing a live device",
    async (errorCode) => {
      mockGetPendingReceipts.mockResolvedValue([pendingRow()]);
      mockGetReceipts.mockResolvedValue({
        "ticket-1": {
          status: "error",
          message: "transient",
          details: { error: errorCode, expoPushToken: TOKEN_A },
        },
      });

      const result = await checkExpoPushReceipts();

      expect(mockDeactivateByToken).not.toHaveBeenCalled();
      expect(result).toMatchObject({ errored: 1, deactivated: 0 });
    },
  );

  it("queries only tickets old enough to have receipts and young enough to still exist", async () => {
    mockGetPendingReceipts.mockResolvedValue([]);

    await checkExpoPushReceipts();

    const opts = mockGetPendingReceipts.mock.calls[0][0];
    // Expo needs ~15 min to publish a receipt and drops it after ~24h.
    expect(opts.olderThanMs).toBe(15 * 60 * 1000);
    expect(opts.youngerThanMs).toBeLessThan(24 * 60 * 60 * 1000);
    expect(opts.limit).toBeGreaterThan(0);
  });

  it("chunks receipt lookups at Expo's 300-id limit", async () => {
    mockGetPendingReceipts.mockResolvedValue(
      Array.from({ length: 700 }, (_, i) =>
        pendingRow({ id: `audit-${i}`, expoTicketId: `ticket-${i}` }),
      ),
    );
    mockGetReceipts.mockResolvedValue({});

    await checkExpoPushReceipts();

    expect(mockGetReceipts).toHaveBeenCalledTimes(3);
    expect(mockGetReceipts.mock.calls.map((c) => c[0].length)).toEqual([
      300, 300, 100,
    ]);
  });

  it("leaves rows pending when the lookup itself fails, so the next run retries", async () => {
    mockGetPendingReceipts.mockResolvedValue([pendingRow()]);
    mockGetReceipts.mockRejectedValue(new Error("expo unreachable"));

    const result = await checkExpoPushReceipts();

    expect(mockResolveReceipt).not.toHaveBeenCalled();
    expect(result.checked).toBe(0);
  });

  it("expires tickets whose receipts have aged out, so they stop being re-queried", async () => {
    mockGetPendingReceipts.mockResolvedValue([]);
    mockExpireStaleReceipts.mockResolvedValue(4);

    const result = await checkExpoPushReceipts();

    expect(result.expired).toBe(4);
  });

  it("ignores a receipt for a ticket it did not ask about", async () => {
    mockGetPendingReceipts.mockResolvedValue([pendingRow()]);
    mockGetReceipts.mockResolvedValue({
      "ticket-unknown": {
        status: "error",
        details: { error: "DeviceNotRegistered", expoPushToken: TOKEN_A },
      },
    });

    const result = await checkExpoPushReceipts();

    // Never act on a ticket that isn't ours — that would deactivate a device
    // based on an unrelated row.
    expect(mockDeactivateByToken).not.toHaveBeenCalled();
    expect(result.checked).toBe(0);
  });

  it("skips deactivation when the receipt carries no token", async () => {
    mockGetPendingReceipts.mockResolvedValue([pendingRow()]);
    mockGetReceipts.mockResolvedValue({
      "ticket-1": {
        status: "error",
        message: "gone",
        details: { error: "DeviceNotRegistered" },
      },
    });

    const result = await checkExpoPushReceipts();

    expect(mockDeactivateByToken).not.toHaveBeenCalled();
    expect(result.errored).toBe(1);
  });
});
