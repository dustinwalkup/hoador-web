import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAdminResponse = vi.fn();
const mockGetAuthenticatedUserResponse = vi.fn();
const mockHandleApiError = vi.fn().mockImplementation((error: unknown) => {
  const err = error as { statusCode?: number; message?: string };
  return new Response(JSON.stringify({ error: err.message ?? "error" }), {
    status: err.statusCode ?? 500,
    headers: { "Content-Type": "application/json" },
  });
});

vi.mock("@/lib/api/route-helpers", () => ({
  requireAdminResponse: (...a: any[]) => mockRequireAdminResponse(...a),
  getAuthenticatedUserResponse: (...a: any[]) =>
    mockGetAuthenticatedUserResponse(...a),
  handleApiError: (...a: any[]) => mockHandleApiError(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockListPendingVerifications = vi.fn();
vi.mock("@/dal", () => ({
  communityDAL: {
    listPendingVerifications: (...a: any[]) =>
      mockListPendingVerifications(...a),
  },
}));

function req(query = "") {
  return new NextRequest(
    `http://localhost/api/admin/community-memberships/pending${query}`,
  );
}

describe("GET /api/admin/community-memberships/pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "admin-1" });
    mockListPendingVerifications.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
    });
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      ),
    );
    const { GET } = await import("../route");
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(mockListPendingVerifications).not.toHaveBeenCalled();
  });

  it("returns the paginated queue with default page/limit", async () => {
    const { GET } = await import("../route");
    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.pagination.limit).toBe(25);
    expect(mockListPendingVerifications).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      communityId: undefined,
    });
  });

  it("passes through query params", async () => {
    const { GET } = await import("../route");
    await GET(req("?page=2&limit=10&communityId=c-9"));
    expect(mockListPendingVerifications).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      communityId: "c-9",
    });
  });
});
