import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for GET /api/disputes/[id]/audit (admin only).
 *
 * The route uses `requireAdminResponse()`, which goes through the real
 * `requireAdmin` guard → the session module's `requireAuth`. Mocking
 * `requireAuth` drives both the 401 (it throws) and the 403 (non-admin user)
 * through the real helpers.
 */

const mockRequireAuth = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  getAuthenticatedUser: vi.fn(),
  getCurrentUser: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

const mockDisputeGetById = vi.fn();
const mockGetAuditLogs = vi.fn();
vi.mock("@/dal", () => ({
  disputeDAL: {
    getById: (...a: unknown[]) => mockDisputeGetById(...a),
    getAuditLogsByDisputeId: (...a: unknown[]) => mockGetAuditLogs(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const req = () =>
  new NextRequest("http://localhost/api/disputes/dispute-1/audit");
const ctx = { params: Promise.resolve({ id: "dispute-1" }) };

const logs = [
  {
    id: "log-1",
    disputeId: "dispute-1",
    actionType: "state_change",
    newState: "under_review",
  },
];

describe("GET /api/disputes/[id]/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-admin", userType: "admin" });
    mockDisputeGetById.mockResolvedValue({ id: "dispute-1" });
    mockGetAuditLogs.mockResolvedValue(logs);
  });

  it("returns 401 when unauthenticated, without touching the DAL", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Authentication required"));

    const { GET } = await import("../route");
    const res = await GET(req(), ctx);

    expect(res.status).toBe(401);
    expect(mockDisputeGetById).not.toHaveBeenCalled();
    expect(mockGetAuditLogs).not.toHaveBeenCalled();
  });

  it("returns 403 to a signed-in non-admin, without touching the DAL", async () => {
    mockRequireAuth.mockResolvedValue({ id: "user-renter", userType: "user" });

    const { GET } = await import("../route");
    const res = await GET(req(), ctx);

    expect(res.status).toBe(403);
    expect(mockDisputeGetById).not.toHaveBeenCalled();
    expect(mockGetAuditLogs).not.toHaveBeenCalled();
  });

  it("returns 404 to an admin when the dispute does not exist", async () => {
    mockDisputeGetById.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(req(), ctx);

    expect(res.status).toBe(404);
    expect(mockGetAuditLogs).not.toHaveBeenCalled();
  });

  it("returns the audit logs to an admin", async () => {
    const { GET } = await import("../route");
    const res = await GET(req(), ctx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(logs);
    expect(mockGetAuditLogs).toHaveBeenCalledWith("dispute-1");
  });

  it("also admits a superadmin", async () => {
    mockRequireAuth.mockResolvedValue({
      id: "user-super",
      userType: "superadmin",
    });

    const { GET } = await import("../route");
    expect((await GET(req(), ctx)).status).toBe(200);
  });
});
