import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * DELETE /api/admin/users/[userId]: a superadmin hard delete cascades into
 * payment, payout and agreement records, so users with payment or rental
 * history are refused (DB-01), and so is the `system` user that owns every
 * chargeback auto-dispute (BIZ-06).
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

const mockHasFinancialHistory = vi.fn();
const mockGetUserById = vi.fn();
const mockDeleteUser = vi.fn();
const mockAuditLogCreate = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: {
    hasFinancialHistory: (...a: unknown[]) => mockHasFinancialHistory(...a),
    getUserById: (...a: unknown[]) => mockGetUserById(...a),
    deleteUser: (...a: unknown[]) => mockDeleteUser(...a),
  },
  auditLogDAL: { create: (...a: unknown[]) => mockAuditLogCreate(...a) },
  disputeDAL: {},
  communityDAL: {},
}));

import { DELETE } from "../route";

const callDelete = (userId: string) =>
  DELETE(
    new NextRequest(`http://localhost:3000/api/admin/users/${userId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ userId }) },
  );

describe("DELETE /api/admin/users/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "superadmin-1", status: "active" },
      userId: "superadmin-1",
      isAdmin: true,
    });
    mockIsSuperAdmin.mockResolvedValue(true);
    mockHasFinancialHistory.mockResolvedValue(false);
    mockGetUserById.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User One",
    });
    mockDeleteUser.mockResolvedValue(undefined);
    mockAuditLogCreate.mockResolvedValue(undefined);
  });

  it("refuses a user with payment or rental history, and deletes nothing", async () => {
    mockHasFinancialHistory.mockResolvedValue(true);

    const res = await callDelete("user-1");

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("payment or rental history"),
    });
    expect(mockHasFinancialHistory).toHaveBeenCalledWith("user-1");
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("refuses the system user", async () => {
    const res = await callDelete("system");

    expect(res.status).toBe(409);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes a user with no history, and audits it", async () => {
    const res = await callDelete("user-1");

    expect(res.status).toBe(200);
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.user_deleted" }),
    );
  });

  it("still refuses a plain admin before looking at history", async () => {
    mockIsSuperAdmin.mockResolvedValue(false);

    const res = await callDelete("user-1");

    expect(res.status).toBe(403);
    expect(mockHasFinancialHistory).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
