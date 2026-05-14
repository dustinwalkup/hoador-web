import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { NotFoundError } from "@/dal/errors";

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

const mockUpdateCommunity = vi.fn();
vi.mock("@/dal", () => ({
  communityDAL: {
    updateCommunity: (...a: any[]) => mockUpdateCommunity(...a),
  },
}));

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/communities/c-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "c-1" }) };

describe("PATCH /api/admin/communities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "admin-1" });
    mockParseFormData.mockResolvedValue({ name: "Renamed" });
    mockUpdateCommunity.mockResolvedValue({ id: "c-1", name: "Renamed" });
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      ),
    );
    const { PATCH } = await import("../route");
    const res = await PATCH(req({ name: "x" }), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateCommunity).not.toHaveBeenCalled();
  });

  it("returns 400 when no updatable fields are provided", async () => {
    mockParseFormData.mockResolvedValue({ bogus: 1 });
    const { PATCH } = await import("../route");
    const res = await PATCH(req({ bogus: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdateCommunity).not.toHaveBeenCalled();
  });

  it("whitelists fields and forwards them to updateCommunity", async () => {
    mockParseFormData.mockResolvedValue({
      name: "Renamed",
      isActive: false,
      networkId: "net-2",
      latitude: "39.10000000",
      bogus: "ignored",
    });
    const { PATCH } = await import("../route");
    const res = await PATCH(
      req({
        name: "Renamed",
        isActive: false,
        networkId: "net-2",
        latitude: "39.10000000",
        bogus: "ignored",
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(mockUpdateCommunity).toHaveBeenCalledWith("c-1", {
      name: "Renamed",
      isActive: false,
      networkId: "net-2",
      latitude: "39.10000000",
    });
  });

  it("accepts null to clear nullable fields", async () => {
    mockParseFormData.mockResolvedValue({ networkId: null });
    const { PATCH } = await import("../route");
    await PATCH(req({ networkId: null }), ctx);
    expect(mockUpdateCommunity).toHaveBeenCalledWith("c-1", {
      networkId: null,
    });
  });

  it("maps NotFoundError to a 404", async () => {
    mockUpdateCommunity.mockRejectedValue(new NotFoundError("Community"));
    const { PATCH } = await import("../route");
    const res = await PATCH(req({ name: "x" }), ctx);
    expect(res.status).toBe(404);
  });
});
