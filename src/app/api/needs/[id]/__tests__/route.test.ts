import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ForbiddenError, ValidationError } from "@/dal/errors";

// ── route-helpers mock ────────────────────────────────────────────────────────

const mockGetAuthenticatedUserResponse = vi.fn();
const mockRequireAdminResponse = vi.fn();
const mockHandleApiError = vi.fn((err: unknown) => {
  const e = err as { statusCode?: number; message?: string };
  return NextResponse.json(
    { error: e.message ?? "Internal error" },
    { status: e.statusCode ?? 500 },
  );
});

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: unknown[]) =>
    mockGetAuthenticatedUserResponse(...a),
  requireAdminResponse: (...a: unknown[]) => mockRequireAdminResponse(...a),
  handleApiError: (err: unknown) => mockHandleApiError(err),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
}));

// ── DAL mock ──────────────────────────────────────────────────────────────────

const mockGetNeedDetail = vi.fn();
const mockGetVisibleCommunityIds = vi.fn();

vi.mock("@/dal", () => ({
  neighborhoodNeedsDAL: {
    getNeedDetail: (...a: unknown[]) => mockGetNeedDetail(...a),
  },
  communityDAL: {
    getVisibleCommunityIds: (...a: unknown[]) =>
      mockGetVisibleCommunityIds(...a),
  },
}));

// ── service mock ──────────────────────────────────────────────────────────────

const mockUpdateNeed = vi.fn();
const mockDeleteNeed = vi.fn();

vi.mock(
  "@/features/neighborhood-needs/services/neighborhood-needs-service",
  () => ({
    updateNeed: (...a: unknown[]) => mockUpdateNeed(...a),
    deleteNeed: (...a: unknown[]) => mockDeleteNeed(...a),
  }),
);

// ── fixtures ──────────────────────────────────────────────────────────────────

const AUTH_OWNER = { userId: "user-1", isAdmin: false, user: {} };
const AUTH_OTHER = { userId: "user-2", isAdmin: false, user: {} };
const AUTH_ADMIN = { userId: "admin-1", isAdmin: true, user: {} };

const OPEN_NEED_DETAIL = {
  id: "need-1",
  createdByUserId: "user-1",
  communityId: "comm-1",
  type: "rental",
  categoryId: "cat-1",
  title: "Need a drill",
  description: "Something powerful",
  status: "open",
  linkedListings: [],
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function getReq(id: string) {
  return new NextRequest(`http://localhost/api/needs/${id}`);
}
function patchReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/needs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function deleteReq(id: string) {
  return new NextRequest(`http://localhost/api/needs/${id}`, {
    method: "DELETE",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_OWNER);
  mockRequireAdminResponse.mockResolvedValue(null);
  mockGetNeedDetail.mockResolvedValue(OPEN_NEED_DETAIL);
  mockGetVisibleCommunityIds.mockResolvedValue(["comm-1"]);
  mockUpdateNeed.mockResolvedValue({ ...OPEN_NEED_DETAIL, title: "Updated" });
  mockDeleteNeed.mockResolvedValue(undefined);
});

// =============================================================================
// GET /api/needs/[id]
// =============================================================================

describe("GET /api/needs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../route");
    const res = await GET(getReq("need-1"), params("need-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when need does not exist", async () => {
    mockGetNeedDetail.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(getReq("need-1"), params("need-1"));
    expect(res.status).toBe(404);
  });

  it("returns the need detail to the owner without visibility check", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq("need-1"), params("need-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("need-1");
    expect(mockGetVisibleCommunityIds).not.toHaveBeenCalled();
  });

  it("returns 404 for a viewer outside the need's network", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_OTHER);
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-other"]);
    const { GET } = await import("../route");
    const res = await GET(getReq("need-1"), params("need-1"));
    expect(res.status).toBe(404);
  });

  it("returns the need to a viewer inside the network", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_OTHER);
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-1"]);
    const { GET } = await import("../route");
    const res = await GET(getReq("need-1"), params("need-1"));
    expect(res.status).toBe(200);
  });

  it("allows admin to view any need without visibility check", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_ADMIN);
    const { GET } = await import("../route");
    const res = await GET(getReq("need-1"), params("need-1"));
    expect(res.status).toBe(200);
    expect(mockGetVisibleCommunityIds).not.toHaveBeenCalled();
  });
});

// =============================================================================
// PATCH /api/needs/[id]
// =============================================================================

describe("PATCH /api/needs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq("need-1", { title: "New" }),
      params("need-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for validation failure (title too long)", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq("need-1", { title: "x".repeat(121) }),
      params("need-1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when service throws ForbiddenError (non-owner)", async () => {
    mockUpdateNeed.mockRejectedValue(new ForbiddenError("Forbidden"));
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq("need-1", { title: "X" }),
      params("need-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when service throws ValidationError (need closed)", async () => {
    mockUpdateNeed.mockRejectedValue(
      new ValidationError("Cannot edit a closed Need."),
    );
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq("need-1", { title: "X" }),
      params("need-1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with updated need on success", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq("need-1", { title: "Updated" }),
      params("need-1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Updated");
    expect(mockUpdateNeed).toHaveBeenCalledWith(
      "need-1",
      expect.objectContaining({ title: "Updated" }),
      { userId: "user-1", isAdmin: false },
    );
  });

  it("allows admin to update any need", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_ADMIN);
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq("need-1", { title: "Admin edit" }),
      params("need-1"),
    );
    expect(res.status).toBe(200);
    expect(mockUpdateNeed).toHaveBeenCalledWith("need-1", expect.any(Object), {
      userId: "admin-1",
      isAdmin: true,
    });
  });
});

// =============================================================================
// DELETE /api/needs/[id]
// =============================================================================

describe("DELETE /api/needs/[id]", () => {
  it("returns 403 for non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      ),
    );
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteReq("need-1"), params("need-1"));
    expect(res.status).toBe(403);
    expect(mockDeleteNeed).not.toHaveBeenCalled();
  });

  it("returns 200 for admin soft-delete", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteReq("need-1"), params("need-1"));
    expect(res.status).toBe(200);
    expect(mockDeleteNeed).toHaveBeenCalledWith("need-1", { isAdmin: true });
  });

  it("returns 400 when need does not exist", async () => {
    mockDeleteNeed.mockRejectedValue(new ValidationError("Not found"));
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteReq("need-1"), params("need-1"));
    expect(res.status).toBe(400);
  });
});
