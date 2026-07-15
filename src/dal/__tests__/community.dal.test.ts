import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommunityDAL } from "../community.dal";
import { communityDAL } from "../index";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import type { AuditLogDAL } from "../audit-log.dal";
import {
  mockCommunity,
  mockCommunityWithStats,
  mockCommunityMembership,
  mockCommunityNetwork,
  mockCommunityVisibility,
  mockInactiveCommunity,
  mockUserCommunityInfo,
  mockJoinCode,
} from "@/test/fixtures/community";
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

    it("should create a community without a join code (joinCode is optional)", async () => {
      // Arrange — no join code supplied; the multi-community model allows it.
      const mockReturning = vi.fn().mockResolvedValue([mockCommunity]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      // Act
      const result = await communityDAL.createCommunity({
        ...validCommunityData,
        joinCode: undefined,
      });

      // Assert
      expect(result).toEqual(mockCommunity);
      // joinCode normalised to null; uniqueness check skipped (no db.select).
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ joinCode: null }),
      );
      expect(db.select).not.toHaveBeenCalled();
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

  describe("getPrimaryMembershipForUser", () => {
    it("should return the primary membership when the user has one", async () => {
      // Arrange
      const userId = "user-123";
      const mockLimit = vi.fn().mockResolvedValue([
        {
          membership: mockCommunityMembership,
          community: mockCommunity,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      // Act
      const result = await communityDAL.getPrimaryMembershipForUser(userId);

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
      expect(mockWhere).toHaveBeenCalled();
    });

    it("should return null when the user has no primary membership", async () => {
      // Arrange
      const userId = "user-123";
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      // Act
      const result = await communityDAL.getPrimaryMembershipForUser(userId);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const mockLimit = vi
        .fn()
        .mockRejectedValue(new Error("Database connection failed"));
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      // Act & Assert
      await expect(
        communityDAL.getPrimaryMembershipForUser(userId),
      ).rejects.toThrow();
    });
  });

  describe("joinCommunityByCode", () => {
    it("should join community with valid join code", async () => {
      // Arrange
      const userId = "user-123";

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
      const result = await communityDAL.joinCommunityByCode(
        mockJoinCode,
        userId,
      );

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
    });

    it("should throw NotFoundError for invalid join code", async () => {
      // Arrange
      const userId = "user-123";

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
        communityDAL.joinCommunityByCode("INVALID123", userId),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ValidationError when already member of community", async () => {
      // Arrange
      const userId = "user-123";

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
        communityDAL.joinCommunityByCode(mockJoinCode, userId),
      ).rejects.toThrow(ValidationError);
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";

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
        communityDAL.joinCommunityByCode(mockJoinCode, userId),
      ).rejects.toThrow();
    });
  });

  describe("joinCommunityForNewUser", () => {
    it("should create a verified primary membership for the new user", async () => {
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
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockCommunityMembership]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await communityDAL.joinCommunityForNewUser(
        userId,
        communityId,
      );

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
      // Legacy code-based join is pre-verified: primary + verified.
      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues).toMatchObject({
        userId,
        communityId,
        role: "member",
        isPrimary: true,
        verificationStatus: "verified",
      });
      expect(insertedValues.verifiedAt).toBeInstanceOf(Date);
    });

    it("should throw when the insert returns no row", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";

      const mockLimit = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      // Act & Assert
      await expect(
        communityDAL.joinCommunityForNewUser(userId, communityId),
      ).rejects.toThrow(NotFoundError);
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
      await communityDAL.leaveCommunity(userId);

      // Assert
      expect(db.delete).toHaveBeenCalled();
    });

    it("should throw NotFoundError when not a member", async () => {
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

      // Act & Assert
      await expect(communityDAL.leaveCommunity(userId)).rejects.toThrow(
        NotFoundError,
      );
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
      await expect(communityDAL.leaveCommunity(userId)).rejects.toThrow();
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

  describe("requireUserCommunityMembership", () => {
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
      const result = await communityDAL.requireUserCommunityMembership(userId);

      // Assert
      expect(result).toEqual(mockUserCommunityInfo);
    });

    it("should throw ValidationError when not a member", async () => {
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

      // Act & Assert
      await expect(
        communityDAL.requireUserCommunityMembership(userId),
      ).rejects.toThrow(ValidationError);
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
      await expect(
        communityDAL.requireUserCommunityMembership(userId),
      ).rejects.toThrow();
    });
  });

  // ============================
  // Network methods (§4.1)
  // ============================

  describe("getNetworkById", () => {
    it("returns the network when found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([mockCommunityNetwork]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await communityDAL.getNetworkById(mockCommunityNetwork.id);
      expect(result).toEqual(mockCommunityNetwork);
    });

    it("returns null when no row matches", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await communityDAL.getNetworkById("missing");
      expect(result).toBeNull();
    });
  });

  describe("getNetworkBySlug", () => {
    it("returns the network when slug matches", async () => {
      const mockLimit = vi.fn().mockResolvedValue([mockCommunityNetwork]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await communityDAL.getNetworkBySlug(
        mockCommunityNetwork.slug,
      );
      expect(result).toEqual(mockCommunityNetwork);
    });

    it("throws ValidationError on empty slug", async () => {
      await expect(communityDAL.getNetworkBySlug("")).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe("listNetworks", () => {
    it("returns ordered networks", async () => {
      const networks = [mockCommunityNetwork];
      const mockOrderBy = vi.fn().mockResolvedValue(networks);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await communityDAL.listNetworks();
      expect(result).toEqual(networks);
    });
  });

  describe("listCommunitiesByNetwork", () => {
    it("returns active+all communities, ordered by name", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await communityDAL.listCommunitiesByNetwork(
        mockCommunityNetwork.id,
      );
      expect(result).toEqual([mockCommunity]);
      expect(mockWhere).toHaveBeenCalled();
    });

    it("filters by isActive when activeOnly=true", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([mockCommunity]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await communityDAL.listCommunitiesByNetwork(mockCommunityNetwork.id, {
        activeOnly: true,
      });
      // The where() call should have received both predicates (network +
      // isActive). We can't easily assert SQL-level equality without
      // sqlToQuery, but we can confirm where was called once with a single
      // composed filter.
      expect(mockWhere).toHaveBeenCalledTimes(1);
    });
  });

  // ============================
  // selectPrimaryCommunity (§4.2)
  // ============================

  describe("selectPrimaryCommunity", () => {
    function mockGetCommunityById(community: typeof mockCommunity | null) {
      // First select() call: communities lookup by id
      const mockLimit = vi
        .fn()
        .mockResolvedValueOnce(community ? [community] : []);
      return { limit: mockLimit };
    }

    it("inserts a primary pending membership and returns UserCommunityInfo", async () => {
      // 1st select(): getCommunityById → returns active community
      const communityLimit = vi.fn().mockResolvedValueOnce([mockCommunity]);
      const communityWhere = vi
        .fn()
        .mockReturnValueOnce({ limit: communityLimit });
      const communityFrom = vi
        .fn()
        .mockReturnValueOnce({ where: communityWhere });

      // 2nd select(): existing primary check → none
      const primaryLimit = vi.fn().mockResolvedValueOnce([]);
      const primaryWhere = vi.fn().mockReturnValueOnce({ limit: primaryLimit });
      const primaryFrom = vi.fn().mockReturnValueOnce({ where: primaryWhere });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: communityFrom } as any)
        .mockReturnValueOnce({ from: primaryFrom } as any);

      // insert() chain
      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockCommunityMembership]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      const result = await communityDAL.selectPrimaryCommunity(
        "user-123",
        mockCommunity.id,
      );

      expect(result.community).toEqual(mockCommunity);
      expect(result.membership).toEqual(mockCommunityMembership);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          communityId: mockCommunity.id,
          isPrimary: true,
          verificationStatus: "pending",
        }),
      );
    });

    it("throws NotFoundError when community is missing", async () => {
      const limit = vi.fn().mockResolvedValueOnce([]);
      const where = vi.fn().mockReturnValue({ limit });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      await expect(
        communityDAL.selectPrimaryCommunity("user-123", "missing"),
      ).rejects.toThrow(NotFoundError);
      void mockGetCommunityById;
    });

    it("throws ValidationError when community is inactive", async () => {
      const limit = vi.fn().mockResolvedValueOnce([mockInactiveCommunity]);
      const where = vi.fn().mockReturnValue({ limit });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      await expect(
        communityDAL.selectPrimaryCommunity(
          "user-123",
          mockInactiveCommunity.id,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ConflictError when user already has a primary", async () => {
      // 1st select: community OK
      const communityLimit = vi.fn().mockResolvedValueOnce([mockCommunity]);
      const communityWhere = vi
        .fn()
        .mockReturnValueOnce({ limit: communityLimit });
      const communityFrom = vi
        .fn()
        .mockReturnValueOnce({ where: communityWhere });

      // 2nd select: existing primary found
      const primaryLimit = vi
        .fn()
        .mockResolvedValueOnce([{ id: mockCommunityMembership.id }]);
      const primaryWhere = vi.fn().mockReturnValueOnce({ limit: primaryLimit });
      const primaryFrom = vi.fn().mockReturnValueOnce({ where: primaryWhere });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: communityFrom } as any)
        .mockReturnValueOnce({ from: primaryFrom } as any);

      await expect(
        communityDAL.selectPrimaryCommunity("user-123", mockCommunity.id),
      ).rejects.toThrow(ConflictError);
    });
  });

  // ============================
  // Visibility methods (§4.3)
  // ============================

  describe("initializeUserVisibility", () => {
    it("bulk-inserts one row per active community in the network", async () => {
      // listCommunitiesByNetwork inner select chain
      const orderBy = vi
        .fn()
        .mockResolvedValueOnce([mockCommunity, { ...mockCommunity, id: "c2" }]);
      const where = vi.fn().mockReturnValue({ orderBy });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      // insert chain → onConflictDoNothing terminal
      const onConflict = vi.fn().mockResolvedValue(undefined);
      const values = vi
        .fn()
        .mockReturnValue({ onConflictDoNothing: onConflict });
      vi.mocked(db.insert).mockReturnValue({ values } as any);

      await communityDAL.initializeUserVisibility(
        "user-123",
        mockCommunityNetwork.id,
      );
      expect(values).toHaveBeenCalledWith([
        { userId: "user-123", communityId: mockCommunity.id, isVisible: true },
        { userId: "user-123", communityId: "c2", isVisible: true },
      ]);
      expect(onConflict).toHaveBeenCalled();
    });

    it("is a no-op when the network has no active communities", async () => {
      const orderBy = vi.fn().mockResolvedValueOnce([]);
      const where = vi.fn().mockReturnValue({ orderBy });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      await communityDAL.initializeUserVisibility(
        "user-123",
        mockCommunityNetwork.id,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("getVisibleCommunityIds", () => {
    it("returns the array of visible community IDs", async () => {
      const where = vi
        .fn()
        .mockResolvedValueOnce([{ communityId: "a" }, { communityId: "b" }]);
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result = await communityDAL.getVisibleCommunityIds("user-123");
      expect(result).toEqual(["a", "b"]);
    });

    it("returns [] when the user has no visibility rows", async () => {
      const where = vi.fn().mockResolvedValueOnce([]);
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result = await communityDAL.getVisibleCommunityIds("user-123");
      expect(result).toEqual([]);
    });
  });

  describe("isVisibleInCommunity", () => {
    const mockChain = (row: { isVisible: boolean } | undefined) => {
      const limit = vi.fn().mockResolvedValueOnce(row ? [row] : []);
      const where = vi.fn().mockReturnValue({ limit });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);
    };

    it("returns true when the row exists with is_visible = true", async () => {
      mockChain({ isVisible: true });
      await expect(
        communityDAL.isVisibleInCommunity("user-1", "comm-1"),
      ).resolves.toBe(true);
    });

    it("returns false when the row exists with is_visible = false", async () => {
      mockChain({ isVisible: false });
      await expect(
        communityDAL.isVisibleInCommunity("user-1", "comm-1"),
      ).resolves.toBe(false);
    });

    it("returns false (fail-closed) when no row exists", async () => {
      mockChain(undefined);
      await expect(
        communityDAL.isVisibleInCommunity("user-1", "comm-1"),
      ).resolves.toBe(false);
    });
  });

  describe("getVisibilityForUser", () => {
    it("returns rows joined with community info and the primary flag", async () => {
      const rows = [
        {
          visibility: mockCommunityVisibility,
          community: mockCommunity,
          isPrimary: true,
        },
      ];
      const orderBy = vi.fn().mockResolvedValueOnce(rows);
      const where = vi.fn().mockReturnValue({ orderBy });
      const leftJoin = vi.fn().mockReturnValue({ where });
      const innerJoin = vi.fn().mockReturnValue({ leftJoin });
      const from = vi.fn().mockReturnValue({ innerJoin });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result = await communityDAL.getVisibilityForUser("user-123");
      expect(result).toEqual(rows);
    });
  });

  describe("bulkSetVisibility", () => {
    it("returns [] when updates is empty without hitting db.select", async () => {
      const result = await communityDAL.bulkSetVisibility("user-123", []);
      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it("rejects toggling primary community to false (R4.5)", async () => {
      // primary lookup returns the membership for "primary-c"
      const limit = vi
        .fn()
        .mockResolvedValueOnce([{ communityId: "primary-c" }]);
      const where = vi.fn().mockReturnValue({ limit });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      await expect(
        communityDAL.bulkSetVisibility("user-123", [
          { communityId: "primary-c", isVisible: false },
        ]),
      ).rejects.toThrow(ValidationError);
    });

    it("upserts each update and returns results", async () => {
      // primary lookup returns no primary (e.g., user with only visibility rows)
      const limit = vi.fn().mockResolvedValueOnce([]);
      const where = vi.fn().mockReturnValue({ limit });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      // insert().values().onConflictDoUpdate().returning()
      const returning = vi
        .fn()
        .mockResolvedValueOnce([mockCommunityVisibility])
        .mockResolvedValueOnce([
          { ...mockCommunityVisibility, communityId: "c2", isVisible: false },
        ]);
      const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
      const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
      vi.mocked(db.insert).mockReturnValue({ values } as any);

      const result = await communityDAL.bulkSetVisibility("user-123", [
        { communityId: mockCommunityVisibility.communityId, isVisible: true },
        { communityId: "c2", isVisible: false },
      ]);
      expect(result).toHaveLength(2);
      expect(values).toHaveBeenCalledTimes(2);
    });
  });

  // ============================
  // Admin verification queue (§4.4)
  // ============================

  describe("listPendingVerifications", () => {
    it("returns paginated rows with user + address", async () => {
      const queueRow = {
        membership: mockCommunityMembership,
        community: mockCommunity,
        user: {
          id: "user-123",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          avatarUrl: null,
        },
        address: {
          id: "addr-1",
          street: "123 Main",
          city: "Town",
          state: "KS",
          zipCode: "66062",
          country: "US",
        },
      };

      // Two parallel selects (data + count) — both go through db.select
      const offset = vi.fn().mockResolvedValue([queueRow]);
      const limitFn = vi.fn().mockReturnValue({ offset });
      const orderBy = vi.fn().mockReturnValue({ limit: limitFn });
      const dataWhere = vi.fn().mockReturnValue({ orderBy });
      const leftJoin = vi.fn().mockReturnValue({ where: dataWhere });
      const innerJoin2 = vi.fn().mockReturnValue({ leftJoin });
      const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
      const dataFrom = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });

      const countWhere = vi.fn().mockResolvedValue([{ count: 1 }]);
      const countFrom = vi.fn().mockReturnValue({ where: countWhere });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: dataFrom } as any)
        .mockReturnValueOnce({ from: countFrom } as any);

      const result = await communityDAL.listPendingVerifications({
        page: 1,
        limit: 25,
      });
      expect(result.data).toEqual([queueRow]);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe("verifyMembership", () => {
    let mockAuditCreate: ReturnType<typeof vi.fn>;
    let dal: CommunityDAL;

    beforeEach(() => {
      mockAuditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
      dal = new CommunityDAL({
        auditLogDAL: { create: mockAuditCreate } as unknown as AuditLogDAL,
      });
    });

    it("sets status to verified, populates verifiedAt/verifiedBy, and writes audit log (§4.5)", async () => {
      const verified = {
        ...mockCommunityMembership,
        verificationStatus: "verified" as const,
        verifiedAt: new Date(),
        verifiedBy: "admin-1",
      };
      const returning = vi.fn().mockResolvedValue([verified]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      vi.mocked(db.update).mockReturnValue({ set } as any);

      const result = await dal.verifyMembership(
        mockCommunityMembership.id,
        "admin-1",
        "looks good",
      );

      expect(result).toEqual(verified);
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: "verified",
          verifiedBy: "admin-1",
          adminNotes: "looks good",
        }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith({
        entityType: "community_membership",
        entityId: mockCommunityMembership.id,
        action: "verification_verified",
        userId: "admin-1",
        metadata: { adminNotes: "looks good" },
      });
    });

    it("throws NotFoundError when no membership row is updated", async () => {
      const returning = vi.fn().mockResolvedValue([]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      vi.mocked(db.update).mockReturnValue({ set } as any);

      await expect(dal.verifyMembership("missing", "admin-1")).rejects.toThrow(
        NotFoundError,
      );
      expect(mockAuditCreate).not.toHaveBeenCalled();
    });

    it("writes a null metadata payload when adminNotes is omitted", async () => {
      const returning = vi.fn().mockResolvedValue([mockCommunityMembership]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      vi.mocked(db.update).mockReturnValue({ set } as any);

      await dal.verifyMembership(mockCommunityMembership.id, "admin-1");
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null }),
      );
    });
  });

  describe("denyMembership", () => {
    let mockAuditCreate: ReturnType<typeof vi.fn>;
    let dal: CommunityDAL;

    beforeEach(() => {
      mockAuditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
      dal = new CommunityDAL({
        auditLogDAL: { create: mockAuditCreate } as unknown as AuditLogDAL,
      });
    });

    it("sets status to denied, persists notes, and writes audit log", async () => {
      const denied = {
        ...mockCommunityMembership,
        verificationStatus: "denied" as const,
        verifiedBy: "admin-1",
        adminNotes: "out of bounds",
      };
      const returning = vi.fn().mockResolvedValue([denied]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      vi.mocked(db.update).mockReturnValue({ set } as any);

      const result = await dal.denyMembership(
        mockCommunityMembership.id,
        "admin-1",
        "out of bounds",
      );
      expect(result).toEqual(denied);
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: "denied",
          verifiedBy: "admin-1",
          adminNotes: "out of bounds",
        }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith({
        entityType: "community_membership",
        entityId: mockCommunityMembership.id,
        action: "verification_denied",
        userId: "admin-1",
        metadata: { adminNotes: "out of bounds" },
      });
    });

    it("throws ValidationError when admin notes are empty", async () => {
      await expect(
        dal.denyMembership(mockCommunityMembership.id, "admin-1", "   "),
      ).rejects.toThrow(ValidationError);
      expect(db.update).not.toHaveBeenCalled();
      expect(mockAuditCreate).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when no row is updated", async () => {
      const returning = vi.fn().mockResolvedValue([]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      vi.mocked(db.update).mockReturnValue({ set } as any);

      await expect(
        dal.denyMembership("missing", "admin-1", "denied"),
      ).rejects.toThrow(NotFoundError);
      expect(mockAuditCreate).not.toHaveBeenCalled();
    });
  });

  describe("getUserIdsVisibleInCommunity", () => {
    it("returns user IDs where is_visible = true for the community", async () => {
      const rows = [{ userId: "user-1" }, { userId: "user-2" }];
      const where = vi.fn().mockResolvedValue(rows);
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result =
        await communityDAL.getUserIdsVisibleInCommunity("community-abc");

      expect(result).toEqual(["user-1", "user-2"]);
      expect(db.select).toHaveBeenCalled();
    });

    it("returns an empty array when no visible users exist", async () => {
      const where = vi.fn().mockResolvedValue([]);
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result =
        await communityDAL.getUserIdsVisibleInCommunity("community-empty");

      expect(result).toEqual([]);
    });

    it("propagates database errors", async () => {
      const where = vi.fn().mockRejectedValue(new Error("db error"));
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      await expect(
        communityDAL.getUserIdsVisibleInCommunity("community-abc"),
      ).rejects.toThrow();
    });
  });
});
