import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminUser, getSuperAdminUser } from "../admin-session";
import {
  mockVerifiedUser,
  mockAdminUser,
  mockSuperAdminUser,
} from "@/test/fixtures/auth";

// Mock session utilities
vi.mock("../session", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "../session";

describe("admin-session.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAdminUser", () => {
    it("should return admin user when user is admin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser);

      // Act
      const result = await getAdminUser();

      // Assert
      expect(result).toEqual(mockAdminUser);
      expect(getCurrentUser).toHaveBeenCalled();
    });

    it("should return admin user when user is superadmin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdminUser);

      // Act
      const result = await getAdminUser();

      // Assert
      expect(result).toEqual(mockSuperAdminUser);
    });

    it("should return null when user is not admin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockVerifiedUser);

      // Act
      const result = await getAdminUser();

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when user is not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      // Act
      const result = await getAdminUser();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getSuperAdminUser", () => {
    it("should return superadmin user when user is superadmin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdminUser);

      // Act
      const result = await getSuperAdminUser();

      // Assert
      expect(result).toEqual(mockSuperAdminUser);
      expect(getCurrentUser).toHaveBeenCalled();
    });

    it("should return null when user is admin but not superadmin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser);

      // Act
      const result = await getSuperAdminUser();

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when user is not admin", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(mockVerifiedUser);

      // Act
      const result = await getSuperAdminUser();

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when user is not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      // Act
      const result = await getSuperAdminUser();

      // Assert
      expect(result).toBeNull();
    });
  });
});
