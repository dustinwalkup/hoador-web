import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminLoginAction } from "../admin-login";
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

import { auth } from "@/services/better-auth";
import { getAdminUser } from "../../utils/admin-session";
import { headers } from "next/headers";
import { tryCatch } from "@walkup/walkup-utils";

describe("adminLoginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockHeaders = new Headers();
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
  });

  it("should authenticate admin user successfully", async () => {
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
    expect(result).toEqual({ success: true });
    expect(tryCatch).toHaveBeenCalled();
    expect(getAdminUser).toHaveBeenCalled();
  });

  it("should return error when email is missing", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("password", "password123");

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result).toEqual({
      error: "Email and password are required",
    });
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when password is missing", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "admin@example.com");

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result).toEqual({
      error: "Email and password are required",
    });
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when credentials are invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "admin@example.com");
    formData.append("password", "wrongpassword");

    const mockError = {
      message: "Invalid credentials",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result).toEqual({
      error: "Invalid credentials",
    });
    expect(getAdminUser).not.toHaveBeenCalled();
  });

  it("should return error when user is not admin", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "user@example.com");
    formData.append("password", "password123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);
    vi.mocked(getAdminUser).mockResolvedValue(null);

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result).toEqual({
      error: "Access denied. Admin privileges required.",
    });
  });

  it("should return generic error when error message is missing", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "admin@example.com");
    formData.append("password", "password123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: {},
    } as any);

    // Act
    const result = await adminLoginAction(null, formData);

    // Assert
    expect(result).toEqual({
      error: "Invalid email or password",
    });
  });
});
