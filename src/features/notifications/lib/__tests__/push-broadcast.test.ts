import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PushSubscriptionRow } from "@/dal/notifications.dal";
import type { PushPayload } from "../push-payload";

/**
 * Multi-user push for community-wide fan-outs (PERF-02): `broadcastPush` and
 * `sendExpoPushBroadcast`. Same transport mocks as `push-service-fanout.test.ts`.
 * The point of the batch path is a DB cost that doesn't grow per recipient:
 * one bulk audit write and one bulk deactivation, whatever the recipient count.
 */

const mockWebPushSend = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockWebPushSend(...args),
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
  },
}));

const mockCreateAuditLog = vi.fn();
const mockCreateAuditLogs = vi.fn();
const mockDeactivateByToken = vi.fn();
const mockDeactivateByTokens = vi.fn();
vi.mock("@/dal", () => ({
  pushSubscriptionDAL: {
    createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
    createAuditLogs: (...a: unknown[]) => mockCreateAuditLogs(...a),
    deactivate: vi.fn(),
    deactivateByToken: (...a: unknown[]) => mockDeactivateByToken(...a),
    deactivateByTokens: (...a: unknown[]) => mockDeactivateByTokens(...a),
  },
}));

const payload: PushPayload = {
  title: "New Neighborhood Need",
  body: 'A neighbor posted a new rental request: "Need a drill"',
  linkUrl: "https://hoador.com/dashboard/needs/need-1",
  data: { type: "neighborhood_need_created", needId: "need-1" },
};

const nativeRow = (i: number, over: Partial<PushSubscriptionRow> = {}) =>
  ({
    id: `sub-${i}`,
    userId: `user-${i}`,
    endpoint: `ExponentPushToken[${i}]`,
    p256dh: null,
    auth: null,
    platform: i % 2 ? "android" : "ios",
    token: `ExponentPushToken[${i}]`,
    userAgent: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as PushSubscriptionRow & { token: string };

const webRow = (i: number, userId: string) =>
  ({
    id: `sub-web-${i}`,
    userId,
    endpoint: `https://fcm.googleapis.com/fcm/send/web${i}`,
    p256dh: "key",
    auth: "auth",
    platform: "web",
    token: null,
    userAgent: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as PushSubscriptionRow;

const rows = (n: number) => Array.from({ length: n }, (_, i) => nativeRow(i));

type AuditEntry = {
  userId: string;
  subscriptionId: string | null;
  success: boolean;
  errorMessage?: string | null;
  receipt?: { expoTicketId: string | null; receiptStatus: string };
};
const auditsWritten = (): AuditEntry[] =>
  mockCreateAuditLogs.mock.calls.flatMap(([entries]) => entries);

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.VAPID_PUBLIC_KEY = "test-public-key";
  process.env.VAPID_PRIVATE_KEY = "test-private-key";
  mockWebPushSend.mockResolvedValue(undefined);
  mockChunkPushNotifications.mockImplementation((msgs: unknown[]) => {
    const out = [];
    for (let i = 0; i < msgs.length; i += 100) out.push(msgs.slice(i, i + 100));
    return out;
  });
  mockSendPushNotificationsAsync.mockImplementation(
    async (chunk: { to: string }[]) =>
      chunk.map((m) => ({ status: "ok", id: `ticket-${m.to}` })),
  );
  mockCreateAuditLogs.mockResolvedValue(undefined);
  mockDeactivateByTokens.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendExpoPushBroadcast", () => {
  it("sends 250 recipients in 3 chunks with ONE bulk audit write, not 250", async () => {
    const { sendExpoPushBroadcast } = await import("../expo-push-service");

    await sendExpoPushBroadcast(rows(250), payload);

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(3);
    expect(mockCreateAuditLogs).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(auditsWritten()).toHaveLength(250);
    // Accepted, not delivered: pending for the receipt cron, as handleTicket does.
    expect(auditsWritten()[0]).toMatchObject({
      userId: "user-0",
      subscriptionId: "sub-0",
      eventType: "neighborhood_need_created",
      success: true,
      receipt: {
        expoTicketId: "ticket-ExponentPushToken[0]",
        receiptStatus: "pending",
      },
    });
    expect(mockDeactivateByTokens).not.toHaveBeenCalled();
  });

  it("sends the same allowlisted payload to every device", async () => {
    const { sendExpoPushBroadcast } = await import("../expo-push-service");

    await sendExpoPushBroadcast(rows(2), payload);

    expect(mockSendPushNotificationsAsync.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        to: "ExponentPushToken[0]",
        title: payload.title,
        body: payload.body,
        data: { ...payload.data, linkUrl: payload.linkUrl },
      }),
      expect.objectContaining({ to: "ExponentPushToken[1]" }),
    ]);
  });

  it("maps each ticket to its own row across chunks and deactivates dead tokens in one call", async () => {
    mockSendPushNotificationsAsync.mockImplementation(
      async (chunk: { to: string }[]) =>
        chunk.map((m) =>
          m.to === "ExponentPushToken[150]"
            ? {
                status: "error",
                message: "not registered",
                details: { error: "DeviceNotRegistered" },
              }
            : { status: "ok", id: `ticket-${m.to}` },
        ),
    );
    const { sendExpoPushBroadcast } = await import("../expo-push-service");

    await sendExpoPushBroadcast(rows(250), payload);

    const failed = auditsWritten().filter((a) => !a.success);
    expect(failed).toEqual([
      expect.objectContaining({
        userId: "user-150",
        subscriptionId: "sub-150",
        errorMessage: "not registered",
        receipt: { expoTicketId: null, receiptStatus: "error" },
      }),
    ]);
    expect(mockDeactivateByTokens).toHaveBeenCalledTimes(1);
    expect(mockDeactivateByTokens).toHaveBeenCalledWith([
      "ExponentPushToken[150]",
    ]);
    expect(mockDeactivateByToken).not.toHaveBeenCalled();
  });

  it("audits a shared device token to each user's own row", async () => {
    const shared = "ExponentPushToken[shared]";
    const { sendExpoPushBroadcast } = await import("../expo-push-service");

    await sendExpoPushBroadcast(
      [
        nativeRow(1, { token: shared, endpoint: shared }),
        nativeRow(2, { token: shared, endpoint: shared }),
      ],
      payload,
    );

    expect(auditsWritten().map((a) => [a.userId, a.subscriptionId])).toEqual([
      ["user-1", "sub-1"],
      ["user-2", "sub-2"],
    ]);
  });

  it("audits a failed chunk per row and still sends the other chunks", async () => {
    mockSendPushNotificationsAsync
      .mockRejectedValueOnce(new Error("expo 503"))
      .mockImplementation(async (chunk: { to: string }[]) =>
        chunk.map((m) => ({ status: "ok", id: `ticket-${m.to}` })),
      );
    const { sendExpoPushBroadcast } = await import("../expo-push-service");

    await sendExpoPushBroadcast(rows(150), payload);

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(2);
    const audits = auditsWritten();
    expect(audits.filter((a) => !a.success)).toHaveLength(100);
    expect(audits.filter((a) => a.success)).toHaveLength(50);
    expect(audits[0]).toMatchObject({
      userId: "user-0",
      success: false,
      errorMessage: "expo 503",
    });
  });

  it("sends nothing and audits every row when the payload is too large", async () => {
    const { sendExpoPushBroadcast } = await import("../expo-push-service");

    await sendExpoPushBroadcast(rows(3), {
      ...payload,
      body: "x".repeat(5000),
    });

    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(auditsWritten()).toHaveLength(3);
    expect(auditsWritten().every((a) => !a.success)).toBe(true);
  });

  it("is a no-op for no rows", async () => {
    const { sendExpoPushBroadcast } = await import("../expo-push-service");

    await sendExpoPushBroadcast([], payload);

    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(mockCreateAuditLogs).not.toHaveBeenCalled();
  });
});

describe("broadcastPush", () => {
  it("batches native rows and keeps web rows on web-push, awaiting both", async () => {
    const { broadcastPush } = await import("../push-service");

    await broadcastPush(
      [nativeRow(1), webRow(1, "user-9"), nativeRow(2), webRow(2, "user-9")],
      payload,
    );

    // One Expo send for both native rows.
    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockSendPushNotificationsAsync.mock.calls[0][0]).toHaveLength(2);
    // Both web subscriptions, already settled when broadcastPush resolves.
    expect(mockWebPushSend).toHaveBeenCalledTimes(2);
  });

  it("still sends native when VAPID is not configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { broadcastPush } = await import("../push-service");

    await broadcastPush([nativeRow(1), webRow(1, "user-9")], payload);

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockWebPushSend).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not reject when the native send fails", async () => {
    mockCreateAuditLogs.mockRejectedValue(new Error("audit down"));
    const { broadcastPush } = await import("../push-service");

    await expect(
      broadcastPush([nativeRow(1)], payload),
    ).resolves.toBeUndefined();
  });
});
