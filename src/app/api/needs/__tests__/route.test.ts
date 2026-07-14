import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "@/dal/errors";

// ── route-helpers mock ────────────────────────────────────────────────────────

const mockGetAuthenticatedUserResponse = vi.fn();
const mockHandleApiError = vi.fn();

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: unknown[]) =>
    mockGetAuthenticatedUserResponse(...a),
  handleApiError: (...a: unknown[]) => mockHandleApiError(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

// ── session mock ──────────────────────────────────────────────────────────────

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
}));

// ── community visibility mock ─────────────────────────────────────────────────

const mockGetCurrentUserVisibleCommunityIds = vi.fn();
vi.mock("@/features/community/utils/membership", () => ({
  getCurrentUserVisibleCommunityIds: (...a: unknown[]) =>
    mockGetCurrentUserVisibleCommunityIds(...a),
}));

// ── DAL mock ──────────────────────────────────────────────────────────────────

const mockListFeed = vi.fn();
const mockGetUserPrimaryLocation = vi.fn();
vi.mock("@/dal", () => ({
  neighborhoodNeedsDAL: {
    listFeed: (...a: unknown[]) => mockListFeed(...a),
    getUserPrimaryLocation: (...a: unknown[]) =>
      mockGetUserPrimaryLocation(...a),
  },
}));

// ── service mock ──────────────────────────────────────────────────────────────

const mockCreateNeed = vi.fn();
vi.mock(
  "@/features/neighborhood-needs/services/neighborhood-needs-service",
  () => ({
    createNeed: (...a: unknown[]) => mockCreateNeed(...a),
  }),
);

// ── pagination mock ───────────────────────────────────────────────────────────

vi.mock("@/lib/api/pagination", () => ({
  emptyPaginatedResult: (page: number, limit: number) => ({
    data: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  }),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const AUTH_USER = { userId: "user-1", isAdmin: false, user: {} };

const OPEN_NEED = {
  id: "need-1",
  createdByUserId: "user-1",
  communityId: "comm-1",
  type: "rental",
  categoryId: "cat-1",
  title: "Need a drill",
  description: "Something powerful",
  status: "open",
};

const FEED_PAGE = {
  data: [{ ...OPEN_NEED, linkedListingCount: 0 }],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/needs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(query = "") {
  return new NextRequest(`http://localhost/api/needs${query}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockHandleApiError.mockImplementation((err: unknown) => {
    const e = err as { statusCode?: number; message?: string };
    return NextResponse.json(
      { error: e.message ?? "Internal error" },
      { status: e.statusCode ?? 500 },
    );
  });
  mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_USER);
  mockGetCurrentUserVisibleCommunityIds.mockResolvedValue(["comm-1"]);
  mockListFeed.mockResolvedValue(FEED_PAGE);
  mockGetUserPrimaryLocation.mockResolvedValue(null);
  mockCreateNeed.mockResolvedValue(OPEN_NEED);
});

// =============================================================================
// POST /api/needs
// =============================================================================

describe("POST /api/needs", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("../route");
    const res = await POST(
      postReq({
        type: "rental",
        categoryId: "c-1",
        title: "T",
        description: "D",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing required fields", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq({ type: "rental" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for invalid type", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postReq({
        type: "tool",
        categoryId: "c-1",
        title: "T",
        description: "D",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when title exceeds 120 characters", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postReq({
        type: "rental",
        categoryId: "c-1",
        title: "x".repeat(121),
        description: "D",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when service throws ValidationError (no primary community)", async () => {
    mockCreateNeed.mockRejectedValue(
      new ValidationError("You must belong to a community"),
    );
    const { POST } = await import("../route");
    const res = await POST(
      postReq({
        type: "rental",
        categoryId: "00000000-0000-4000-a000-000000000001",
        title: "T",
        description: "D",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 with the created need on success", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postReq({
        type: "rental",
        categoryId: "00000000-0000-4000-a000-000000000001",
        title: "Need a drill",
        description: "Something powerful",
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("need-1");
    expect(mockCreateNeed).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ type: "rental", title: "Need a drill" }),
    );
  });
});

// =============================================================================
// GET /api/needs
// =============================================================================

describe("GET /api/needs", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../route");
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("returns empty page without hitting DAL when visible set is empty", async () => {
    mockGetCurrentUserVisibleCommunityIds.mockResolvedValue([]);
    const { GET } = await import("../route");
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(mockListFeed).not.toHaveBeenCalled();
  });

  it("passes type filter to listFeed", async () => {
    const { GET } = await import("../route");
    await GET(getReq("?type=service"));
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ type: "service" }),
      expect.any(Object),
      null,
    );
  });

  it("defaults openOnly to true", async () => {
    const { GET } = await import("../route");
    await GET(getReq());
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ openOnly: true }),
      expect.any(Object),
      null,
    );
  });

  it("allows openOnly=false", async () => {
    const { GET } = await import("../route");
    await GET(getReq("?openOnly=false"));
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ openOnly: false }),
      expect.any(Object),
      null,
    );
  });

  it("returns feed page with data and pagination", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.pagination.total).toBe(1);
  });

  it("passes pagination params to listFeed", async () => {
    const { GET } = await import("../route");
    await GET(getReq("?page=2&limit=10"));
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      { page: 2, limit: 10 },
      null,
    );
  });

  it("ignores invalid type query param (no type filter)", async () => {
    const { GET } = await import("../route");
    await GET(getReq("?type=invalid"));
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ type: undefined }),
      expect.any(Object),
      null,
    );
  });

  it("maps mine=true to createdByUserId using the session user id", async () => {
    const { GET } = await import("../route");
    await GET(getReq("?mine=true"));
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ createdByUserId: "user-1" }),
      expect.any(Object),
      null,
    );
  });

  it("leaves createdByUserId undefined when mine is absent", async () => {
    const { GET } = await import("../route");
    await GET(getReq());
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ createdByUserId: undefined }),
      expect.any(Object),
      null,
    );
  });

  it("never trusts a client-supplied user id for the mine filter", async () => {
    const { GET } = await import("../route");
    await GET(getReq("?mine=true&userId=someone-else"));
    expect(mockListFeed).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ createdByUserId: "user-1" }),
      expect.any(Object),
      null,
    );
  });
});
