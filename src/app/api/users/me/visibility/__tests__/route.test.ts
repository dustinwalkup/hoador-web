import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "@/dal/errors";

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
  getAuthenticatedUserResponse: (...a: any[]) =>
    mockGetAuthenticatedUserResponse(...a),
  parseFormData: (...a: any[]) => mockParseFormData(...a),
  handleApiError: (...a: any[]) => mockHandleApiError(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetVisibilityForUser = vi.fn();
const mockBulkSetVisibility = vi.fn();
vi.mock("@/dal", () => ({
  communityDAL: {
    getVisibilityForUser: (...a: any[]) => mockGetVisibilityForUser(...a),
    bulkSetVisibility: (...a: any[]) => mockBulkSetVisibility(...a),
  },
}));

function getReq() {
  return new NextRequest("http://localhost/api/users/me/visibility");
}
function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/users/me/visibility", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/users/me/visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "unauth" }, { status: 401 }),
    );
    const { GET } = await import("../route");
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("maps DAL rows to { community, isVisible, isPrimary }", async () => {
    mockGetVisibilityForUser.mockResolvedValue([
      {
        visibility: { id: "v1", isVisible: true },
        community: { id: "c1", name: "Foxcroft" },
        isPrimary: true,
      },
      {
        visibility: { id: "v2", isVisible: false },
        community: { id: "c2", name: "Verona" },
        isPrimary: false,
      },
    ]);
    const { GET } = await import("../route");
    const res = await GET(getReq());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual([
      {
        community: { id: "c1", name: "Foxcroft" },
        isVisible: true,
        isPrimary: true,
      },
      {
        community: { id: "c2", name: "Verona" },
        isVisible: false,
        isPrimary: false,
      },
    ]);
  });
});

describe("PATCH /api/users/me/visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "user-1" });
    mockBulkSetVisibility.mockResolvedValue([
      { id: "v1", communityId: "c1", isVisible: false },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "unauth" }, { status: 401 }),
    );
    const { PATCH } = await import("../route");
    const res = await PATCH(patchReq({ updates: [] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when updates is missing or empty", async () => {
    mockParseFormData.mockResolvedValue({ updates: [] });
    const { PATCH } = await import("../route");
    const res = await PATCH(patchReq({ updates: [] }));
    expect(res.status).toBe(400);
    expect(mockBulkSetVisibility).not.toHaveBeenCalled();
  });

  it("returns 400 when an update item has a wrong shape", async () => {
    mockParseFormData.mockResolvedValue({
      updates: [{ communityId: "c1" }],
    });
    const { PATCH } = await import("../route");
    const res = await PATCH(patchReq({ updates: [{ communityId: "c1" }] }));
    expect(res.status).toBe(400);
    expect(mockBulkSetVisibility).not.toHaveBeenCalled();
  });

  it("delegates to bulkSetVisibility and returns the updated rows", async () => {
    mockParseFormData.mockResolvedValue({
      updates: [{ communityId: "c1", isVisible: false }],
    });
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq({ updates: [{ communityId: "c1", isVisible: false }] }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({
      updated: [{ id: "v1", communityId: "c1", isVisible: false }],
    });
    expect(mockBulkSetVisibility).toHaveBeenCalledWith("user-1", [
      { communityId: "c1", isVisible: false },
    ]);
  });

  it("maps a ValidationError (hiding primary) to a 400", async () => {
    mockParseFormData.mockResolvedValue({
      updates: [{ communityId: "primary", isVisible: false }],
    });
    mockBulkSetVisibility.mockRejectedValue(
      new ValidationError("Cannot hide your home community"),
    );
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchReq({ updates: [{ communityId: "primary", isVisible: false }] }),
    );
    expect(res.status).toBe(400);
  });
});
