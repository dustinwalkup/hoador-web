import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAuthResponse = vi.fn().mockResolvedValue(null);
const mockGetCurrentUserId = vi.fn().mockResolvedValue("user-1");

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: vi.fn((err: unknown) => {
    throw err;
  }),
  requireAuthResponse: (...args: unknown[]) => mockRequireAuthResponse(...args),
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

vi.mock("@/dal", () => ({
  pushSubscriptionDAL: {
    create: vi.fn(),
    createNative: vi.fn(),
    getActiveByUserId: vi.fn().mockResolvedValue([]),
    getByEndpoint: vi.fn(),
    getByToken: vi.fn(),
    deactivate: vi.fn(),
    deactivateByToken: vi.fn(),
  },
}));

import { POST, DELETE } from "./route";
import { pushSubscriptionDAL } from "@/dal";

/** A well-formed Expo token — `Expo.isExpoPushToken` is the real validator. */
const EXPO_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

describe("POST /api/push/subscribe", () => {
  const validBody = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: { p256dh: "BNcRdreALRF...", auth: "tBHItq..." },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("user-1");
    vi.mocked(pushSubscriptionDAL.create).mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      endpoint: validBody.endpoint,
      p256dh: validBody.keys.p256dh,
      auth: validBody.keys.auth,
      platform: "web",
      token: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    } as Awaited<ReturnType<typeof pushSubscriptionDAL.create>>);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuthResponse.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(pushSubscriptionDAL.create).not.toHaveBeenCalled();
  });

  it("returns 401 when getCurrentUserId returns null", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(pushSubscriptionDAL.create).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid payload (missing endpoint)", async () => {
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ keys: validBody.keys }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid payload");
    expect(pushSubscriptionDAL.create).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid payload (missing keys.p256dh)", async () => {
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: validBody.endpoint,
        keys: { auth: validBody.keys.auth },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(pushSubscriptionDAL.create).not.toHaveBeenCalled();
  });

  it("returns 201 on success", async () => {
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "user-agent": "Mozilla/5.0" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(pushSubscriptionDAL.create).toHaveBeenCalledWith(
      "user-1",
      {
        endpoint: validBody.endpoint,
        keys: validBody.keys,
        expirationTime: undefined,
      },
      "Mozilla/5.0",
    );
    const json = await res.json();
    expect(json.id).toBe("sub-1");
    expect(json.endpoint).toBe(validBody.endpoint);
  });
});

// ---- Native (Expo) subscriptions. Requirements: 2.2.1 ----
// Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.1

describe("POST /api/push/subscribe — native payload", () => {
  const nativeBody = { platform: "ios" as const, token: EXPO_TOKEN };

  const post = (body: unknown, headers?: Record<string, string>) =>
    POST(
      new NextRequest("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("user-1");
    vi.mocked(pushSubscriptionDAL.createNative).mockResolvedValue({
      id: "sub-native-1",
      userId: "user-1",
      endpoint: EXPO_TOKEN,
      p256dh: null,
      auth: null,
      platform: "ios",
      token: EXPO_TOKEN,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    } as Awaited<ReturnType<typeof pushSubscriptionDAL.createNative>>);
  });

  it.each(["ios", "android"] as const)(
    "persists a %s subscription and returns 201",
    async (platform) => {
      const res = await post(
        { platform, token: EXPO_TOKEN },
        { "user-agent": "hoador-mobile/1.0" },
      );

      expect(res.status).toBe(201);
      expect(pushSubscriptionDAL.createNative).toHaveBeenCalledWith(
        "user-1",
        { platform, token: EXPO_TOKEN },
        "hoador-mobile/1.0",
      );
      // The native branch must never fall through to the web DAL path, which
      // would throw on the absent p256dh/auth keys.
      expect(pushSubscriptionDAL.create).not.toHaveBeenCalled();
      expect((await res.json()).id).toBe("sub-native-1");
    },
  );

  it.each([
    ["a malformed token", { platform: "ios", token: "not-a-real-token" }],
    ["an empty token", { platform: "ios", token: "" }],
    ["an unsupported platform", { platform: "windows", token: EXPO_TOKEN }],
    ["a missing token", { platform: "ios" }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(pushSubscriptionDAL.createNative).not.toHaveBeenCalled();
    expect(pushSubscriptionDAL.create).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuthResponse.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );
    const res = await post(nativeBody);
    expect(res.status).toBe(401);
    expect(pushSubscriptionDAL.createNative).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/push/subscribe", () => {
  const del = (body: unknown) =>
    DELETE(
      new NextRequest("http://localhost/api/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("user-1");
  });

  it("deactivates a native subscription by token", async () => {
    vi.mocked(pushSubscriptionDAL.getByToken).mockResolvedValue({
      id: "sub-native-1",
      userId: "user-1",
      token: EXPO_TOKEN,
    } as Awaited<ReturnType<typeof pushSubscriptionDAL.getByToken>>);

    const res = await del({ token: EXPO_TOKEN });

    expect(res.status).toBe(204);
    // Token-scoped, not id-scoped: collapses duplicate rows for one device.
    expect(pushSubscriptionDAL.deactivateByToken).toHaveBeenCalledWith(
      EXPO_TOKEN,
    );
  });

  it("deactivates a web subscription by endpoint (regression)", async () => {
    vi.mocked(pushSubscriptionDAL.getByEndpoint).mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    } as Awaited<ReturnType<typeof pushSubscriptionDAL.getByEndpoint>>);

    const res = await del({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    });

    expect(res.status).toBe(204);
    expect(pushSubscriptionDAL.deactivate).toHaveBeenCalledWith("sub-1");
    expect(pushSubscriptionDAL.deactivateByToken).not.toHaveBeenCalled();
  });

  it("refuses to deactivate another user's device", async () => {
    // Knowing a token must not be enough to silence someone else's phone.
    vi.mocked(pushSubscriptionDAL.getByToken).mockResolvedValue({
      id: "sub-native-9",
      userId: "someone-else",
      token: EXPO_TOKEN,
    } as Awaited<ReturnType<typeof pushSubscriptionDAL.getByToken>>);

    const res = await del({ token: EXPO_TOKEN });

    expect(res.status).toBe(404);
    expect(pushSubscriptionDAL.deactivateByToken).not.toHaveBeenCalled();
    expect(pushSubscriptionDAL.deactivate).not.toHaveBeenCalled();
  });

  it.each([
    ["neither endpoint nor token", {}],
    ["both endpoint and token", { endpoint: "https://x/y", token: EXPO_TOKEN }],
  ])("rejects a body with %s", async (_label, body) => {
    const res = await del(body);
    expect(res.status).toBe(400);
    expect(pushSubscriptionDAL.deactivate).not.toHaveBeenCalled();
    expect(pushSubscriptionDAL.deactivateByToken).not.toHaveBeenCalled();
  });

  it("returns 404 when the subscription does not exist", async () => {
    vi.mocked(pushSubscriptionDAL.getByToken).mockResolvedValue(null);
    const res = await del({ token: EXPO_TOKEN });
    expect(res.status).toBe(404);
  });
});
