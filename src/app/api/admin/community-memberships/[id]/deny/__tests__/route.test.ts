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

const mockDenyMembership = vi.fn();
vi.mock("@/dal", () => ({
  communityDAL: {
    denyMembership: (...a: any[]) => mockDenyMembership(...a),
  },
}));

function req(body: unknown) {
  return new NextRequest(
    "http://localhost/api/admin/community-memberships/m-1/deny",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
const ctx = { params: Promise.resolve({ id: "m-1" }) };

describe("POST /api/admin/community-memberships/[id]/deny", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "admin-1" });
    mockParseFormData.mockResolvedValue({ adminNotes: "address not in zone" });
    mockDenyMembership.mockResolvedValue({
      id: "m-1",
      verificationStatus: "denied",
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
    const res = await POST(req({ adminNotes: "x" }), ctx);
    expect(res.status).toBe(403);
    expect(mockDenyMembership).not.toHaveBeenCalled();
  });

  it("returns 400 when adminNotes is missing/empty (no DB hit)", async () => {
    mockParseFormData.mockResolvedValue({ adminNotes: "  " });
    const { POST } = await import("../route");
    const res = await POST(req({ adminNotes: "  " }), ctx);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/adminNotes is required/i);
    expect(mockDenyMembership).not.toHaveBeenCalled();
  });

  it("denies the membership and returns the updated row", async () => {
    const { POST } = await import("../route");
    const res = await POST(req({ adminNotes: "address not in zone" }), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.verificationStatus).toBe("denied");
    expect(mockDenyMembership).toHaveBeenCalledWith(
      "m-1",
      "admin-1",
      "address not in zone",
    );
  });

  it("maps NotFoundError to a 404", async () => {
    mockDenyMembership.mockRejectedValue(
      new NotFoundError("Membership", "m-1"),
    );
    const { POST } = await import("../route");
    const res = await POST(req({ adminNotes: "x" }), ctx);
    expect(res.status).toBe(404);
  });
});
