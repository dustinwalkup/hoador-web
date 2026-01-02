import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminLoginAction } from "../../actions/admin-login";
import { getAdminUser } from "../../utils/admin-session";
import { mockAdminUser } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
    },
  },
}));

vi.mock("../../utils/admin-session", () => ({
  getAdminUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";
import { headers } from "next/headers";

describe("Admin Login Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockHeaders = new Headers();
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
  });

  it("should complete admin login workflow", async () => {
    // Step 1: Admin navigates to admin login page
    // (Simulated by calling adminLoginAction)

    // Step 2: Admin enters admin credentials
    const formData = new FormData();
    formData.append("email", "admin@example.com");
    formData.append("password", "adminpassword123");

    // Step 3: Admin submits form
    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);
    vi.mocked(getAdminUser).mockResolvedValue(mockAdminUser);

    const result = await adminLoginAction(null, formData);

    // Step 4: Verify admin dashboard access is granted
    expect(result.success).toBe(true);
    expect(getAdminUser).toHaveBeenCalled();
  });

  it("should prevent non-admin users from accessing admin routes", async () => {
    // Step 1: Regular user attempts to access admin login
    const formData = new FormData();
    formData.append("email", "user@example.com");
    formData.append("password", "userpassword123");

    // Step 2: User submits form
    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);
    vi.mocked(getAdminUser).mockResolvedValue(null); // Not an admin

    // Step 3: Verify access is denied
    const result = await adminLoginAction(null, formData);

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Access denied. Admin privileges required.");
  });
});
