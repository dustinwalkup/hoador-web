import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "@/dal/errors";

const mockRequireAdminResponse = vi.fn();
const mockGetAuthenticatedUserResponse = vi.fn();
const mockParseFormData = vi.fn();
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
  parseFormData: (...a: any[]) => mockParseFormData(...a),
  handleApiError: (...a: any[]) => mockHandleApiError(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockListCommunities = vi.fn();
const mockCreateCommunity = vi.fn();
vi.mock("@/dal", () => ({
  communityDAL: {
    listCommunities: (...a: any[]) => mockListCommunities(...a),
    createCommunity: (...a: any[]) => mockCreateCommunity(...a),
  },
}));

function getReq(query = "") {
  return new NextRequest(`http://localhost/api/admin/communities${query}`);
}
function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/communities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/communities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "admin-1" });
    mockListCommunities.mockResolvedValue({
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
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("lists communities with parsed query options", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      getReq(
        "?page=3&limit=5&includeStats=true&sortBy=memberCount&sortOrder=desc",
      ),
    );
    expect(res.status).toBe(200);
    expect(mockListCommunities).toHaveBeenCalledWith({
      page: 3,
      limit: 5,
      includeStats: true,
      sortBy: "memberCount",
      sortOrder: "desc",
    });
  });
});

describe("POST /api/admin/communities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "admin-1" });
    mockParseFormData.mockResolvedValue({ name: "New Community" });
    mockCreateCommunity.mockResolvedValue({
      id: "c-new",
      name: "New Community",
    });
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      ),
    );
    const { POST } = await import("../route");
    const res = await POST(postReq({ name: "x" }));
    expect(res.status).toBe(403);
    expect(mockCreateCommunity).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    mockParseFormData.mockResolvedValue({});
    const { POST } = await import("../route");
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect(mockCreateCommunity).not.toHaveBeenCalled();
  });

  it("creates a community and returns 201", async () => {
    mockParseFormData.mockResolvedValue({
      name: "New Community",
      city: "Lenexa",
      networkId: "net-1",
    });
    const { POST } = await import("../route");
    const res = await POST(
      postReq({ name: "New Community", city: "Lenexa", networkId: "net-1" }),
    );
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json).toEqual({ id: "c-new", name: "New Community" });
    expect(mockCreateCommunity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Community",
        city: "Lenexa",
        networkId: "net-1",
        isActive: true,
        joinCode: null,
      }),
    );
  });

  it("maps a ValidationError from the DAL to a 400", async () => {
    mockCreateCommunity.mockRejectedValue(
      new ValidationError("Join code already exists"),
    );
    const { POST } = await import("../route");
    const res = await POST(postReq({ name: "Dup" }));
    expect(res.status).toBe(400);
  });
});
