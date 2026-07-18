import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 2.5.1, 2.5.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.3
 *
 * The session module is mocked (per CLAUDE.md) but route-helpers — and so the
 * real `handleApiError` — is left intact, because the 409 blocked-deletion
 * mapping is the whole point of this endpoint and must be exercised, not stubbed.
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockDeleteOwnAccount = vi.fn();
vi.mock("@/features/users/services/account-deletion-service", () => ({
  deleteOwnAccount: (...a: unknown[]) => mockDeleteOwnAccount(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const REQ = new NextRequest("http://localhost/api/users/me", {
  method: "DELETE",
});

import { DELETE } from "../route";
import { AccountDeletionBlockedError } from "@/features/users/lib/account-deletion-errors";

describe("DELETE /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
      isAdmin: false,
    });
    mockDeleteOwnAccount.mockResolvedValue(undefined);
  });

  it("returns 200 on success and deletes the caller's own account", async () => {
    const res = await DELETE(REQ);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteOwnAccount).toHaveBeenCalledWith("user-1");
  });

  it("returns 401 when unauthenticated and does not delete anything", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await DELETE(REQ);

    expect(res.status).toBe(401);
    expect(mockDeleteOwnAccount).not.toHaveBeenCalled();
  });

  it("returns 409 with the blockers when deletion is blocked", async () => {
    const blockers = [
      { type: "open_disputes" as const, count: 1, message: "1 open dispute." },
    ];
    mockDeleteOwnAccount.mockRejectedValue(
      new AccountDeletionBlockedError({ blockers }),
    );

    const res = await DELETE(REQ);

    // Mapped by the real handleApiError, not a stub.
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "ACCOUNT_DELETION_BLOCKED",
      blockers,
    });
  });

  it("returns 500 on an unexpected failure", async () => {
    mockDeleteOwnAccount.mockRejectedValue(new Error("db exploded"));

    const res = await DELETE(REQ);

    expect(res.status).toBe(500);
  });
});
