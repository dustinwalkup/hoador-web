import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPassword } from "../forgot-password";

// Mock Better Auth client
vi.mock("@/services/better-auth/client", () => ({
  authClient: {
    requestPasswordReset: vi.fn(),
  },
}));

import { authClient } from "@/services/better-auth/client";

describe("forgot-password.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  describe("forgotPassword", () => {
    it("should send password reset email successfully", async () => {
      // Arrange
      const email = "test@example.com";
      const mockData = { success: true };
      vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
        data: mockData,
        error: null,
      } as any);

      // Act
      const result = await forgotPassword(email);

      // Assert
      expect(result).toEqual(mockData);
      expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
        email,
        redirectTo: "http://localhost:3000/reset-password",
      });
    });

    it("should throw error when request fails", async () => {
      // Arrange
      const email = "test@example.com";
      const mockError = {
        message: "User not found",
      };
      vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
        data: null,
        error: mockError,
      } as any);

      // Act & Assert
      await expect(forgotPassword(email)).rejects.toThrow("User not found");
      expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
        email,
        redirectTo: "http://localhost:3000/reset-password",
      });
    });

    it("should throw generic error when error message is missing", async () => {
      // Arrange
      const email = "test@example.com";
      vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
        data: null,
        error: {},
      } as any);

      // Act & Assert
      await expect(forgotPassword(email)).rejects.toThrow(
        "Failed to send reset email",
      );
    });
  });
});
