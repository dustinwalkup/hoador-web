import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { NotFoundError } from "@/dal/errors";

const mockGetAuthenticatedUserResponse = vi.fn();
const mockHandleApiError = vi.fn().mockImplementation((error: unknown) => {
  const err = error as { statusCode?: number; message?: string };
  return new Response(JSON.stringify({ error: err.message ?? "error" }), {
    status: err.statusCode ?? 500,
    headers: { "Content-Type": "application/json" },
  });
});

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: any[]) =>
    mockGetAuthenticatedUserResponse(...a),
  handleApiError: (...a: any[]) => mockHandleApiError(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetNetworkBySlug = vi.fn();
const mockListCommunitiesByNetwork = vi.fn();
vi.mock("@/dal", () => ({
  communityDAL: {
    getNetworkBySlug: (...a: any[]) => mockGetNetworkBySlug(...a),
    listCommunitiesByNetwork: (...a: any[]) =>
      mockListCommunitiesByNetwork(...a),
  },
}));

function req(query: string) {
  return new NextRequest(`http://localhost/api/communities${query}`);
}

describe("GET /api/communities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "user-1" });
    mockGetNetworkBySlug.mockResolvedValue({ id: "net-1", slug: "kc" });
    mockListCommunitiesByNetwork.mockResolvedValue([
      { id: "c1", name: "Foxcroft" },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "unauth" }, { status: 401 }),
    );
    const { GET } = await import("../route");
    const res = await GET(req("?networkSlug=kc"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when networkSlug is missing", async () => {
    const { GET } = await import("../route");
    const res = await GET(req(""));
    expect(res.status).toBe(400);
    expect(mockGetNetworkBySlug).not.toHaveBeenCalled();
  });

  it("returns 404 when the network does not exist", async () => {
    mockGetNetworkBySlug.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(req("?networkSlug=missing"));
    expect(res.status).toBe(404);
    expect(mockHandleApiError).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it("returns communities (active-only by default) with a cache header", async () => {
    const { GET } = await import("../route");
    const res = await GET(req("?networkSlug=kc"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual([{ id: "c1", name: "Foxcroft" }]);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(mockListCommunitiesByNetwork).toHaveBeenCalledWith("net-1", {
      activeOnly: true,
    });
  });

  it("honours active=false", async () => {
    const { GET } = await import("../route");
    await GET(req("?networkSlug=kc&active=false"));
    expect(mockListCommunitiesByNetwork).toHaveBeenCalledWith("net-1", {
      activeOnly: false,
    });
  });
});
