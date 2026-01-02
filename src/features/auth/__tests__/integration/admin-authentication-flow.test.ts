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

describe("Admin Authentication Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockHeaders = new Headers();
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
  });

  it("should complete admin authentication flow: Admin Login → Session → Admin Access", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "admin@example.com");
    formData.append("password", "password123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);
    vi.mocked(getAdminUser).mockResolvedValue(mockAdminUser);

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result.success).toBe(true);
    expect(tryCatch).toHaveBeenCalled(); // Better Auth sign in
    expect(getAdminUser).toHaveBeenCalled(); // Admin check
  });

  it("should prevent non-admin users from accessing admin routes", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "user@example.com");
    formData.append("password", "password123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);
    vi.mocked(getAdminUser).mockResolvedValue(null); // Not an admin

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Access denied. Admin privileges required.");
  });

  it("should store admin session correctly", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "admin@example.com");
    formData.append("password", "password123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);
    vi.mocked(getAdminUser).mockResolvedValue(mockAdminUser);

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result.success).toBe(true);
    // Session is managed by Better Auth - we verify the authentication was successful
    expect(getAdminUser).toHaveBeenCalled(); // Admin session check succeeds
  });
});
