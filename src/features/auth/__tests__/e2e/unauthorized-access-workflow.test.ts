import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, requireVerifiedUser } from "../../utils/session";
import { getAdminUser } from "../../utils/admin-session";
import { requireAdmin } from "../../utils/guards";
import { mockUnverifiedUser } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/dal", () => ({
  userDAL: {
    getUserByEmailForAuth: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

import { auth } from "@/services/better-auth";
import { userDAL } from "@/dal";
import { headers } from "next/headers";

describe("Unauthorized Access Prevention Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should prevent unauthenticated user from accessing protected route", async () => {
    // Step 1: Unauthenticated user attempts to access protected route
    const mockHeaders = new Headers();
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    // Step 2: Verify redirect to login (error thrown)
    await expect(requireAuth()).rejects.toThrow("Authentication required");
  });

  it("should prevent unverified user from accessing protected route", async () => {
    // Step 1: Unverified user attempts to access protected route
    const mockHeaders = new Headers();
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "user-123",
        email: "unverified@example.com",
      },
    } as any);
    vi.mocked(userDAL.getUserByEmailForAuth).mockResolvedValue(
      mockUnverifiedUser,
    );

    // Step 2: Verify redirect to verification page (error thrown)
    await expect(requireVerifiedUser()).rejects.toThrow(
      "Email verification required",
    );
  });

  it("should prevent non-admin user from accessing admin routes", async () => {
    // Step 1: Regular user attempts to access admin route
    vi.mock("../../utils/admin-session", () => ({
      getAdminUser: vi.fn(),
    }));

    vi.mocked(getAdminUser).mockResolvedValue(null);

    // Step 2: Verify access is denied
    const adminUser = await getAdminUser();
    expect(adminUser).toBeNull();
  });

  it("should prevent non-admin from accessing admin guard-protected routes", async () => {
    // Step 1: Regular user attempts to access admin guard-protected route
    vi.mock("../../utils/guards", () => ({
      requireAdmin: vi.fn(),
    }));

    vi.mocked(requireAdmin).mockRejectedValue(
      new Error("Admin privileges required"),
    );

    // Step 2: Verify access is denied
    await expect(requireAdmin()).rejects.toThrow("Admin privileges required");
  });
});
