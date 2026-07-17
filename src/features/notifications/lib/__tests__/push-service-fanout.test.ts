import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PushSubscriptionRow } from "@/dal/notifications.dal";
import type { PushPayload } from "../push-payload";

/**
 * Fan-out across web + native subscriptions.
 *
 * Before this file there was no `push-service` test at all and `web-push` was
 * never mocked anywhere in the repo — the suite only avoided the network
 * because `getActiveByUserId` was stubbed to `[]`. This establishes the mocking
 * pattern for both transports.
 *
 * Requirements: 2.2.2, 2.2.3, 2.2.5, 2.2.6
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.2.1 (F5, F6)
 */

const mockSendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

const mockSendPushNotificationsAsync = vi.fn();
const mockChunkPushNotifications = vi.fn();
vi.mock("expo-server-sdk", () => ({
  Expo: class {
    chunkPushNotifications(messages: unknown[]) {
      return mockChunkPushNotifications(messages);
    }
    sendPushNotificationsAsync(chunk: unknown[]) {
      return mockSendPushNotificationsAsync(chunk);
    }
    static isExpoPushToken() {
      return true;
    }
  },
}));

const mockGetActiveByUserId = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockDeactivate = vi.fn();
const mockDeactivateByToken = vi.fn();
vi.mock("@/dal", () => ({
  pushSubscriptionDAL: {
    getActiveByUserId: (...a: unknown[]) => mockGetActiveByUserId(...a),
    createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
    deactivate: (...a: unknown[]) => mockDeactivate(...a),
    deactivateByToken: (...a: unknown[]) => mockDeactivateByToken(...a),
  },
}));

const EXPO_TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
const EXPO_TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]";

const payload: PushPayload = {
  title: "Request approved",
  body: "Your rental request was approved",
  linkUrl: "/dashboard/rentals/rental-1",
  data: { type: "rental_approved", rentalId: "rental-1" },
};

const webRow = (over: Partial<PushSubscriptionRow> = {}): PushSubscriptionRow =>
  ({
    id: "sub-web-1",
    userId: "user-1",
    endpoint: "https://fcm.googleapis.com/fcm/send/web1",
    p256dh: "key",
    auth: "auth",
    platform: "web",
    token: null,
    userAgent: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as PushSubscriptionRow;

const nativeRow = (
  over: Partial<PushSubscriptionRow> = {},
): PushSubscriptionRow =>
  ({
    id: "sub-ios-1",
    userId: "user-1",
    endpoint: EXPO_TOKEN_A,
    p256dh: null,
    auth: null,
    platform: "ios",
    token: EXPO_TOKEN_A,
    userAgent: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as PushSubscriptionRow;

/** Let the fire-and-forget sends settle before asserting. */
const flush = () => new Promise((r) => setTimeout(r, 0));

const ORIGINAL_ENV = { ...process.env };

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.VAPID_PUBLIC_KEY = "test-public-key";
  process.env.VAPID_PRIVATE_KEY = "test-private-key";
  mockSendNotification.mockResolvedValue(undefined);
  // Default: the SDK chunks at 100; mirror that shape without reimplementing it.
  mockChunkPushNotifications.mockImplementation((msgs: unknown[]) => {
    const out = [];
    for (let i = 0; i < msgs.length; i += 100) out.push(msgs.slice(i, i + 100));
    return out;
  });
  mockSendPushNotificationsAsync.mockImplementation(
    async (chunk: { to: string }[]) =>
      chunk.map((_, i) => ({ status: "ok", id: `ticket-${i}` })),
  );
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendPush — fan-out across platforms (Req 2.2.2)", () => {
  it("delivers to every active subscription across web, ios and android", async () => {
    mockGetActiveByUserId.mockResolvedValue([
      webRow(),
      nativeRow({
        id: "sub-ios-1",
        platform: "ios",
        token: EXPO_TOKEN_A,
        endpoint: EXPO_TOKEN_A,
      }),
      nativeRow({
        id: "sub-android-1",
        platform: "android",
        token: EXPO_TOKEN_B,
        endpoint: EXPO_TOKEN_B,
      }),
    ]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    // One web send via VAPID...
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    // ...and both native tokens in a single Expo chunk.
    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    const sentChunk = mockSendPushNotificationsAsync.mock.calls[0][0];
    expect(sentChunk.map((m: { to: string }) => m.to)).toEqual([
      EXPO_TOKEN_A,
      EXPO_TOKEN_B,
    ]);
  });

  it("sends native push even when VAPID is not configured", async () => {
    // The regression this whole restructure exists for: the VAPID gate used to
    // sit at the top of sendPush and return early for everyone, which would
    // have silently dropped every native push wherever VAPID is unset (F5).
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    mockGetActiveByUserId.mockResolvedValue([webRow(), nativeRow()]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("does not touch the Expo path for a web-only user", async () => {
    mockGetActiveByUserId.mockResolvedValue([webRow()]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it("skips a corrupt web row rather than sending null keys to web-push", async () => {
    // Only reachable since p256dh/auth became nullable (F1).
    mockGetActiveByUserId.mockResolvedValue([webRow({ p256dh: null })]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    expect(mockSendNotification).not.toHaveBeenCalled();
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it("chunks sends above Expo's 100-message limit", async () => {
    const rows = Array.from({ length: 250 }, (_, i) =>
      nativeRow({
        id: `sub-${i}`,
        token: `ExponentPushToken[${String(i).padStart(22, "0")}]`,
        endpoint: `ExponentPushToken[${String(i).padStart(22, "0")}]`,
      }),
    );
    mockGetActiveByUserId.mockResolvedValue(rows);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(3);
    const sizes = mockSendPushNotificationsAsync.mock.calls.map(
      (c) => c[0].length,
    );
    expect(sizes).toEqual([100, 100, 50]);
  });
});

describe("sendExpoPush — payload (Req 2.2.3)", () => {
  it("carries only reference IDs and type — no PII", async () => {
    mockGetActiveByUserId.mockResolvedValue([nativeRow()]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    const message = mockSendPushNotificationsAsync.mock.calls[0][0][0];
    expect(message.data).toEqual({
      type: "rental_approved",
      rentalId: "rental-1",
      linkUrl: "/dashboard/rentals/rental-1",
    });
    // The whole payload, serialized, must hold no financial or personal fields.
    const serialized = JSON.stringify(message);
    expect(serialized).not.toMatch(/\$|amount|price|email|phone|address/i);
  });
});

describe("sendExpoPush — audit rows (Req 2.2.5)", () => {
  it("records an accepted ticket as pending, not delivered", async () => {
    mockGetActiveByUserId.mockResolvedValue([nativeRow()]);
    mockSendPushNotificationsAsync.mockResolvedValue([
      { status: "ok", id: "ticket-abc" },
    ]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      "user-1",
      "sub-ios-1",
      "rental_approved",
      true,
      null,
      // A ticket means Expo accepted it, not that a device got it — only the
      // receipt (task 2.2.2) can confirm that.
      { expoTicketId: "ticket-abc", receiptStatus: "pending" },
    );
  });

  it("records a chunk-level transport failure per message", async () => {
    mockGetActiveByUserId.mockResolvedValue([nativeRow()]);
    mockSendPushNotificationsAsync.mockRejectedValue(new Error("expo is down"));

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      "user-1",
      "sub-ios-1",
      "rental_approved",
      false,
      "expo is down",
    );
  });
});

describe("sendExpoPush — DeviceNotRegistered at ticket time (Req 2.2.4)", () => {
  it("deactivates the subscription immediately, without waiting for a receipt", async () => {
    mockGetActiveByUserId.mockResolvedValue([nativeRow()]);
    mockSendPushNotificationsAsync.mockResolvedValue([
      {
        status: "error",
        message: "device not registered",
        details: { error: "DeviceNotRegistered", expoPushToken: EXPO_TOKEN_A },
      },
    ]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    expect(mockDeactivateByToken).toHaveBeenCalledWith(EXPO_TOKEN_A);
  });

  it.each(["MessageRateExceeded", "MessageTooBig", "ProviderError"])(
    "does not deactivate a live device on a %s ticket",
    async (errorCode) => {
      // Deactivating here would kill a working device over a transient error.
      mockGetActiveByUserId.mockResolvedValue([nativeRow()]);
      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: "error", message: "nope", details: { error: errorCode } },
      ]);

      const { sendPush } = await import("../push-service");
      await sendPush("user-1", payload);
      await flush();

      expect(mockDeactivateByToken).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        "user-1",
        "sub-ios-1",
        "rental_approved",
        false,
        "nope",
        { expoTicketId: null, receiptStatus: "error" },
      );
    },
  );

  it("attributes a ticket to the right subscription within a chunk", async () => {
    // Tickets align positionally with messages; getting this wrong would
    // deactivate an innocent device.
    mockGetActiveByUserId.mockResolvedValue([
      nativeRow({ id: "sub-a", token: EXPO_TOKEN_A, endpoint: EXPO_TOKEN_A }),
      nativeRow({ id: "sub-b", token: EXPO_TOKEN_B, endpoint: EXPO_TOKEN_B }),
    ]);
    mockSendPushNotificationsAsync.mockResolvedValue([
      { status: "ok", id: "ticket-a" },
      {
        status: "error",
        message: "gone",
        details: { error: "DeviceNotRegistered" },
      },
    ]);

    const { sendPush } = await import("../push-service");
    await sendPush("user-1", payload);
    await flush();

    // Only the *second* device is dead.
    expect(mockDeactivateByToken).toHaveBeenCalledTimes(1);
    expect(mockDeactivateByToken).toHaveBeenCalledWith(EXPO_TOKEN_B);
  });
});
