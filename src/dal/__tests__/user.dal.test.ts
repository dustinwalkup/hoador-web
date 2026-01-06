import { describe, it, expect, vi, beforeEach } from "vitest";
import { userDAL } from "../index";
import { UserDAL } from "../user.dal";
import { ConflictError, NotFoundError } from "../errors";
import { mockUser, mockUserMinimal, mockAddress } from "@/test/fixtures/users";
import * as sessionUtils from "@/features/auth/utils/session";
import { db } from "@/db/db";

// Mock dependencies
vi.mock("@/features/auth/utils/session");
vi.mock("@/db/db", () => ({
  db: {
    query: {
      user: {
        findFirst: vi.fn(),
      },
      userAddresses: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/services/geocoding", () => ({
  geocodeAddress: vi.fn(),
}));

describe("UserDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    it("should create user with valid data", async () => {
      // Arrange
      const userData = {
        id: "user-123",
        name: "New User",
        email: "newuser@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
        phone: "5551234567",
      };

      vi.mocked(db.query.user.findFirst).mockResolvedValue(undefined); // No existing user

      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: userData.id,
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          emailVerified: false,
        },
      ]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);
      vi.mocked(db.query.user.findFirst)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          ...mockUser,
          id: userData.id,
        } as any);

      // Mock getUserStats which is called by getUserById
      // Uses select().from().leftJoin().where()
      const mockWhereStats = vi.fn().mockResolvedValue([
        {
          listingsBorrowed: 0,
          listingsShared: 0,
          averageRating: 0,
          totalReviews: 0,
        },
      ]);
      const mockLeftJoin = vi.fn().mockReturnValue({
        where: mockWhereStats,
      });
      const mockFromStats = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromStats,
      } as any);

      // Act
      const result = await userDAL.createUser(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(userData.id);
    });

    it("should throw ConflictError when user already exists", async () => {
      // Arrange
      const userData = {
        id: "user-123",
        name: "Existing User",
        email: "existing@example.com",
        password: "password123",
        firstName: "Existing",
        lastName: "User",
        phone: "5551234567",
      };

      vi.mocked(db.query.user.findFirst).mockResolvedValue({
        id: "existing-user",
        email: userData.email,
      } as any);

      // Act & Assert
      await expect(userDAL.createUser(userData)).rejects.toThrow(ConflictError);
    });
  });

  describe("getUserById", () => {
    it("should return user when found", async () => {
      // Arrange
      const userId = "user-123";
      vi.mocked(db.query.user.findFirst).mockResolvedValue({
        ...mockUser,
        addresses: [],
        preferences: {
          emailNotifications: true,
          smsNotifications: false,
        },
      } as any);

      // Mock getUserStats
      vi.spyOn(userDAL, "getUserStats").mockResolvedValue({
        listingsBorrowed: 5,
        listingsShared: 3,
        averageRating: 4.5,
        totalReviews: 8,
      });

      // Act
      const result = await userDAL.getUserById(userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
    });

    it("should throw NotFoundError when user not found", async () => {
      // Arrange
      const userId = "non-existent-user";
      vi.mocked(db.query.user.findFirst).mockResolvedValue(undefined);

      // Act & Assert
      await expect(userDAL.getUserById(userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe("formatPhoneNumber", () => {
    it("should format 10-digit phone number", () => {
      // Act
      const result = UserDAL.formatPhoneNumber("5551234567");

      // Assert
      expect(result).toBe("(555) 123-4567");
    });

    it("should format 11-digit phone number starting with 1", () => {
      // Act
      const result = UserDAL.formatPhoneNumber("15551234567");

      // Assert
      expect(result).toBe("(555) 123-4567");
    });

    it("should return original if invalid format", () => {
      // Act
      const result = UserDAL.formatPhoneNumber("123");

      // Assert
      expect(result).toBe("123");
    });
  });

  describe("updateCurrentUser", () => {
    it("should update profile when user is authenticated", async () => {
      // Arrange
      const userId = "user-123";
      const updateData = {
        firstName: "Updated",
        lastName: "Name",
        phone: "5559876543",
      };

      vi.mocked(sessionUtils.requireAuth).mockResolvedValue({
        id: userId,
      } as any);

      vi.mocked(db.query.user.findFirst).mockResolvedValue({
        ...mockUser,
        id: userId,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockUser, ...updateData }]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Mock getUserById for return value
      vi.spyOn(userDAL, "getUserById").mockResolvedValue({
        ...mockUser,
        ...updateData,
      } as any);

      // Act
      const result = await userDAL.updateCurrentUser(updateData);

      // Assert
      expect(result).toBeDefined();
      expect(sessionUtils.requireAuth).toHaveBeenCalled();
    });
  });

  describe("createUserWithAddress", () => {
    it("should create address with geocoding", async () => {
      // Arrange
      const userId = "user-123";
      const addressData = {
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zipCode: "94102",
      };

      vi.mocked(sessionUtils.requireAuth).mockResolvedValue({
        id: userId,
      } as any);

      // Mock user doesn't exist check (first call checks if user exists, should return undefined)
      vi.mocked(db.query.user.findFirst).mockResolvedValueOnce(undefined);

      const { geocodeAddress } = await import("@/services/geocoding");
      vi.mocked(geocodeAddress).mockResolvedValue({
        latitude: 37.7749,
        longitude: -122.4194,
      });

      // Mock user insert
      const mockUserReturning = vi.fn().mockResolvedValue([mockUser]);
      const mockUserValues = vi.fn().mockReturnValue({
        returning: mockUserReturning,
      });
      vi.mocked(db.insert).mockReturnValueOnce({
        values: mockUserValues,
      } as any);

      // Mock address insert
      const mockAddressReturning = vi.fn().mockResolvedValue([mockAddress]);
      const mockAddressValues = vi.fn().mockReturnValue({
        returning: mockAddressReturning,
      });
      vi.mocked(db.insert).mockReturnValueOnce({
        values: mockAddressValues,
      } as any);

      // Mock transaction
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          insert: vi.mocked(db.insert),
          query: db.query,
        };
        const result = await callback(tx);
        return result;
      });
      vi.mocked(db.transaction).mockImplementation(mockTransaction);

      // Mock getUserById which is called after transaction
      // Mock getUserStats which is called by getUserById
      const mockWhereStats = vi.fn().mockResolvedValue([
        {
          listingsBorrowed: 0,
          listingsShared: 0,
          averageRating: 0,
          totalReviews: 0,
        },
      ]);
      const mockLeftJoin = vi.fn().mockReturnValue({
        where: mockWhereStats,
      });
      const mockFromStats = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromStats,
      } as any);

      // Mock getUserById call after transaction (getUserById calls findFirst)
      vi.mocked(db.query.user.findFirst).mockResolvedValueOnce(mockUser as any);

      // Act
      const result = await userDAL.createUserWithAddress(
        {
          ...mockUserMinimal,
          address: addressData,
        } as any,
        "community-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(geocodeAddress).toHaveBeenCalled();
    });

    it("should validate address data", async () => {
      // Arrange
      const invalidAddressData = {
        street: "", // Empty street
        city: "San Francisco",
        state: "CA",
        zipCode: "94102",
      };

      vi.mocked(sessionUtils.requireAuth).mockResolvedValue({
        id: "user-123",
      } as any);

      // Act & Assert
      await expect(
        userDAL.createUserWithAddress(
          {
            ...mockUserMinimal,
            address: invalidAddressData,
          } as any,
          "community-123",
        ),
      ).rejects.toThrow();
    });
  });
});
