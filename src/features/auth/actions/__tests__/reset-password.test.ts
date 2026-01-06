import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetPasswordAction } from "../reset-password";
import { mockResetToken } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
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

import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";

describe("resetPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reset password successfully", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", mockResetToken);
    formData.append("password", "NewSecurePass123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    // Act
    try {
      await resetPasswordAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert
    expect(tryCatch).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      "/login?message=password-reset-success",
    );
  });

  it("should return error when token is missing", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("password", "NewSecurePass123");

    // Act
    const result = await resetPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when password is missing", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", mockResetToken);

    // Act
    const result = await resetPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when password is weak", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", mockResetToken);
    formData.append("password", "weak");

    // Act
    const result = await resetPasswordAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when token is invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", "invalid-token");
    formData.append("password", "NewSecurePass123");

    const mockError = {
      message: "invalid token",
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
    expect(result).toEqual({
      success: false,
      error:
        "This reset link has expired or is invalid. Please request a new one.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should return error when token is expired", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", mockResetToken);
    formData.append("password", "NewSecurePass123");

    const mockError = {
      message: "token expired",
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
    expect(result).toEqual({
      success: false,
      error:
        "This reset link has expired or is invalid. Please request a new one.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should return generic error when reset fails for other reasons", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("token", mockResetToken);
    formData.append("password", "NewSecurePass123");

    const mockError = {
      message: "Database error",
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
    expect(result).toEqual({
      success: false,
      error: "Failed to reset password. Please try again.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
