import { describe, it, expect, vi, beforeEach } from "vitest";
import { listingDAL } from "../index";
import { NotFoundError, ValidationError } from "../errors";
import { mockListing } from "@/test/fixtures/listings";
import { db } from "@/db/db";

// Mock dependencies
vi.mock("@/features/auth/utils/session");
vi.mock("@/features/community/utils/membership");
vi.mock("@/features/auth/utils/guards");
vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    query: {
      listings: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      reviews: {
        findMany: vi.fn(),
      },
      userAddresses: {
        findFirst: vi.fn(),
      },
      userFavorites: {
        findFirst: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

describe("ListingDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createListing", () => {
    const validListingData = {
      name: "Test Power Drill",
      description: "A heavy-duty power drill",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      weeklyRate: 90.0,
      monthlyRate: 300.0,
      securityDeposit: 50.0,
      deliveryFee: 10.0,
    };

    it("should create listing when user is authenticated", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";

      const mockReturning = vi.fn().mockResolvedValue([mockListing]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await listingDAL.createListing(
        validListingData,
        userId,
        communityId,
      );

      // Assert
      expect(result).toEqual(mockListing);
      expect(db.insert).toHaveBeenCalled();
    });

    // Note: Auth checks are now done at the caller level (API routes/server actions)
    // The DAL no longer performs authentication, so this test is no longer applicable

    it("should sanitize text fields", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";

      const listingDataWithUnsafeContent = {
        ...validListingData,
        name: "<script>alert('xss')</script>Test Drill",
        description: "Description with <script>tags</script>",
      };

      const mockReturning = vi.fn().mockResolvedValue([mockListing]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      await listingDAL.createListing(
        listingDataWithUnsafeContent,
        userId,
        communityId,
      );

      // Assert
      expect(mockValues).toHaveBeenCalled();
      const valuesArg = mockValues.mock.calls[0][0];
      expect(valuesArg.name).not.toContain("<script>");
      expect(valuesArg.description).not.toContain("<script>");
    });

    it("should handle database errors", async () => {
      // Arrange
      const userId = "user-123";
      const communityId = "community-123";

      const dbError = new Error("Database connection failed");
      (dbError as any).code = "ECONNREFUSED";

      const mockReturning = vi.fn().mockRejectedValue(dbError);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act & Assert
      await expect(
        listingDAL.createListing(validListingData, userId, communityId),
      ).rejects.toThrow();
    });
  });

  describe("getListingById", () => {
    it("should return listing when found", async () => {
      // Arrange
      const listingId = "listing-123";
      // Mock the raw database structure (what db.query.listings.findFirst returns)
      const rawListing = {
        ...mockListing,
        dailyRate: "15.00",
        weeklyRate: "90.00",
        monthlyRate: "300.00",
        securityDeposit: "50.00",
        deliveryFee: "10.00",
        setupFee: "0.00",
        owner: {
          id: "user-123",
          firstName: "John",
          lastName: "Doe",
          profileImageUrl: "https://example.com/profile.jpg",
          createdAt: new Date("2024-01-01"),
        },
        category: {
          id: "category-123",
          name: "Power Tools",
          description: "Electric power tools",
          icon: "drill",
        },
        reviews: [],
        availability: [],
      };
      vi.mocked(db.query.listings.findFirst).mockResolvedValue(
        rawListing as any,
      );

      // Mock select().from() chain for images
      const mockOrderBy = vi.fn().mockResolvedValue(mockListing.images || []);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Mock reviews query for owner rating
      vi.mocked(db.query.reviews.findMany).mockResolvedValue([]);

      // Mock favorites check
      vi.mocked(db.query.userFavorites.findFirst).mockResolvedValue(undefined);

      // Mock getUserPrimaryAddress
      vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue({
        city: "San Francisco",
        state: "CA",
      } as any);

      // Act
      const result = await listingDAL.getListingById(listingId);

      // Assert - expect transformed structure
      expect(result.id).toBe(mockListing.id);
      expect(result.name).toBe(mockListing.name);
      expect(result.dailyRate).toBe(15); // Converted to number
      expect(result.averageRating).toBe(0); // Calculated from empty reviews
      expect(result.images).toEqual(mockListing.images || []);
      expect(db.query.listings.findFirst).toHaveBeenCalled();
    });

    it("should throw NotFoundError when listing not found", async () => {
      // Arrange
      const listingId = "non-existent-listing";
      vi.mocked(db.query.listings.findFirst).mockResolvedValue(undefined);

      // Mock select().from() chain
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Mock favorites check
      vi.mocked(db.query.userFavorites.findFirst).mockResolvedValue(undefined);

      // Act & Assert
      await expect(listingDAL.getListingById(listingId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should include user-specific data when userId provided", async () => {
      // Arrange
      const listingId = "listing-123";
      const userId = "user-456"; // Different from owner to test view count increment
      vi.mocked(db.query.listings.findFirst).mockResolvedValue({
        ...mockListing,
        ownerId: "user-123", // Owner ID different from userId
      } as any);

      // Mock select().from() chain for images
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Mock reviews query
      vi.mocked(db.query.reviews.findMany).mockResolvedValue([]);

      // Mock userFavorites query
      vi.mocked(db.query.userFavorites.findFirst).mockResolvedValue(undefined);

      // Mock userAddresses query
      vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue(undefined);

      // Mock db.update() chain for view count increment
      const mockWhereUpdate = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhereUpdate,
      });
      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      await listingDAL.getListingById(listingId, userId);

      // Assert
      expect(db.query.listings.findFirst).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled(); // View count should be incremented
    });
  });

  describe("updateListing", () => {
    const updateData = {
      name: "Updated Listing Name",
      description: "Updated description",
      dailyRate: 20.0,
    };

    it("should update listing when user is owner", async () => {
      // Arrange
      const listingId = "listing-123";
      const userId = "user-123";
      vi.mocked(db.query.listings.findFirst).mockResolvedValue({
        ...mockListing,
        ownerId: userId,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockListing, ...updateData }]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Mock getListingById which is called at the end of updateListing
      // Mock select().from() chain for images
      const mockOrderByImage = vi.fn().mockResolvedValue([]);
      const mockWhereImage = vi.fn().mockReturnValue({
        orderBy: mockOrderByImage,
      });
      const mockFromImage = vi.fn().mockReturnValue({
        where: mockWhereImage,
      });

      // Mock select to return different chains based on call
      vi.mocked(db.select).mockImplementation(() => {
        return { from: mockFromImage } as any;
      });

      // Mock reviews query
      vi.mocked(db.query.reviews.findMany).mockResolvedValue([]);

      // Mock favorites check
      vi.mocked(db.query.userFavorites.findFirst).mockResolvedValue(undefined);

      // Mock getUserPrimaryAddress
      vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue(undefined);

      // Mock the listing query for getListingById (called at end)
      const updatedRawListing = {
        ...mockListing,
        ...updateData,
        dailyRate: updateData.dailyRate?.toString() || "15.00",
        owner: {
          id: userId,
          firstName: "John",
          lastName: "Doe",
          profileImageUrl: "https://example.com/profile.jpg",
          createdAt: new Date("2024-01-01"),
        },
        category: {
          id: "category-123",
          name: "Power Tools",
          description: "Electric power tools",
          icon: "drill",
        },
        reviews: [],
        availability: [],
      };
      vi.mocked(db.query.listings.findFirst)
        .mockResolvedValueOnce({
          ...mockListing,
          ownerId: userId,
        } as any)
        .mockResolvedValueOnce(updatedRawListing as any);

      // Act
      const result = await listingDAL.updateListing(
        listingId,
        updateData,
        userId,
      );

      // Assert
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
    });

    // Note: Ownership checks are now done at the caller level (API routes/server actions)
    // The DAL no longer performs ownership verification, so this test is no longer applicable

    it("should throw NotFoundError when listing not found", async () => {
      // Arrange
      const listingId = "non-existent-listing";
      const userId = "user-123";
      vi.mocked(db.query.listings.findFirst).mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        listingDAL.updateListing(listingId, updateData, userId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateListingStatus", () => {
    it("should update status when user is owner", async () => {
      // Arrange
      const listingId = "listing-123";
      const newStatus = "rented" as const;

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockListing, status: newStatus }]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      const result = await listingDAL.updateListingStatus(listingId, newStatus);

      // Assert
      expect(result.status).toBe(newStatus);
    });

    // Note: Ownership checks are now done at the caller level (API routes/server actions)
    // The DAL no longer performs ownership verification, so this test is no longer applicable
  });

  describe("deleteListing", () => {
    it("should soft delete listing when user is owner", async () => {
      // Arrange
      const listingId = "listing-123";

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockListing, status: "archived" }]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act
      await listingDAL.deleteListing(listingId);

      // Assert
      expect(db.delete).toHaveBeenCalled();
    });

    // Note: Ownership checks are now done at the caller level (API routes/server actions)
    // The DAL no longer performs ownership verification, so this test is no longer applicable
  });

  describe("searchListings", () => {
    it("should return paginated search results", async () => {
      // Arrange
      const filters = {
        query: "drill",
        categoryId: "category-123",
        minPrice: 10,
        maxPrice: 50,
      };
      const pagination = { page: 1, limit: 12 };

      // Mock getUserPrimaryAddress
      vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue({
        latitude: 37.7749,
        longitude: -122.4194,
      } as any);

      // Mock select().from().innerJoin().innerJoin().where() chain for count
      const mockWhereCount = vi.fn().mockResolvedValue([{ total: 1 }]);
      const mockInnerJoin2Count = vi.fn().mockReturnValue({
        where: mockWhereCount,
      });
      const mockInnerJoin1Count = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2Count,
      });
      const mockFromCount = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1Count,
      });

      // Mock select().from().innerJoin().innerJoin().leftJoin().where().orderBy().limit().offset() chain for data
      // The data query returns listingsWithRelations which has structure: { listing: {...}, category: {...}, owner: {...} }
      const mockOffset = vi.fn().mockResolvedValue([
        {
          listing: { ...mockListing, id: "listing-123" },
          category: { id: "category-123", name: "Power Tools", icon: "drill" },
          owner: { id: "user-123", firstName: "John", lastName: "Doe" },
        },
      ]);
      const mockLimit = vi.fn().mockReturnValue({
        offset: mockOffset,
      });
      const mockOrderBy = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockLeftJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockInnerJoin2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });

      // Mock select to return different chains based on call
      // searchListings makes multiple select calls:
      // 1. Count query - select({ total: count() }).from().innerJoin().innerJoin().where()
      // 2. Data query - select(selectFields).from().innerJoin().innerJoin().leftJoin().where().orderBy().limit().offset()
      // 3. Image queries - select().from().where().limit(1) (one per listing, in a loop)
      // 4. Reviews query - select().from().where()
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is for count
          return { from: mockFromCount } as any;
        } else if (callCount === 2) {
          // Second call is for data - returns listingsWithRelations array
          return { from: mockFrom } as any;
        } else if (callCount <= 2 + 1) {
          // Image queries - select().from().where().limit(1)
          // These are called in a loop, one per listing
          const mockImageLimit = vi.fn().mockResolvedValue([]);
          const mockImageWhere = vi.fn().mockReturnValue({
            limit: mockImageLimit,
          });
          const mockImageFrom = vi.fn().mockReturnValue({
            where: mockImageWhere,
          });
          return { from: mockImageFrom } as any;
        } else {
          // Reviews query - select().from().where()
          const mockReviewsWhere = vi.fn().mockResolvedValue([]);
          const mockReviewsFrom = vi.fn().mockReturnValue({
            where: mockReviewsWhere,
          });
          return { from: mockReviewsFrom } as any;
        }
      });

      // Act
      const result = await listingDAL.searchListings(
        filters,
        pagination,
        "user-123",
        "community-123",
        false,
      );

      // Assert
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("pagination");
      expect(result.data).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it("should handle empty search results", async () => {
      // Arrange
      const filters = { query: "nonexistent" };
      const pagination = { page: 1, limit: 12 };

      // Mock getUserPrimaryAddress
      vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue({
        latitude: 37.7749,
        longitude: -122.4194,
      } as any);

      // Mock select().from().innerJoin().innerJoin().where() chain for count
      const mockWhereCount = vi.fn().mockResolvedValue([{ total: 0 }]);
      const mockInnerJoin2Count = vi.fn().mockReturnValue({
        where: mockWhereCount,
      });
      const mockInnerJoin1Count = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2Count,
      });
      const mockFromCount = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1Count,
      });

      // Mock select().from().innerJoin().innerJoin().leftJoin().where().orderBy().limit().offset() chain for data
      // When empty results, searchListings still needs to handle reviews query
      const mockOffset = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({
        offset: mockOffset,
      });
      const mockOrderBy = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockLeftJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockInnerJoin2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });

      // Mock reviews query - select().from().where()
      const mockReviewsWhere = vi.fn().mockResolvedValue([]);
      const mockReviewsFrom = vi.fn().mockReturnValue({
        where: mockReviewsWhere,
      });

      // Mock select to return different chains based on call
      // searchListings makes: count query, data query, reviews query (no image queries when empty)
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { from: mockFromCount } as any; // Count query
        } else if (callCount === 2) {
          return { from: mockFrom } as any; // Data query (returns empty)
        } else {
          return { from: mockReviewsFrom } as any; // Reviews query
        }
      });

      // Act
      const result = await listingDAL.searchListings(
        filters,
        pagination,
        "user-123",
        "community-123",
        false,
      );

      // Assert
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it("should validate pagination parameters", async () => {
      // Arrange
      const filters = {};
      const invalidPagination = { page: 0, limit: 12 }; // Invalid page

      // Act & Assert
      await expect(
        listingDAL.searchListings(
          filters,
          invalidPagination,
          "user-123",
          "community-123",
          false,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("getUserListings", () => {
    it("should return user's listings with status filter", async () => {
      // Arrange
      const userId = "user-123";
      const status = "active" as const;

      // Mock select().from().where().orderBy() chain for getUserListings
      const mockOrderBy = vi.fn().mockResolvedValue([mockListing]);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock reviews query for each listing
      vi.mocked(db.query.reviews.findMany).mockResolvedValue([]);

      // Mock image query for each listing - select().from().where().limit(1)
      const mockImageLimit = vi.fn().mockResolvedValue([]);
      const mockImageWhere = vi.fn().mockReturnValue({
        limit: mockImageLimit,
      });
      const mockImageFrom = vi.fn().mockReturnValue({
        where: mockImageWhere,
      });

      // Mock select to handle multiple calls (getUserListings + image queries)
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call is for getUserListings
          return { from: mockFrom } as any;
        } else {
          // Subsequent calls are for image queries
          return { from: mockImageFrom } as any;
        }
      });

      // Act
      const result = await listingDAL.getUserListings(userId, status);

      // Assert
      // getUserListings returns UserListing[] directly, not { data, pagination }
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle empty user listings", async () => {
      // Arrange
      const userId = "user-123";
      const status = "active" as const;

      // Mock select().from().where().orderBy() chain for getUserListings
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock image query - select().from().where().limit(1)
      const mockImageLimit = vi.fn().mockResolvedValue([]);
      const mockImageWhere = vi.fn().mockReturnValue({
        limit: mockImageLimit,
      });
      const mockImageFrom = vi.fn().mockReturnValue({
        where: mockImageWhere,
      });

      // Mock select to handle multiple calls
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockFrom } as any; // getUserListings query
        } else {
          return { from: mockImageFrom } as any; // Image queries
        }
      });

      // Mock reviews query
      vi.mocked(db.query.reviews.findMany).mockResolvedValue([]);

      // Act
      const result = await listingDAL.getUserListings(userId, status);

      // Assert
      // getUserListings returns UserListing[] directly
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });
  });

  describe("getPendingReviews", () => {
    const mockPagination = { page: 1, limit: 10 };

    it("should return pending reviews when admin is authenticated", async () => {
      // Arrange
      const mockCountResult = [{ total: 5 }];
      const mockListingsResult = [
        {
          listing: {
            id: "listing-1",
            name: "Test Listing",
            approvalStatus: "pending_review",
            createdAt: new Date("2024-01-01"),
          },
          owner: {
            id: "user-1",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            profileImageUrl: null,
            isVerified: true,
            createdAt: new Date("2024-01-01"),
          },
          category: {
            id: "cat-1",
            name: "Tools",
            icon: null,
          },
        },
      ];

      const mockCountFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockCountResult),
      });
      const mockListingsFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockListingsResult),
                }),
              }),
            }),
          }),
        }),
      });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockCountFrom } as any;
        }
        return { from: mockListingsFrom } as any;
      });

      // Mock images query - db.query.listings is already defined in the mock, just ensure it exists
      // The mock is already set up in the vi.mock at the top

      // Mock other queries
      const mockImageFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.select).mockImplementation(() => {
        if (selectCallCount <= 2) {
          return {
            from: selectCallCount === 1 ? mockCountFrom : mockListingsFrom,
          } as any;
        }
        return { from: mockImageFrom } as any;
      });

      // Mock rental history queries - needs from().leftJoin().where()
      const mockRentalHistoryFrom = vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ totalRentals: 0, averageRating: 0 }]),
        }),
      });

      // Mock other listings count query
      const mockOtherListingsFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      // Mock review events query - from().where().orderBy()
      const mockReviewEventsFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      // Complete mock implementation with all query types
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockCountFrom } as any; // Total count
        } else if (selectCallCount === 2) {
          return { from: mockListingsFrom } as any; // Listings query
        } else if (selectCallCount === 3) {
          return { from: mockImageFrom } as any; // Images query
        } else if (selectCallCount === 6) {
          return { from: mockReviewEventsFrom } as any; // Review events query
        } else if (selectCallCount % 2 === 0) {
          return { from: mockOtherListingsFrom } as any; // Other listings count
        } else {
          return { from: mockRentalHistoryFrom } as any; // Rental history
        }
      });

      // Act
      const result = await listingDAL.getPendingReviews(
        mockPagination,
        "admin-user-123",
      );

      // Assert
      expect(result.pagination.total).toBe(5);
    });

    // Note: Auth checks are now done at the caller level (API routes/server actions)
    // The DAL no longer performs authentication, so this test is no longer applicable
  });

  describe("getReviewHistory", () => {
    const mockPagination = { page: 1, limit: 10 };

    it("should return approved listings when status is 'approved'", async () => {
      // Arrange
      const mockCountResult = [{ total: 3 }];
      const mockListingsResult = [
        {
          listing: {
            id: "listing-1",
            approvalStatus: "approved",
            reviewedAt: new Date("2024-01-02"),
          },
          owner: {
            id: "user-1",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            profileImageUrl: null,
            isVerified: true,
            createdAt: new Date("2024-01-01"),
          },
          category: {
            id: "cat-1",
            name: "Tools",
            icon: null,
          },
        },
      ];

      const mockCountFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockCountResult),
      });
      const mockListingsFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockListingsResult),
                }),
              }),
            }),
          }),
        }),
      });

      // Mock images query
      const mockImageFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock other listings count query
      const mockOtherListingsFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      // Mock review events query - from().where().orderBy()
      const mockReviewEventsFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock rental history query - from().leftJoin().where()
      const mockRentalHistoryFrom = vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ totalRentals: 0, averageRating: 0 }]),
        }),
      });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockCountFrom } as any; // Total count
        } else if (selectCallCount === 2) {
          return { from: mockListingsFrom } as any; // Listings query
        } else if (selectCallCount === 3) {
          return { from: mockImageFrom } as any; // Images query
        } else if (selectCallCount === 6) {
          return { from: mockReviewEventsFrom } as any; // Review events query
        } else if (selectCallCount % 2 === 0) {
          return { from: mockOtherListingsFrom } as any; // Other listings count
        } else {
          return { from: mockRentalHistoryFrom } as any; // Rental history
        }
      });

      // Mock reviewer query
      vi.mocked(db.query.user.findFirst).mockResolvedValue({
        id: "admin-123",
        firstName: "Admin",
        lastName: "User",
        profileImageUrl: null,
      } as any);

      // Act
      const result = await listingDAL.getReviewHistory(
        "approved",
        mockPagination,
      );

      // Assert
      expect(result.pagination.total).toBe(3);
    });

    it("should return all reviewed listings when status is 'all'", async () => {
      // Arrange
      const mockCountResult = [{ total: 5 }];
      const mockCountFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockCountResult),
      });

      const mockListingsFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      // Mock images query
      const mockImageFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock other listings count query
      const mockOtherListingsFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      // Mock rental history query - from().leftJoin().where()
      const mockRentalHistoryFrom = vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ totalRentals: 0, averageRating: 0 }]),
        }),
      });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockCountFrom } as any; // Total count
        } else if (selectCallCount === 2) {
          return { from: mockListingsFrom } as any; // Listings query
        } else if (selectCallCount === 3) {
          return { from: mockImageFrom } as any; // Images query
        } else if (selectCallCount % 2 === 0) {
          return { from: mockOtherListingsFrom } as any; // Other listings count
        } else {
          return { from: mockRentalHistoryFrom } as any; // Rental history
        }
      });

      // Mock reviewer query
      vi.mocked(db.query.user.findFirst).mockResolvedValue(undefined);

      // Act
      const result = await listingDAL.getReviewHistory("all", mockPagination);

      // Assert
      expect(result.pagination.total).toBe(5);
    });
  });

  describe("updateApprovalStatus", () => {
    it("should approve listing when admin is authenticated and listing is pending", async () => {
      // Arrange
      const listingId = "listing-approve-123";
      const mockListing = {
        id: listingId,
        approvalStatus: "pending_review" as const,
        status: "inactive" as const,
      };

      // Mock select query (to check listing exists)
      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockListing]),
      });

      // Mock update query (to update listing)
      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: listingId }]),
        }),
      });

      vi.mocked(db.select).mockImplementation(() => {
        return { from: mockSelectFrom } as any;
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockUpdateSet,
      } as any);

      // Act
      await listingDAL.updateApprovalStatus(
        listingId,
        "approved",
        "admin-user-123",
      );

      // Assert
      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it("should reject listing with reason when admin is authenticated", async () => {
      // Arrange
      const listingId = "listing-reject-123";
      const mockListing = {
        id: listingId,
        approvalStatus: "pending_review" as const,
        status: "inactive" as const,
      };
      const rejectionReason = "Listing does not meet quality standards";

      // Mock select query (to check listing exists)
      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockListing]),
      });

      // Mock update query (to update listing)
      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: listingId }]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);
      vi.mocked(db.update).mockReturnValue({
        set: mockUpdateSet,
      } as any);

      // Act
      await listingDAL.updateApprovalStatus(
        listingId,
        "rejected",
        "admin-user-123",
        rejectionReason,
      );

      // Assert
      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it("should return { updated: false } when listing is already in the requested state (idempotent no-op)", async () => {
      // Arrange
      const listingId = "listing-reviewed-123";
      const mockListing = {
        id: listingId,
        approvalStatus: "approved" as const, // Already approved
        status: "available" as const,
      };

      // Mock select query (to check listing exists)
      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockListing]),
      });

      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      // Act & Assert — same action as current status is a no-op, not an error
      const result = await listingDAL.updateApprovalStatus(
        listingId,
        "approved",
        "admin-user-123",
      );
      expect(result).toEqual({ updated: false });
    });

    it("should throw ValidationError when listing has been reviewed with a conflicting action", async () => {
      // Arrange — listing is approved but caller wants to reject it
      const listingId = "listing-reviewed-123";
      const mockListing = {
        id: listingId,
        approvalStatus: "approved" as const,
        status: "available" as const,
      };

      // Mock select query (to check listing exists)
      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockListing]),
      });

      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      // Act & Assert
      await expect(
        listingDAL.updateApprovalStatus(
          listingId,
          "rejected",
          "admin-user-123",
          "some reason",
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when listing does not exist", async () => {
      // Arrange
      const listingId = "listing-notfound-123";

      // Mock select query (to check listing exists - returns empty array)
      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]), // No listing found
      });

      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      // Act & Assert
      await expect(
        listingDAL.updateApprovalStatus(
          listingId,
          "approved",
          "admin-user-123",
        ),
      ).rejects.toThrow(NotFoundError);
    });

    // Note: Auth checks are now done at the caller level (API routes/server actions)
    // The DAL no longer performs authentication, so this test is no longer applicable
  });

  describe("countPendingReviews", () => {
    it("should return count of pending reviews", async () => {
      // Arrange
      const mockCountResult = [{ count: 5 }];
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockCountResult),
      });

      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      // Act
      const result = await listingDAL.countPendingReviews();

      // Assert
      expect(result).toBe(5);
    });

    it("should return 0 when no pending reviews", async () => {
      // Arrange
      const mockCountResult = [{ count: 0 }];
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockCountResult),
      });

      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      // Act
      const result = await listingDAL.countPendingReviews();

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("getUserListingsByApprovalStatus", () => {
    const userId = "user-123";

    it("should return user listings with pending_review status", async () => {
      // Arrange
      const mockListings = [
        {
          id: "listing-pending-1",
          ownerId: userId,
          approvalStatus: "pending_review",
          createdAt: new Date("2024-01-01"),
          dailyRate: "15.00",
          weeklyRate: "90.00",
          monthlyRate: "300.00",
          securityDeposit: "50.00",
          deliveryFee: "10.00",
          setupFee: "0.00",
        },
      ];

      // Mock the main listings query
      const mockOrderBy = vi.fn().mockResolvedValue(mockListings);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock the reviews query (called for each listing)
      vi.mocked(db.query.reviews.findMany).mockResolvedValue([]);

      // Mock the images query (called for each listing)
      const mockImageLimit = vi.fn().mockResolvedValue([]);
      const mockImageWhere = vi.fn().mockReturnValue({
        limit: mockImageLimit,
      });
      const mockImageFrom = vi.fn().mockReturnValue({
        where: mockImageWhere,
      });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: main listings query
          return { from: mockFrom } as any;
        } else {
          // Subsequent calls: image queries (one per listing)
          return { from: mockImageFrom } as any;
        }
      });

      // Act
      const result = await listingDAL.getUserListingsByApprovalStatus(
        "pending_review",
        userId,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].approvalStatus).toBe("pending_review");
    });

    it("should return user listings with rejected status", async () => {
      // Arrange
      const mockListings = [
        {
          id: "listing-rejected-1",
          ownerId: userId,
          approvalStatus: "rejected",
          createdAt: new Date("2024-01-01"),
          dailyRate: "15.00",
          weeklyRate: "90.00",
          monthlyRate: "300.00",
          securityDeposit: "50.00",
          deliveryFee: "10.00",
          setupFee: "0.00",
        },
      ];

      // Mock the main listings query
      const mockOrderBy = vi.fn().mockResolvedValue(mockListings);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      // Mock the reviews query (called for each listing)
      vi.mocked(db.query.reviews.findMany).mockResolvedValue([]);

      // Mock the images query (called for each listing)
      const mockImageLimit = vi.fn().mockResolvedValue([]);
      const mockImageWhere = vi.fn().mockReturnValue({
        limit: mockImageLimit,
      });
      const mockImageFrom = vi.fn().mockReturnValue({
        where: mockImageWhere,
      });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: main listings query
          return { from: mockFrom } as any;
        } else {
          // Subsequent calls: image queries (one per listing)
          return { from: mockImageFrom } as any;
        }
      });

      // Act
      const result = await listingDAL.getUserListingsByApprovalStatus(
        "rejected",
        userId,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].approvalStatus).toBe("rejected");
    });
  });

  describe("getTopPerformingListings", () => {
    const userId = "user-123";

    it("should return top listings by rental count then rating", async () => {
      const userListings = [
        { id: "listing-1", name: "Drill" },
        { id: "listing-2", name: "Saw" },
      ];
      const countRows = [
        { listingId: "listing-1", rentalCount: 5 },
        { listingId: "listing-2", rentalCount: 2 },
      ];
      const ratingRows = [
        { listingId: "listing-1", avgRating: 4.5 },
        { listingId: "listing-2", avgRating: 4.8 },
      ];

      const mockWhere1 = vi.fn().mockResolvedValue(userListings);
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockGroupBy2 = vi.fn().mockResolvedValue(countRows);
      const mockWhere2 = vi.fn().mockReturnValue({ groupBy: mockGroupBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockGroupBy3 = vi.fn().mockResolvedValue(ratingRows);
      const mockFrom3 = vi.fn().mockReturnValue({ groupBy: mockGroupBy3 });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return { from: mockFrom1 } as any;
        if (selectCallCount === 2) return { from: mockFrom2 } as any;
        return { from: mockFrom3 } as any;
      });

      const result = await listingDAL.getTopPerformingListings(userId, 5);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        listingId: "listing-1",
        name: "Drill",
        metricText: "5 rentals",
      });
      expect(result[1]).toEqual({
        listingId: "listing-2",
        name: "Saw",
        metricText: "2 rentals",
      });
    });

    it("should return listing with stars when no rentals", async () => {
      const userListings = [{ id: "listing-1", name: "Drill" }];
      const mockWhere1 = vi.fn().mockResolvedValue(userListings);
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockGroupBy2 = vi.fn().mockResolvedValue([]);
      const mockWhere2 = vi.fn().mockReturnValue({ groupBy: mockGroupBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockGroupBy3 = vi
        .fn()
        .mockResolvedValue([{ listingId: "listing-1", avgRating: 4.8 }]);
      const mockFrom3 = vi.fn().mockReturnValue({ groupBy: mockGroupBy3 });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return { from: mockFrom1 } as any;
        if (selectCallCount === 2) return { from: mockFrom2 } as any;
        return { from: mockFrom3 } as any;
      });

      const result = await listingDAL.getTopPerformingListings(userId, 5);

      expect(result).toHaveLength(1);
      expect(result[0].metricText).toBe("4.8 stars");
    });
  });

  describe("getRecentListingsNearUser", () => {
    // Use a distinct userId so getUserPrimaryAddress cache from other tests is not used
    const userId = "user-recent-listings-no-location";

    it("should return platform-wide recent listings when user has no location", async () => {
      vi.mocked(db.query.userAddresses.findFirst)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const mockLimit = vi.fn().mockResolvedValue([
        { id: "listing-1", name: "Drill" },
        { id: "listing-2", name: "Saw" },
      ]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await listingDAL.getRecentListingsNearUser(userId, 5);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "listing-1",
        name: "Drill",
        linkTo: "/dashboard/listings/listing-1",
      });
    });

    it("should return empty array when no listings", async () => {
      vi.mocked(db.query.userAddresses.findFirst)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await listingDAL.getRecentListingsNearUser(userId, 5);

      expect(result).toEqual([]);
    });
  });

  describe("getUserActiveListingsWithFilters (characterization)", () => {
    // Locks in the exact return shape of getUserActiveListingsWithFilters so a
    // refactor that removes the per-listing N+1 (images + reviews) cannot
    // change observable output.
    const userId = "user-123";

    const rawListings = [
      {
        id: "listing-a",
        ownerId: userId,
        name: "Drill A",
        description: "a drill",
        categoryId: "power-tools",
        communityId: "community-1",
        brand: "DeWalt",
        model: "A1",
        condition: "excellent",
        status: "available",
        isActive: true,
        dailyRate: "15.00",
        weeklyRate: "90.00",
        monthlyRate: "300.00",
        securityDeposit: "50.00",
        deliveryFee: "10.00",
        setupFee: "25.00",
        specifications: {},
        instructions: null,
        safetyNotes: null,
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 30,
        deliveryMode: "pickup_only",
        deliveryRadius: 10,
        setupAvailable: true,
        viewCount: 0,
        favoriteCount: 0,
        approvalStatus: "approved",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      },
      {
        id: "listing-b",
        ownerId: userId,
        name: "Hammer B",
        description: "a hammer",
        categoryId: "hand-tools",
        communityId: "community-1",
        brand: null,
        model: null,
        condition: "good",
        status: "rented",
        isActive: true,
        dailyRate: "5.50",
        weeklyRate: null,
        monthlyRate: null,
        securityDeposit: "10.00",
        deliveryFee: "0.00",
        setupFee: "0.00",
        specifications: {},
        instructions: null,
        safetyNotes: null,
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 7,
        deliveryMode: "pickup_only",
        deliveryRadius: 0,
        setupAvailable: false,
        viewCount: 0,
        favoriteCount: 0,
        approvalStatus: "approved",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-10"),
      },
      {
        id: "listing-c",
        ownerId: userId,
        name: "Saw C",
        description: "a saw",
        categoryId: "power-tools",
        communityId: "community-1",
        brand: "Makita",
        model: "C3",
        condition: "good",
        status: "available",
        isActive: true,
        dailyRate: "20.00",
        weeklyRate: "120.00",
        monthlyRate: "400.00",
        securityDeposit: "75.00",
        deliveryFee: "15.00",
        setupFee: "0.00",
        specifications: {},
        instructions: null,
        safetyNotes: null,
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 14,
        deliveryMode: "both_available",
        deliveryRadius: 20,
        setupAvailable: false,
        viewCount: 0,
        favoriteCount: 0,
        approvalStatus: "approved",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date("2024-01-05"),
        updatedAt: new Date("2024-01-05"),
      },
    ];

    // Reviews per listing (varying ratings to exercise avg computation)
    const reviewsByListing: Record<string, { rating: number }[]> = {
      "listing-a": [{ rating: 5 }, { rating: 4 }, { rating: 3 }], // avg 4 -> 4.0
      "listing-b": [{ rating: 5 }, { rating: 2 }], // avg 3.5
      "listing-c": [], // no reviews -> 0
    };

    // First image per listing
    const firstImageByListing: Record<string, { imageUrl: string }[]> = {
      "listing-a": [{ imageUrl: "https://example.com/a.jpg" }],
      "listing-b": [{ imageUrl: "https://example.com/b.jpg" }],
      "listing-c": [], // no image -> null
    };

    function installMocks() {
      // Listings base query: select().from(listings).where().orderBy()
      // Images query: select({...}).from(listingImages).where().limit(1)
      // We distinguish by looking at the first arg passed to `from`.
      const selectCalls: Array<"listings" | "images"> = [];
      let imageIdx = 0;

      vi.mocked(db.select).mockImplementation(((arg?: unknown) => {
        // When called with no args -> base listings select (current code uses .select())
        // When called with an object shape -> images select
        const isImages = arg !== undefined;
        selectCalls.push(isImages ? "images" : "listings");

        if (!isImages) {
          // listings chain: from().where().orderBy()
          return {
            from: () => ({
              where: () => ({
                orderBy: () => Promise.resolve(rawListings),
              }),
            }),
          } as any;
        }

        // images chain.
        // - Broken code: from().where().limit() once per listing.
        // - Refactored code: from().where() once, awaited directly (batched
        //   with inArray, returning {listingId, imageUrl} rows).
        return {
          from: () => ({
            where: () => {
              const batchedRows = rawListings.flatMap((l) => {
                const img = (firstImageByListing[l.id] ?? [])[0];
                return img ? [{ listingId: l.id, imageUrl: img.imageUrl }] : [];
              });
              // Thenable so `await db.select(...).from().where()` resolves
              // to the batched rows, while `.limit(1)` still works for the
              // old N+1 code path.
              return {
                then: (
                  resolve: (v: typeof batchedRows) => unknown,
                  reject?: (e: unknown) => unknown,
                ) => Promise.resolve(batchedRows).then(resolve, reject),
                limit: () => {
                  const listing = rawListings[imageIdx++];
                  return Promise.resolve(firstImageByListing[listing.id] ?? []);
                },
              };
            },
          }),
        } as any;
      }) as any);

      // Reviews: db.query.reviews.findMany is called once per listing in the
      // broken code, or once with inArray after the refactor. We detect batch
      // mode by looking at whether the caller requested the `listingId` column.
      let reviewsCallIdx = 0;
      vi.mocked(db.query.reviews.findMany).mockImplementation((async (
        opts: any,
      ) => {
        const wantsListingId = opts?.columns?.listingId === true;
        if (wantsListingId) {
          // Batched (refactored) call — return all reviews with listingId
          return rawListings.flatMap((l) =>
            (reviewsByListing[l.id] ?? []).map((r) => ({
              listingId: l.id,
              rating: r.rating,
            })),
          );
        }
        // N+1 (original) call — return per-listing slice in order
        const listing = rawListings[reviewsCallIdx++];
        return reviewsByListing[listing.id] ?? [];
      }) as any);
    }

    it("returns listings with computed rating, reviewCount, firstImageUrl and numeric rate fields", async () => {
      installMocks();

      const result = await listingDAL.getUserActiveListingsWithFilters(userId);

      expect(result).toHaveLength(3);

      // Listing A: 3 reviews, avg 4.0, has image
      expect(result[0]).toMatchObject({
        id: "listing-a",
        name: "Drill A",
        dailyRate: 15,
        weeklyRate: 90,
        monthlyRate: 300,
        securityDeposit: 50,
        deliveryFee: 10,
        setupFee: 25,
        averageRating: 4.0,
        reviewCount: 3,
        firstImageUrl: "https://example.com/a.jpg",
      });

      // Listing B: 2 reviews, avg 3.5, has image, null weekly/monthly
      expect(result[1]).toMatchObject({
        id: "listing-b",
        name: "Hammer B",
        dailyRate: 5.5,
        securityDeposit: 10,
        deliveryFee: 0,
        setupFee: 0,
        averageRating: 3.5,
        reviewCount: 2,
        firstImageUrl: "https://example.com/b.jpg",
      });
      expect(result[1].weeklyRate).toBeUndefined();
      expect(result[1].monthlyRate).toBeUndefined();

      // Listing C: 0 reviews, avg 0, no image (null)
      expect(result[2]).toMatchObject({
        id: "listing-c",
        name: "Saw C",
        dailyRate: 20,
        weeklyRate: 120,
        monthlyRate: 400,
        securityDeposit: 75,
        deliveryFee: 15,
        setupFee: 0,
        averageRating: 0,
        reviewCount: 0,
        firstImageUrl: null,
      });

      // Preserves pass-through columns from raw listing
      expect(result[0].ownerId).toBe(userId);
      expect(result[0].brand).toBe("DeWalt");
      expect(result[0].categoryId).toBe("power-tools");
      expect(result[0].isActive).toBe(true);
      expect(result[0].approvalStatus).toBe("approved");
      expect(result[0].status).toBe("available");
      expect(result[1].status).toBe("rented");
      expect(result[0].createdAt).toEqual(new Date("2024-01-15"));
    });
  });
});
