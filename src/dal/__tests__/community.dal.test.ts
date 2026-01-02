import { describe, it, expect, vi, beforeEach } from "vitest";
import { communityDAL } from "../index";
import { NotFoundError, ValidationError, UnauthorizedError } from "../errors";
import {
  mockCommunity,
  mockCommunityWithStats,
  mockCommunityMembership,
  mockUserCommunityInfo,
  mockJoinCode,
} from "@/test/fixtures/community";
import * as sessionUtils from "@/features/auth/utils/session";
import { db } from "@/db/db";

// Mock dependencies
vi.mock("@/features/auth/utils/session");
vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      communities: {
        findFirst: vi.fn(),
      },
      communityMemberships: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

describe("CommunityDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCommunityById", () => {
    it("should return community when found", async () => {
      // Arrange
      const communityId = "community-123";
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCommunityById(communityId);

      // Assert
      expect(result).toEqual(mockCommunity);
      expect(db.select).toHaveBeenCalled();
    });

    it("should return null when not found", async () => {
      // Arrange
      const communityId = "non-existent-community";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCommunityById(communityId);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const communityId = "community-123";
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.getCommunityById(communityId),
      ).rejects.toThrow();
    });
  });

  describe("getCommunityByJoinCode", () => {
    it("should return community for valid join code", async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCommunityByJoinCode(mockJoinCode);

      // Assert
      expect(result).toEqual(mockCommunity);
      expect(db.select).toHaveBeenCalled();
    });

    it("should throw ValidationError for empty join code", async () => {
      // Act & Assert
      await expect(communityDAL.getCommunityByJoinCode("")).rejects.toThrow(
        ValidationError,
      );
    });

    it("should return null for invalid join code", async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCommunityByJoinCode("INVALID123");

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.getCommunityByJoinCode(mockJoinCode),
      ).rejects.toThrow();
    });
  });

  describe("validateJoinCodeForSignup", () => {
    it("should return community for valid join code (no auth required)", async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.validateJoinCodeForSignup(mockJoinCode);

      // Assert
      expect(result).toEqual(mockCommunity);
      expect(db.select).toHaveBeenCalled();
    });

    it("should throw ValidationError for empty join code", async () => {
      // Act & Assert
      await expect(communityDAL.validateJoinCodeForSignup("")).rejects.toThrow(
        ValidationError,
      );
    });

    it("should return null for invalid join code", async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.validateJoinCodeForSignup("INVALID123");

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.validateJoinCodeForSignup(mockJoinCode),
      ).rejects.toThrow();
    });
  });

  describe("getCommunityWithStats", () => {
    it("should return community with member and listing counts", async () => {
      // Arrange
      const communityId = "community-123";
      const mockLimit = vi.fn().mockResolvedValue([mockCommunityWithStats]);
      const mockGroupBy = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockWhere = vi.fn().mockReturnValue({
        groupBy: mockGroupBy,
      });
      const mockLeftJoinListings = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockLeftJoinMemberships = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinListings,
      });
      const mockFrom = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinMemberships,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCommunityWithStats(communityId);

      // Assert
      expect(result).toEqual(mockCommunityWithStats);
      expect(db.select).toHaveBeenCalled();
    });

    it("should return null when not found", async () => {
      // Arrange
      const communityId = "non-existent-community";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockGroupBy = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockWhere = vi.fn().mockReturnValue({
        groupBy: mockGroupBy,
      });
      const mockLeftJoinListings = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockLeftJoinMemberships = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinListings,
      });
      const mockFrom = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinMemberships,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCommunityWithStats(communityId);

      // Assert
      expect(result).toBeNull();
    });

    it("should return zero counts when no members/listings", async () => {
      // Arrange
      const communityId = "community-123";
      const communityWithZeroStats = {
        ...mockCommunity,
        memberCount: 0,
        listingCount: 0,
      };
      const mockLimit = vi.fn().mockResolvedValue([communityWithZeroStats]);
      const mockGroupBy = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockWhere = vi.fn().mockReturnValue({
        groupBy: mockGroupBy,
      });
      const mockLeftJoinListings = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockLeftJoinMemberships = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinListings,
      });
      const mockFrom = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinMemberships,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCommunityWithStats(communityId);

      // Assert
      expect(result?.memberCount).toBe(0);
      expect(result?.listingCount).toBe(0);
    });

    it("should handle database errors", async () => {
      // Arrange
      const communityId = "community-123";
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockGroupBy = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockWhere = vi.fn().mockReturnValue({
        groupBy: mockGroupBy,
      });
      const mockLeftJoinListings = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockLeftJoinMemberships = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinListings,
      });
      const mockFrom = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoinMemberships,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.getCommunityWithStats(communityId),
      ).rejects.toThrow();
    });
  });

  describe("createCommunity", () => {
    const validCommunityData = {
      name: "New Community",
      joinCode: "NEWCOMM123",
      address: "456 Main St",
      city: "New City",
      state: "NY",
      zip: "54321",
    };

    it("should create community with valid data", async () => {
      // Arrange
      const mockReturning = vi.fn().mockResolvedValue([mockCommunity]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Mock getCommunityByJoinCode to return null (no existing community)
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.createCommunity(validCommunityData);

      // Assert
      expect(result).toEqual(mockCommunity);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should throw ValidationError for missing name", async () => {
      // Arrange
      const invalidData = {
        ...validCommunityData,
        name: "",
      };

      // Act & Assert
      await expect(communityDAL.createCommunity(invalidData)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError for missing join code", async () => {
      // Arrange
      const invalidData = {
        ...validCommunityData,
        joinCode: "",
      };

      // Act & Assert
      await expect(communityDAL.createCommunity(invalidData)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError for duplicate join code", async () => {
      // Arrange
      // Mock getCommunityByJoinCode to return existing community
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.createCommunity({
          ...validCommunityData,
          joinCode: mockJoinCode,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      const dbError = new Error("Database connection failed");
      const mockReturning = vi.fn().mockRejectedValue(dbError);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.createCommunity(validCommunityData),
      ).rejects.toThrow();
    });
  });

  describe("updateCommunity", () => {
    const updateData = {
      name: "Updated Community Name",
    };

    it("should update community with valid data", async () => {
      // Arrange
      const updatedCommunity = {
        ...mockCommunity,
        ...updateData,
      };
      const mockReturning = vi.fn().mockResolvedValue([updatedCommunity]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });
      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      const result = await communityDAL.updateCommunity(
        mockCommunity.id,
        updateData,
      );

      // Assert
      expect(result).toEqual(updatedCommunity);
      expect(db.update).toHaveBeenCalled();
    });

    it("should throw ValidationError for duplicate join code", async () => {
      // Arrange
      const updateDataWithJoinCode = {
        joinCode: "EXISTING123",
      };
      const existingCommunity = {
        ...mockCommunity,
        id: "other-community-id",
      };
      const mockLimit = vi.fn().mockResolvedValue([existingCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.updateCommunity(mockCommunity.id, updateDataWithJoinCode),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when community not found", async () => {
      // Arrange
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });
      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.updateCommunity("non-existent-id", updateData),
      ).rejects.toThrow(NotFoundError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(dbError),
        }),
      });
      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.updateCommunity(mockCommunity.id, updateData),
      ).rejects.toThrow();
    });
  });

  describe("deleteCommunity", () => {
    it("should delete community successfully", async () => {
      // Arrange
      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ id: mockCommunity.id }]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act
      await communityDAL.deleteCommunity(mockCommunity.id);

      // Assert
      expect(db.delete).toHaveBeenCalled();
    });

    it("should throw NotFoundError when community not found", async () => {
      // Arrange
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.deleteCommunity("non-existent-id"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      const mockWhere = vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(dbError),
      });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.deleteCommunity(mockCommunity.id),
      ).rejects.toThrow();
    });
  });

  // ============================
  // Membership Operations
  // ============================

  describe("addMember", () => {
    it("should add member to community", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const role = "member" as const;

      // Mock getCommunityById
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Mock check for existing membership (returns empty)
      const mockLimitMembership = vi.fn().mockResolvedValue([]);
      const mockWhereMembership = vi.fn().mockReturnValue({
        limit: mockLimitMembership,
      });
      const mockFromMembership = vi.fn().mockReturnValue({
        where: mockWhereMembership,
      });

      // Mock insert
      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockCommunityMembership]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Setup sequential selects
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: mockFrom,
        } as any)
        .mockReturnValueOnce({
          from: mockFromMembership,
        } as any);

      // Act
      const result = await communityDAL.addMember(userId, communityId, role);

      // Assert
      expect(result).toEqual(mockCommunityMembership);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should throw NotFoundError when community not found", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "non-existent-community";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(communityDAL.addMember(userId, communityId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should throw ValidationError when user already member", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";

      // Mock getCommunityById
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock existing membership check (returns existing)
      const mockLimitMembership = vi
        .fn()
        .mockResolvedValue([mockCommunityMembership]);
      const mockWhereMembership = vi.fn().mockReturnValue({
        limit: mockLimitMembership,
      });
      const mockFromMembership = vi.fn().mockReturnValue({
        where: mockWhereMembership,
      });

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: mockFrom,
        } as any)
        .mockReturnValueOnce({
          from: mockFromMembership,
        } as any);

      // Act & Assert
      await expect(communityDAL.addMember(userId, communityId)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should support admin and member roles", async () => {
      // Arrange
      const userId = "admin-user-123";
      const communityId = "community-123";
      const role = "admin" as const;

      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      const mockLimitMembership = vi.fn().mockResolvedValue([]);
      const mockWhereMembership = vi.fn().mockReturnValue({
        limit: mockLimitMembership,
      });
      const mockFromMembership = vi.fn().mockReturnValue({
        where: mockWhereMembership,
      });

      const adminMembership = {
        ...mockCommunityMembership,
        role: "admin" as const,
      };
      const mockReturning = vi.fn().mockResolvedValue([adminMembership]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: mockFrom,
        } as any)
        .mockReturnValueOnce({
          from: mockFromMembership,
        } as any);

      // Act
      const result = await communityDAL.addMember(userId, communityId, role);

      // Assert
      expect(result.role).toBe("admin");
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      const mockLimitMembership = vi.fn().mockResolvedValue([]);
      const mockWhereMembership = vi.fn().mockReturnValue({
        limit: mockLimitMembership,
      });
      const mockFromMembership = vi.fn().mockReturnValue({
        where: mockWhereMembership,
      });

      const dbError = new Error("Database connection failed");
      const mockReturning = vi.fn().mockRejectedValue(dbError);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: mockFrom,
        } as any)
        .mockReturnValueOnce({
          from: mockFromMembership,
        } as any);

      // Act & Assert
      await expect(
        communityDAL.addMember(userId, communityId),
      ).rejects.toThrow();
    });
  });

  describe("removeMember", () => {
    it("should remove member from community", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ id: mockCommunityMembership.id }]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act
      await communityDAL.removeMember(userId, communityId);

      // Assert
      expect(db.delete).toHaveBeenCalled();
    });

    it("should throw NotFoundError when membership not found", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.removeMember(userId, communityId),
      ).rejects.toThrow(NotFoundError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const dbError = new Error("Database connection failed");
      const mockWhere = vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(dbError),
      });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.removeMember(userId, communityId),
      ).rejects.toThrow();
    });
  });

  describe("getMembershipForUser", () => {
    it("should return membership when user has one", async () => {
      // Arrange
      const userId = "user-123";
      const mockLimit = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getMembershipForUser(userId);

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
    });

    it("should return null when user has no membership", async () => {
      // Arrange
      const userId = "user-123";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getMembershipForUser(userId);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(communityDAL.getMembershipForUser(userId)).rejects.toThrow();
    });
  });

  describe("getCurrentUserMembership", () => {
    it("should return membership when authenticated user has one", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCurrentUserMembership();

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
      expect(sessionUtils.getCurrentUserId).toHaveBeenCalled();
    });

    it("should throw UnauthorizedError when not authenticated", async () => {
      // Arrange
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(null);

      // Act & Assert
      await expect(communityDAL.getCurrentUserMembership()).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("should return null when user has no membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCurrentUserMembership();

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(communityDAL.getCurrentUserMembership()).rejects.toThrow();
    });
  });

  describe("joinCommunityByCode", () => {
    it("should join community with valid join code", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      // Mock getCommunityByJoinCode
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock getMembershipForUser (no existing membership)
      const mockLimitMembership = vi.fn().mockResolvedValue([]);
      const mockWhereMembership = vi.fn().mockReturnValue({
        limit: mockLimitMembership,
      });
      const mockInnerJoinMembership = vi.fn().mockReturnValue({
        where: mockWhereMembership,
      });
      const mockFromMembership = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoinMembership,
      });

      // Mock getCommunityById (called by addMember)
      const mockLimitCommunity = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhereCommunity = vi.fn().mockReturnValue({
        limit: mockLimitCommunity,
      });
      const mockFromCommunity = vi.fn().mockReturnValue({
        where: mockWhereCommunity,
      });

      // Mock existing membership check in addMember (no existing membership)
      const mockLimitExisting = vi.fn().mockResolvedValue([]);
      const mockWhereExisting = vi.fn().mockReturnValue({
        limit: mockLimitExisting,
      });
      const mockFromExisting = vi.fn().mockReturnValue({
        where: mockWhereExisting,
      });

      // Mock addMember (insert)
      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockCommunityMembership]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: mockFrom,
        } as any)
        .mockReturnValueOnce({
          from: mockFromMembership,
        } as any)
        .mockReturnValueOnce({
          from: mockFromCommunity,
        } as any)
        .mockReturnValueOnce({
          from: mockFromExisting,
        } as any);

      // Act
      const result = await communityDAL.joinCommunityByCode(mockJoinCode);

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
    });

    it("should throw UnauthorizedError when not authenticated", async () => {
      // Arrange
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(null);

      // Act & Assert
      await expect(
        communityDAL.joinCommunityByCode(mockJoinCode),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should throw NotFoundError for invalid join code", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.joinCommunityByCode("INVALID123"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ValidationError when already member of community", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock getMembershipForUser (existing membership)
      const mockLimitMembership = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhereMembership = vi.fn().mockReturnValue({
        limit: mockLimitMembership,
      });
      const mockInnerJoinMembership = vi.fn().mockReturnValue({
        where: mockWhereMembership,
      });
      const mockFromMembership = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoinMembership,
      });

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: mockFrom,
        } as any)
        .mockReturnValueOnce({
          from: mockFromMembership,
        } as any);

      // Act & Assert
      await expect(
        communityDAL.joinCommunityByCode(mockJoinCode),
      ).rejects.toThrow(ValidationError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.joinCommunityByCode(mockJoinCode),
      ).rejects.toThrow();
    });
  });

  describe("joinCommunityForNewUser", () => {
    it("should join community for new user (no existing membership check)", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";

      // Mock getCommunityById (called first in joinCommunityForNewUser)
      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock getCommunityById (called again in addMember)
      const mockLimitCommunity = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhereCommunity = vi.fn().mockReturnValue({
        limit: mockLimitCommunity,
      });
      const mockFromCommunity = vi.fn().mockReturnValue({
        where: mockWhereCommunity,
      });

      // Mock existing membership check in addMember (no existing membership)
      const mockLimitMembership = vi.fn().mockResolvedValue([]);
      const mockWhereMembership = vi.fn().mockReturnValue({
        limit: mockLimitMembership,
      });
      const mockFromMembership = vi.fn().mockReturnValue({
        where: mockWhereMembership,
      });

      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockCommunityMembership]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: mockFrom,
        } as any)
        .mockReturnValueOnce({
          from: mockFromCommunity,
        } as any)
        .mockReturnValueOnce({
          from: mockFromMembership,
        } as any);

      // Act
      const result = await communityDAL.joinCommunityForNewUser(
        userId,
        communityId,
      );

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
    });

    it("should throw NotFoundError when community not found", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "non-existent-community";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.joinCommunityForNewUser(userId, communityId),
      ).rejects.toThrow(NotFoundError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.joinCommunityForNewUser(userId, communityId),
      ).rejects.toThrow();
    });
  });

  describe("leaveCommunity", () => {
    it("should leave current community successfully", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      // Mock getMembershipForUser
      const mockLimit = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });

      // Mock removeMember (delete)
      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ id: mockCommunityMembership.id }]);
      const mockWhereDelete = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhereDelete,
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      await communityDAL.leaveCommunity();

      // Assert
      expect(db.delete).toHaveBeenCalled();
    });

    it("should throw UnauthorizedError when not authenticated", async () => {
      // Arrange
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(null);

      // Act & Assert
      await expect(communityDAL.leaveCommunity()).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("should throw NotFoundError when not a member", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(communityDAL.leaveCommunity()).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(communityDAL.leaveCommunity()).rejects.toThrow();
    });
  });

  // ============================
  // Utility Methods
  // ============================

  describe("isUserMemberOfCommunity", () => {
    it("should return true when user is member", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const mockLimit = vi.fn().mockResolvedValue([{ id: "membership-123" }]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.isUserMemberOfCommunity(
        userId,
        communityId,
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when user not member", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.isUserMemberOfCommunity(
        userId,
        communityId,
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.isUserMemberOfCommunity(userId, communityId),
      ).rejects.toThrow();
    });
  });

  describe("isCurrentUserMemberOfCommunity", () => {
    it("should return true when current user is member", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([{ id: "membership-123" }]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result =
        await communityDAL.isCurrentUserMemberOfCommunity(communityId);

      // Assert
      expect(result).toBe(true);
      expect(sessionUtils.getCurrentUserId).toHaveBeenCalled();
    });

    it("should return false when not authenticated", async () => {
      // Arrange
      const communityId = "community-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(null);

      // Act
      const result =
        await communityDAL.isCurrentUserMemberOfCommunity(communityId);

      // Assert
      expect(result).toBe(false);
      expect(sessionUtils.getCurrentUserId).toHaveBeenCalled();
    });

    it("should return false when not member", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result =
        await communityDAL.isCurrentUserMemberOfCommunity(communityId);

      // Assert
      expect(result).toBe(false);
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.isCurrentUserMemberOfCommunity(communityId),
      ).rejects.toThrow();
    });
  });

  describe("getUserCommunityId", () => {
    it("should return community ID when user has membership", async () => {
      // Arrange
      const userId = "user-123";
      const mockLimit = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getUserCommunityId(userId);

      // Assert
      expect(result).toBe(mockCommunity.id);
    });

    it("should return null when user has no membership", async () => {
      // Arrange
      const userId = "user-123";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getUserCommunityId(userId);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(communityDAL.getUserCommunityId(userId)).rejects.toThrow();
    });
  });

  describe("getCurrentUserCommunityId", () => {
    it("should return community ID when authenticated user has membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCurrentUserCommunityId();

      // Assert
      expect(result).toBe(mockCommunity.id);
      expect(sessionUtils.getCurrentUserId).toHaveBeenCalled();
    });

    it("should return null when not authenticated", async () => {
      // Arrange
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(null);

      // Act
      const result = await communityDAL.getCurrentUserCommunityId();

      // Assert
      expect(result).toBeNull();
      expect(sessionUtils.getCurrentUserId).toHaveBeenCalled();
    });

    it("should return null when user has no membership", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.getCurrentUserCommunityId();

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(communityDAL.getCurrentUserCommunityId()).rejects.toThrow();
    });
  });

  describe("requireUserCommunityMembership", () => {
    it("should return membership when user has one", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await communityDAL.requireUserCommunityMembership();

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
      expect(sessionUtils.getCurrentUserId).toHaveBeenCalled();
    });

    it("should throw UnauthorizedError when not authenticated", async () => {
      // Arrange
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(null);

      // Act & Assert
      await expect(
        communityDAL.requireUserCommunityMembership(),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when not a member", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.requireUserCommunityMembership(),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(sessionUtils.getCurrentUserId).mockResolvedValue(userId);

      const dbError = new Error("Database connection failed");
      const mockLimit = vi.fn().mockRejectedValue(dbError);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act & Assert
      await expect(
        communityDAL.requireUserCommunityMembership(),
      ).rejects.toThrow();
    });
  });
});
