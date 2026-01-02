import { describe, it, expect, vi, beforeEach } from "vitest";
import { resendVerificationEmailAction } from "../verify-email";

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

describe("resendVerificationEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send verification email successfully", async () => {
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
    expect(result).toEqual({
      success: true,
      message: "Verification email sent! Please check your inbox.",
    });
    expect(tryCatch).toHaveBeenCalled();
  });

  it("should return error when email is missing", async () => {
    // Arrange
    const formData = new FormData();

    // Act
    const result = await resendVerificationEmailAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Email address is required.",
    });
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when email is already verified", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "test@example.com");

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
    expect(result).toEqual({
      success: false,
      error: "This email address is already verified.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should return error when user not found", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "nonexistent@example.com");

    const mockError = {
      message: "User not found",
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
    expect(result).toEqual({
      success: false,
      error: "No account found with this email address.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should return error when rate limit exceeded", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "test@example.com");

    const mockError = {
      message: "Rate limit exceeded, please wait",
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
    expect(result).toEqual({
      success: false,
      error: "Please wait before requesting another verification email.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should return generic error when send fails", async () => {
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
    const result = await resendVerificationEmailAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to send verification email. Please try again.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
