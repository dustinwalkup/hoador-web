import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCurrentUser,
  requireAuth,
  getCurrentUserId,
  requireVerifiedUser,
  getSession,
} from "../session";
import { mockVerifiedUser, mockUnverifiedUser } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/dal", () => ({
  userDAL: {
    getUserByEmailForAuth: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

import { auth } from "@/services/better-auth";
import { userDAL } from "@/dal";
import { headers } from "next/headers";

describe("session.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentUser", () => {
    it("should return user profile when session exists", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      } as any);
      vi.mocked(userDAL.getUserByEmailForAuth).mockResolvedValue(
        mockVerifiedUser,
      );

      // Act
      const result = await getCurrentUser();

      // Assert
      expect(result).toEqual(mockVerifiedUser);
      expect(auth.api.getSession).toHaveBeenCalledWith({
        headers: mockHeaders,
      });
      expect(userDAL.getUserByEmailForAuth).toHaveBeenCalledWith(
        "test@example.com",
      );
    });

    it("should return null when session does not exist", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      // Act
      const result = await getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(userDAL.getUserByEmailForAuth).not.toHaveBeenCalled();
    });

    it("should return null when session.user does not exist", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: null,
      } as any);

      // Act
      const result = await getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(userDAL.getUserByEmailForAuth).not.toHaveBeenCalled();
    });

    it("should return null when error occurs", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockRejectedValue(
        new Error("Session error"),
      );
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Act
      const result = await getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("requireAuth", () => {
    it("should return user when authenticated", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      } as any);
      vi.mocked(userDAL.getUserByEmailForAuth).mockResolvedValue(
        mockVerifiedUser,
      );

      // Act
      const result = await requireAuth();

      // Assert
      expect(result).toEqual(mockVerifiedUser);
    });

    it("should throw error when not authenticated", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      // Act & Assert
      await expect(requireAuth()).rejects.toThrow("Authentication required");
    });
  });

  describe("getCurrentUserId", () => {
    it("should return user ID when user exists", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      } as any);
      vi.mocked(userDAL.getUserByEmailForAuth).mockResolvedValue(
        mockVerifiedUser,
      );

      // Act
      const result = await getCurrentUserId();

      // Assert
      expect(result).toBe("verified-user-123");
    });

    it("should return null when user does not exist", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      // Act
      const result = await getCurrentUserId();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("requireVerifiedUser", () => {
    it("should return user when email is verified", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      } as any);
      vi.mocked(userDAL.getUserByEmailForAuth).mockResolvedValue(
        mockVerifiedUser,
      );

      // Act
      const result = await requireVerifiedUser();

      // Assert
      expect(result).toEqual(mockVerifiedUser);
    });

    it("should throw error when email is not verified", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: {
          id: "user-123",
          email: "unverified@example.com",
        },
      } as any);
      vi.mocked(userDAL.getUserByEmailForAuth).mockResolvedValue(
        mockUnverifiedUser,
      );

      // Act & Assert
      await expect(requireVerifiedUser()).rejects.toThrow(
        "Email verification required",
      );
    });

    it("should throw error when not authenticated", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      // Act & Assert
      await expect(requireVerifiedUser()).rejects.toThrow(
        "Authentication required",
      );
    });
  });

  describe("getSession", () => {
    it("should return session when provided headers", async () => {
      // Arrange
      const mockHeaders = new Headers();
      const mockSession = {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      };
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);

      // Act
      const result = await getSession(mockHeaders);

      // Assert
      expect(result).toEqual(mockSession);
      expect(auth.api.getSession).toHaveBeenCalledWith({
        headers: mockHeaders,
      });
    });

    it("should use headers() when no headers provided", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(headers).mockResolvedValue(mockHeaders);
      const mockSession = {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      };
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);

      // Act
      const result = await getSession();

      // Assert
      expect(result).toEqual(mockSession);
      expect(headers).toHaveBeenCalled();
      expect(auth.api.getSession).toHaveBeenCalledWith({
        headers: mockHeaders,
      });
    });

    it("should return null when error occurs", async () => {
      // Arrange
      const mockHeaders = new Headers();
      vi.mocked(auth.api.getSession).mockRejectedValue(
        new Error("Session error"),
      );
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Act
      const result = await getSession(mockHeaders);

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
