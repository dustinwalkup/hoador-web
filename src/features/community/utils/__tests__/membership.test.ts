import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCurrentUserCommunity,
  requireCommunityMembership,
  getCurrentUserCommunityId,
  getCurrentUserVisibleCommunityIds,
} from "../membership";
import { mockUserCommunityInfo } from "@/test/fixtures/community";

// Mock dependencies
vi.mock("@/dal", () => ({
  communityDAL: {
    getMembershipForUser: vi.fn(),
    requireUserCommunityMembership: vi.fn(),
    getUserCommunityId: vi.fn(),
    getVisibleCommunityIds: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

import { communityDAL } from "@/dal";
import { getCurrentUserId } from "@/features/auth/utils/session";

describe("membership.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentUserCommunity", () => {
    it("should return community info when user has membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getMembershipForUser).mockResolvedValue(
        mockUserCommunityInfo,
      );

      // Act
      const result = await getCurrentUserCommunity();

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getMembershipForUser).toHaveBeenCalledWith(userId);
    });

    it("should return null when user not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null);

      // Act
      const result = await getCurrentUserCommunity();

      // Assert
      expect(result).toBeNull();
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getMembershipForUser).not.toHaveBeenCalled();
    });

    it("should return null when user has no membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getMembershipForUser).mockResolvedValue(null);

      // Act
      const result = await getCurrentUserCommunity();

      // Assert
      expect(result).toBeNull();
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getMembershipForUser).toHaveBeenCalledWith(userId);
    });

    it("should handle DAL errors gracefully", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getMembershipForUser).mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(getCurrentUserCommunity()).rejects.toThrow("Database error");
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getMembershipForUser).toHaveBeenCalledWith(userId);
    });
  });

  describe("requireCommunityMembership", () => {
    it("should return community info when user has membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.requireUserCommunityMembership).mockResolvedValue(
        mockUserCommunityInfo,
      );

      // Act
      const result = await requireCommunityMembership();

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.requireUserCommunityMembership).toHaveBeenCalledWith(
        userId,
      );
    });

    it("should throw error when user not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null);

      // Act & Assert
      await expect(requireCommunityMembership()).rejects.toThrow(
        "Authentication required",
      );
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(
        communityDAL.requireUserCommunityMembership,
      ).not.toHaveBeenCalled();
    });

    it("should throw error when user has no membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.requireUserCommunityMembership).mockRejectedValue(
        new Error("User must be a member of a community"),
      );

      // Act & Assert
      await expect(requireCommunityMembership()).rejects.toThrow(
        "User must be a member of a community",
      );
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.requireUserCommunityMembership).toHaveBeenCalledWith(
        userId,
      );
    });

    it("should handle DAL errors gracefully", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.requireUserCommunityMembership).mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(requireCommunityMembership()).rejects.toThrow(
        "Database error",
      );
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.requireUserCommunityMembership).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe("getCurrentUserCommunityId", () => {
    it("should return community ID when user has membership", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getUserCommunityId).mockResolvedValue(communityId);

      // Act
      const result = await getCurrentUserCommunityId();

      // Assert
      expect(result).toBe(communityId);
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getUserCommunityId).toHaveBeenCalledWith(userId);
    });

    it("should return null when user not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null);

      // Act
      const result = await getCurrentUserCommunityId();

      // Assert
      expect(result).toBeNull();
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getUserCommunityId).not.toHaveBeenCalled();
    });

    it("should return null when user has no membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getUserCommunityId).mockResolvedValue(null);

      // Act
      const result = await getCurrentUserCommunityId();

      // Assert
      expect(result).toBeNull();
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getUserCommunityId).toHaveBeenCalledWith(userId);
    });

    it("should handle DAL errors gracefully", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getUserCommunityId).mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(getCurrentUserCommunityId()).rejects.toThrow(
        "Database error",
      );
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getUserCommunityId).toHaveBeenCalledWith(userId);
    });
  });

  describe("getCurrentUserVisibleCommunityIds", () => {
    it("should return the DAL's visible community IDs for an authenticated user", async () => {
      // Arrange
      const userId = "user-123";
      const visibleIds = ["community-1", "community-2", "community-3"];
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue(
        visibleIds,
      );

      // Act
      const result = await getCurrentUserVisibleCommunityIds();

      // Assert
      expect(result).toEqual(visibleIds);
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getVisibleCommunityIds).toHaveBeenCalledWith(userId);
    });

    it("should return an empty array when the user is not authenticated", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null);

      // Act
      const result = await getCurrentUserVisibleCommunityIds();

      // Assert
      expect(result).toEqual([]);
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getVisibleCommunityIds).not.toHaveBeenCalled();
    });

    it("should pass through an empty array from the DAL", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue([]);

      // Act
      const result = await getCurrentUserVisibleCommunityIds();

      // Assert
      expect(result).toEqual([]);
      expect(communityDAL.getVisibleCommunityIds).toHaveBeenCalledWith(userId);
    });

    it("should handle DAL errors gracefully", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
      vi.mocked(communityDAL.getVisibleCommunityIds).mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(getCurrentUserVisibleCommunityIds()).rejects.toThrow(
        "Database error",
      );
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(communityDAL.getVisibleCommunityIds).toHaveBeenCalledWith(userId);
    });

    // Note: per-request memoization is provided by React's cache() wrapper
    // (identical to the other helpers in this module). The test harness
    // replaces cache() with the identity function, and React's cache()
    // only memoizes inside a real request scope, so memoization itself is
    // not unit-testable here — it's a structural guarantee of the wrapper.
  });
});
