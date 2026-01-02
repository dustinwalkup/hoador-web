import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requireActiveUser,
  isAdmin,
  isSuperAdmin,
  requireAdmin,
  requireSuperAdmin,
} from "../guards";
import {
  mockVerifiedUser,
  mockAdminUser,
  mockSuperAdminUser,
  mockUnverifiedUser,
} from "@/test/fixtures/auth";

// Mock session utilities
vi.mock("../session", () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { requireAuth, getCurrentUser } from "../session";

describe("guards.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireActiveUser", () => {
    it("should return user when status is active", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockVerifiedUser);

      // Act
      const result = await requireActiveUser();

      // Assert
      expect(result).toEqual(mockVerifiedUser);
      expect(requireAuth).toHaveBeenCalled();
    });

    it("should throw error when user status is not active", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockUnverifiedUser);

      // Act & Assert
      await expect(requireActiveUser()).rejects.toThrow(
        "User status is pending_verification, active status required",
      );
    });

    it("should throw error when not authenticated", async () => {
      // Arrange
      vi.mocked(requireAuth).mockRejectedValue(
        new Error("Authentication required"),
      );

      // Act & Assert
      await expect(requireActiveUser()).rejects.toThrow(
        "Authentication required",
      );
    });
  });

  describe("isAdmin", () => {
    it("should return true when user is admin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser);

      // Act
      const result = await isAdmin();

      // Assert
      expect(result).toBe(true);
      expect(getCurrentUser).toHaveBeenCalled();
    });

    it("should return true when user is superadmin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdminUser);

      // Act
      const result = await isAdmin();

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when user is not admin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockVerifiedUser);

      // Act
      const result = await isAdmin();

      // Assert
      expect(result).toBe(false);
    });

    it("should return false when user is not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      // Act
      const result = await isAdmin();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("isSuperAdmin", () => {
    it("should return true when user is superadmin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdminUser);

      // Act
      const result = await isSuperAdmin();

      // Assert
      expect(result).toBe(true);
      expect(getCurrentUser).toHaveBeenCalled();
    });

    it("should return false when user is admin but not superadmin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser);

      // Act
      const result = await isSuperAdmin();

      // Assert
      expect(result).toBe(false);
    });

    it("should return false when user is not admin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockVerifiedUser);

      // Act
      const result = await isSuperAdmin();

      // Assert
      expect(result).toBe(false);
    });

    it("should return false when user is not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      // Act
      const result = await isSuperAdmin();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("requireAdmin", () => {
    it("should return user when user is admin", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockAdminUser);

      // Act
      const result = await requireAdmin();

      // Assert
      expect(result).toEqual(mockAdminUser);
      expect(requireAuth).toHaveBeenCalled();
    });

    it("should return user when user is superadmin", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockSuperAdminUser);

      // Act
      const result = await requireAdmin();

      // Assert
      expect(result).toEqual(mockSuperAdminUser);
    });

    it("should throw error when user is not admin", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockVerifiedUser);

      // Act & Assert
      await expect(requireAdmin()).rejects.toThrow("Admin privileges required");
    });

    it("should throw error when not authenticated", async () => {
      // Arrange
      vi.mocked(requireAuth).mockRejectedValue(
        new Error("Authentication required"),
      );

      // Act & Assert
      await expect(requireAdmin()).rejects.toThrow("Authentication required");
    });
  });

  describe("requireSuperAdmin", () => {
    it("should return user when user is superadmin", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockSuperAdminUser);

      // Act
      const result = await requireSuperAdmin();

      // Assert
      expect(result).toEqual(mockSuperAdminUser);
      expect(requireAuth).toHaveBeenCalled();
    });

    it("should throw error when user is admin but not superadmin", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockAdminUser);

      // Act & Assert
      await expect(requireSuperAdmin()).rejects.toThrow(
        "Superadmin privileges required",
      );
    });

    it("should throw error when user is not admin", async () => {
      // Arrange
      vi.mocked(requireAuth).mockResolvedValue(mockVerifiedUser);

      // Act & Assert
      await expect(requireSuperAdmin()).rejects.toThrow(
        "Superadmin privileges required",
      );
    });

    it("should throw error when not authenticated", async () => {
      // Arrange
      vi.mocked(requireAuth).mockRejectedValue(
        new Error("Authentication required"),
      );

      // Act & Assert
      await expect(requireSuperAdmin()).rejects.toThrow(
        "Authentication required",
      );
    });
  });
});
