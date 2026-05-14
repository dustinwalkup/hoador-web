import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockDeleteListing = vi.fn();
const mockGetById = vi.fn();
const mockIsVisibleInCommunity = vi.fn();

vi.mock("@/dal", () => ({
  communityDAL: {
    isVisibleInCommunity: (...args: unknown[]) =>
      mockIsVisibleInCommunity(...args),
  },
  serviceListingDAL: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
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

import { DELETE, GET } from "../route";

const reqFor = (id = "list-1") =>
  new NextRequest(`http://localhost:3000/api/services/listings/${id}`);
const paramsFor = (id = "list-1") => ({ params: Promise.resolve({ id }) });

describe("GET /api/services/listings/[id]", () => {
  const activeListing = {
    id: "list-1",
    providerId: "provider-1",
    communityId: "comm-1",
    status: "active" as const,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuthResponse, getCurrentUserId } =
      await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(null);
    vi.mocked(getCurrentUserId).mockResolvedValue("viewer-1");
    mockGetById.mockResolvedValue(activeListing);
    mockIsVisibleInCommunity.mockResolvedValue(true);
  });

  it("returns 401 when requireAuthResponse blocks", async () => {
    const { requireAuthResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(reqFor(), paramsFor());

    expect(res.status).toBe(401);
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it("returns 404 when the listing does not exist", async () => {
    mockGetById.mockResolvedValue(null);

    const res = await GET(reqFor(), paramsFor());

    expect(res.status).toBe(404);
  });

  it("returns the listing to the provider regardless of community visibility or status", async () => {
    const { getCurrentUserId } = await import("@/lib/api/route-helpers");
    vi.mocked(getCurrentUserId).mockResolvedValue("provider-1");
    mockGetById.mockResolvedValue({ ...activeListing, status: "inactive" });

    const res = await GET(reqFor(), paramsFor());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: "list-1" });
    expect(mockIsVisibleInCommunity).not.toHaveBeenCalled();
  });

  it("returns the listing to a non-provider when active and both are visible in its community", async () => {
    const res = await GET(reqFor(), paramsFor());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: "list-1" });
    expect(mockIsVisibleInCommunity).toHaveBeenCalledWith("viewer-1", "comm-1");
    expect(mockIsVisibleInCommunity).toHaveBeenCalledWith(
      "provider-1",
      "comm-1",
    );
  });

  it("returns 403 to a non-provider when the listing is not active", async () => {
    mockGetById.mockResolvedValue({ ...activeListing, status: "paused" });

    const res = await GET(reqFor(), paramsFor());

    expect(res.status).toBe(403);
    expect(mockIsVisibleInCommunity).not.toHaveBeenCalled();
  });

  it("returns 403 to a non-provider when the viewer is not visible in the listing's community", async () => {
    mockIsVisibleInCommunity.mockImplementation(
      async (userId: string) => userId === "provider-1",
    );

    const res = await GET(reqFor(), paramsFor());

    expect(res.status).toBe(403);
  });

  it("returns 403 to a non-provider when the provider is not visible in the listing's community", async () => {
    mockIsVisibleInCommunity.mockImplementation(
      async (userId: string) => userId === "viewer-1",
    );

    const res = await GET(reqFor(), paramsFor());

    expect(res.status).toBe(403);
  });
});

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

    const res = await DELETE(reqFor(), paramsFor());

    expect(res.status).toBe(401);
    expect(mockDeleteListing).not.toHaveBeenCalled();
  });

  it("returns 200 and success true when deletion succeeds", async () => {
    mockDeleteListing.mockResolvedValue(undefined);

    const res = await DELETE(reqFor(), paramsFor());

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

    const res = await DELETE(reqFor(), paramsFor());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "has bookings" });
  });
});
