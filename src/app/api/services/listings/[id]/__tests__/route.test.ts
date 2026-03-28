import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockDeleteListing = vi.fn();

vi.mock("@/dal", () => ({
  communityDAL: {},
  serviceListingDAL: {},
}));

vi.mock("@/features/services/services/service-listing-service", () => ({
  ServiceListingService: {
    deleteListing: (...args: unknown[]) => mockDeleteListing(...args),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: async <T>(promise: Promise<T>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  },
  requireAuthResponse: vi.fn(),
  getCurrentUserId: vi.fn(),
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  getUserAgent: vi.fn().mockReturnValue("vitest"),
  parseFormData: vi.fn(),
}));

import { DELETE } from "../route";

describe("DELETE /api/services/listings/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuthResponse, getCurrentUserId } =
      await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(null);
    vi.mocked(getCurrentUserId).mockResolvedValue("provider-1");
  });

  it("returns 401 when requireAuthResponse blocks", async () => {
    const { requireAuthResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/services/listings/list-1"),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(401);
    expect(mockDeleteListing).not.toHaveBeenCalled();
  });

  it("returns 200 and success true when deletion succeeds", async () => {
    mockDeleteListing.mockResolvedValue(undefined);

    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/services/listings/list-1"),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(mockDeleteListing).toHaveBeenCalledWith(
      "list-1",
      "provider-1",
      expect.objectContaining({
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      }),
    );
  });

  it("returns error response when service throws", async () => {
    mockDeleteListing.mockRejectedValue(new Error("has bookings"));

    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/services/listings/list-1"),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "has bookings" });
  });
});
