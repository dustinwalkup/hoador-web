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
    getActiveByUserId: vi.fn().mockResolvedValue([]),
    getByEndpoint: vi.fn(),
    deactivate: vi.fn(),
  },
}));

import { POST } from "./route";
import { pushSubscriptionDAL } from "@/dal";

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
