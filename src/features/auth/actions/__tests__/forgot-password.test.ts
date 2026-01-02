import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPasswordAction } from "../forgot-password";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn(),
    },
  },
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { auth } from "@/services/better-auth";
import { tryCatch } from "@walkup/walkup-utils";

describe("forgotPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("should send password reset email successfully", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "test@example.com");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    // Act
    const result = await forgotPasswordAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: true,
      message:
        "If an account with that email exists, we've sent you a password reset link.",
    });
    expect(tryCatch).toHaveBeenCalled();
  });

  it("should return error when email format is invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "invalid-email");

    // Act
    const result = await forgotPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when email is empty", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "");

    // Act
    const result = await forgotPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when password reset request fails", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "test@example.com");

    const mockError = {
      message: "Service unavailable",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await forgotPasswordAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to send reset email. Please try again.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should return generic success message even when user does not exist (security)", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "nonexistent@example.com");

    // Even if user doesn't exist, Better Auth might return success for security
    // or might return an error - we handle both cases
    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    // Act
    const result = await forgotPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(true);
    // Message doesn't reveal whether user exists (security best practice)
    expect(result.message).toContain("If an account with that email exists");
  });
});
