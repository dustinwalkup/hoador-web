import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEC-06: bulk `update_status` had the same hole as the single-user PATCH, so
 * an admin could suspend every superadmin in one request.
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
}));

const mockIsSuperAdmin = vi.fn();
vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn().mockResolvedValue(undefined),
  isSuperAdmin: (...a: unknown[]) => mockIsSuperAdmin(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
}));

const USERS: Record<string, { id: string; userType: string; status: string }> =
  {
    "std-1": { id: "std-1", userType: "standard", status: "active" },
    "super-1": { id: "super-1", userType: "superadmin", status: "active" },
    "admin-2": { id: "admin-2", userType: "admin", status: "active" },
  };

const mockGetUserById = vi.fn();
const mockAdminUpdateUser = vi.fn();
const mockAuditLogCreate = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: {
    getUserById: (...a: unknown[]) => mockGetUserById(...a),
    adminUpdateUser: (...a: unknown[]) => mockAdminUpdateUser(...a),
  },
  auditLogDAL: { create: (...a: unknown[]) => mockAuditLogCreate(...a) },
}));

import { POST } from "../route";

const bulk = (body: unknown) =>
  POST(
    new NextRequest("http://localhost:3000/api/admin/users/bulk-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/admin/users/bulk-actions — update_status (SEC-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "admin-1", status: "active" },
      userId: "admin-1",
      isAdmin: true,
    });
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetUserById.mockImplementation(async (id: string) => {
      const u = USERS[id];
      if (!u) throw new Error("not found");
      return u;
    });
    mockAdminUpdateUser.mockResolvedValue({});
    mockAuditLogCreate.mockResolvedValue(undefined);
  });

  it("skips admin and superadmin targets for an admin caller", async () => {
    const res = await bulk({
      action: "update_status",
      userIds: ["std-1", "super-1", "admin-2"],
      payload: { status: "suspended" },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ succeeded: 1, failed: 2 });
    expect(body.results).toEqual([
      { userId: "std-1", success: true },
      expect.objectContaining({ userId: "super-1", success: false }),
      expect.objectContaining({ userId: "admin-2", success: false }),
    ]);
    expect(mockAdminUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockAdminUpdateUser).toHaveBeenCalledWith("std-1", {
      status: "suspended",
    });
  });

  it("lets a superadmin caller update privileged accounts", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);

    const res = await bulk({
      action: "update_status",
      userIds: ["std-1", "super-1"],
      payload: { status: "suspended" },
    });

    expect((await res.json()).succeeded).toBe(2);
    expect(mockAdminUpdateUser).toHaveBeenCalledTimes(2);
  });

  it("fails closed on a target it can't look up", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);

    const res = await bulk({
      action: "update_status",
      userIds: ["missing"],
      payload: { status: "suspended" },
    });

    expect((await res.json()).results[0]).toMatchObject({ success: false });
    expect(mockAdminUpdateUser).not.toHaveBeenCalled();
  });

  it("400s an unknown status before touching anyone", async () => {
    const res = await bulk({
      action: "update_status",
      userIds: ["std-1"],
      payload: { status: "god_mode" },
    });

    expect(res.status).toBe(400);
    expect(mockGetUserById).not.toHaveBeenCalled();
  });
});
