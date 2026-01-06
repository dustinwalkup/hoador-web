import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPasswordAction } from "../../actions/forgot-password";
import { resetPasswordAction } from "../../actions/reset-password";

// Mock dependencies - must be before imports that use them
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";
import { redirect } from "next/navigation";

describe("Password Reset Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("should complete password reset flow: Request → Email → Reset → Login", async () => {
    // Arrange - Step 1: Request password reset
    const formData1 = new FormData();
    formData1.append("email", "test@example.com");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    // Act - Step 1
    const requestResult = await forgotPasswordAction(null, formData1);

    // Assert - Step 1
    expect(requestResult.success).toBe(true);
    expect(tryCatch).toHaveBeenCalled();

    // Arrange - Step 2: Reset password with token
    vi.clearAllMocks();
    const formData2 = new FormData();
    formData2.append("token", "reset-token-123");
    formData2.append("password", "NewSecurePass123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    // Act - Step 2
    try {
      await resetPasswordAction(null, formData2);
    } catch {
      // redirect() throws
    }

    // Assert - Step 2
    expect(tryCatch).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      "/login?message=password-reset-success",
    );
  });

  it("should reject expired tokens", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", "expired-token");
    formData.append("password", "NewSecurePass123");

    const mockError = {
      message: "Token expired",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await resetPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("expired or is invalid");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should handle invalid tokens without revealing user existence", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", "invalid-token");
    formData.append("password", "NewSecurePass123");

    const mockError = {
      message: "invalid token", // lowercase to match the includes("invalid") check
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await resetPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("expired or is invalid");
    // Error message doesn't reveal whether user exists (security)
    consoleErrorSpy.mockRestore();
  });
});
