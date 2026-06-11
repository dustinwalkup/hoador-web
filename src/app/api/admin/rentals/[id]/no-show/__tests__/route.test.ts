import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, ValidationError } from "@/dal/errors";

/**
 * Admin no-show route. Pattern: mock the SESSION layer and run the REAL
 * `@/lib/api/route-helpers` (and the real `requireAdmin`/`handleApiError`), so
 * the 401/403 responses are produced by the actual guard logic — removing the
 * `requireAdminResponse()` call from the route, or breaking the guard, fails
 * here. `requireAdmin()` calls the session `requireAuth()`, so mocking that is
 * enough to drive both the unauthenticated (401) and non-admin (403) paths.
 */

const mockApplyNoShow = vi.fn();
const mockRequireAuth = vi.fn();
const mockGetCurrentUserId = vi.fn();

vi.mock("@/features/auth/utils/session", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
  getCurrentUser: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/features/rentals/services/cancellation-service", () => ({
  applyNoShow: (...args: unknown[]) => mockApplyNoShow(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (req: NextRequest) => Promise<Response>) =>
    handler,
}));

describe("POST /api/admin/rentals/[id]/no-show", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated admin.
    mockRequireAuth.mockResolvedValue({ id: "admin-1", userType: "admin" });
    mockGetCurrentUserId.mockResolvedValue("admin-1");
  });

  async function postNoShow(
    id: string,
    body: { type: "renter_no_show" | "owner_no_show" },
  ) {
    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/admin/rentals/${id}/no-show`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
    );
    return POST(request, { params: Promise.resolve({ id }) });
  }

  it("returns 401 (via the real guard) when unauthenticated", async () => {
    // requireAuth throws when no session — requireAdmin propagates it, and
    // requireAdminResponse maps a non-"Admin" auth error to 401.
    mockRequireAuth.mockRejectedValue(new Error("Authentication required"));

    const response = await postNoShow("req-1", { type: "renter_no_show" });

    expect(response.status).toBe(401);
    expect(mockApplyNoShow).not.toHaveBeenCalled();
  });

  it("returns 403 (via the real guard) for an authenticated non-admin", async () => {
    mockRequireAuth.mockResolvedValue({ id: "u1", userType: "member" });

    const response = await postNoShow("req-1", { type: "renter_no_show" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Admin privileges required",
    });
    expect(mockApplyNoShow).not.toHaveBeenCalled();
  });

  it("returns 200 with refundAmount and ownerTransferAmount for renter_no_show", async () => {
    mockApplyNoShow.mockResolvedValue({
      success: true,
      refundAmount: 50,
      ownerTransferAmount: 30,
    });

    const response = await postNoShow("req-1", { type: "renter_no_show" });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.refundAmount).toBe(50);
    expect(data.ownerTransferAmount).toBe(30);
    expect(mockApplyNoShow).toHaveBeenCalledWith(
      "req-1",
      "renter_no_show",
      "admin-1",
    );
  });

  it("returns 200 with full refund for owner_no_show", async () => {
    mockApplyNoShow.mockResolvedValue({
      success: true,
      refundAmount: 112,
    });

    const response = await postNoShow("req-2", { type: "owner_no_show" });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.refundAmount).toBe(112);
    expect(data.ownerTransferAmount).toBeUndefined();
    expect(mockApplyNoShow).toHaveBeenCalledWith(
      "req-2",
      "owner_no_show",
      "admin-1",
    );
  });

  it("returns 400 for invalid type", async () => {
    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/admin/rentals/req-1/no-show",
      {
        method: "POST",
        body: JSON.stringify({ type: "foo" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid data");
    expect(data.details?.type).toBeDefined();
    expect(mockApplyNoShow).not.toHaveBeenCalled();
  });

  it("returns 400 for missing body", async () => {
    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/admin/rentals/req-1/no-show",
      { method: "POST" },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 for already cancelled rental (real ValidationError mapping)", async () => {
    mockApplyNoShow.mockRejectedValue(
      new ValidationError("Rental is already cancelled", "status"),
    );

    const response = await postNoShow("req-cancelled", {
      type: "renter_no_show",
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent rental (real NotFoundError mapping)", async () => {
    mockApplyNoShow.mockRejectedValue(
      new NotFoundError("Rental", "req-missing"),
    );

    const response = await postNoShow("req-missing", {
      type: "owner_no_show",
    });

    expect(response.status).toBe(404);
  });
});
