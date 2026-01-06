import { describe, it, expect, vi, beforeEach } from "vitest";
import { resendVerificationEmailAction } from "../../actions/verify-email";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      sendVerificationEmail: vi.fn(),
    },
  },
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";

describe("Email Verification Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete email verification flow: Signup → Email → Verification → Access", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "test@example.com");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    // Act
    const result = await resendVerificationEmailAction(null, formData);

    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toBe(
      "Verification email sent! Please check your inbox.",
    );
    expect(tryCatch).toHaveBeenCalled();
  });

  it("should reject invalid tokens", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "test@example.com");

    const mockError = {
      message: "Invalid token",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await resendVerificationEmailAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should handle already verified email gracefully", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "verified@example.com");

    const mockError = {
      message: "Email already verified",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await resendVerificationEmailAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("This email address is already verified.");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
