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

const mockVerifyMembership = vi.fn();
vi.mock("@/dal", () => ({
  communityDAL: {
    verifyMembership: (...a: any[]) => mockVerifyMembership(...a),
  },
}));

function req(body?: unknown) {
  return new NextRequest(
    "http://localhost/api/admin/community-memberships/m-1/verify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}
const ctx = { params: Promise.resolve({ id: "m-1" }) };

describe("POST /api/admin/community-memberships/[id]/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "admin-1" });
    mockParseFormData.mockResolvedValue({});
    mockVerifyMembership.mockResolvedValue({
      id: "m-1",
      verificationStatus: "verified",
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
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(403);
    expect(mockVerifyMembership).not.toHaveBeenCalled();
  });

  it("verifies the membership and returns the updated row", async () => {
    const { POST } = await import("../route");
    const res = await POST(req({}), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.verificationStatus).toBe("verified");
    expect(mockVerifyMembership).toHaveBeenCalledWith(
      "m-1",
      "admin-1",
      undefined,
    );
  });

  it("passes adminNotes through when provided", async () => {
    mockParseFormData.mockResolvedValue({ adminNotes: "looks good" });
    const { POST } = await import("../route");
    await POST(req({ adminNotes: "looks good" }), ctx);
    expect(mockVerifyMembership).toHaveBeenCalledWith(
      "m-1",
      "admin-1",
      "looks good",
    );
  });

  it("maps NotFoundError to a 404", async () => {
    mockVerifyMembership.mockRejectedValue(
      new NotFoundError("Membership", "m-1"),
    );
    const { POST } = await import("../route");
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(404);
  });
});
