import { describe, it, expect, vi, beforeEach } from "vitest";
import { rentalDAL } from "../index";
import { ConflictError, DALError, NotFoundError } from "../errors";
import { mockRentalRequest, mockRentalDetails } from "@/test/fixtures/rentals";
import { db } from "@/db/db";

// Mock dependencies
vi.mock("@/features/auth/utils/session");
vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    query: {
      rentalRequests: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      rentals: {
        findFirst: vi.fn(),
      },
      listings: {
        findFirst: vi.fn(),
      },
      listingImages: {
        findMany: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      blindReviews: {
        findMany: vi.fn(),
      },
      userAddresses: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("RentalDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("insertRentalRequest", () => {
    const validPayload = {
      listingId: "listing-123",
      renterId: "user-456",
      ownerId: "user-123",
      startDate: new Date("2024-02-01"),
      endDate: new Date("2024-02-05"),
      totalDays: 5,
      dailyRate: "15.00",
      totalAmount: "78.50",
      securityDeposit: "50.00",
      deliveryRequested: false,
      deliveryAddress: null as string | null,
      deliveryInstructions: null as string | null,
      deliveryFee: "0",
      setupRequested: false,
      setupFee: "0",
      serviceFee: "3.50",
      applicationFeeAmount: "19.20",
      ownerPayout: "59.30",
      platformNetRevenue: "15.70",
      message: "I need this for a weekend project",
      paymentIntentId: null as string | null,
      paymentMethodId: "pm_test_123",
      status: "pending" as const,
    };

    it("should insert rental request and return id", async () => {
      const mockReturning = vi.fn().mockResolvedValue([mockRentalRequest]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      const result = await rentalDAL.insertRentalRequest(validPayload);

      expect(result).toEqual({ id: mockRentalRequest.id });
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: validPayload.listingId,
          renterId: validPayload.renterId,
          ownerId: validPayload.ownerId,
          totalDays: validPayload.totalDays,
          dailyRate: validPayload.dailyRate,
          totalAmount: validPayload.totalAmount,
          status: "pending",
        }),
      );
    });

    it("should pass through all payload fields to insert", async () => {
      const mockReturning = vi.fn().mockResolvedValue([mockRentalRequest]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      await rentalDAL.insertRentalRequest(validPayload);

      const inserted = mockValues.mock.calls[0]?.[0];
      expect(inserted).toBeDefined();
      expect(inserted.listingId).toBe(validPayload.listingId);
      expect(inserted.deliveryFee).toBe(validPayload.deliveryFee);
      expect(inserted.serviceFee).toBe(validPayload.serviceFee);
      expect(inserted.applicationFeeAmount).toBe(
        validPayload.applicationFeeAmount,
      );
      expect(inserted.ownerPayout).toBe(validPayload.ownerPayout);
      expect(inserted.platformNetRevenue).toBe(validPayload.platformNetRevenue);
      expect(inserted.paymentMethodId).toBe(validPayload.paymentMethodId);
    });
  });

  describe("getBorrowedListings", () => {
    it("should return borrowed listings when user is authenticated", async () => {
      // Arrange
      const userId = "user-456";

      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: "rental-123",
          listingId: "listing-123",
          listingName: "Test Drill",
          ownerId: "user-123",
          ownerName: "John Doe",
          deliveryRequested: false,
          startDate: new Date("2024-02-01"),
          endDate: new Date("2024-02-05"),
          totalAmount: "60.00",
          status: "approved",
          dailyRate: "15.00",
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockInnerJoin2 = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });

      // Mock select().from().where().orderBy() for images (batched query)
      const mockOrderByImage = vi.fn().mockResolvedValue([
        {
          listingId: "listing-123",
          imageUrl: "https://example.com/image.jpg",
        },
      ]);
      const mockWhereImage = vi.fn().mockReturnValue({
        orderBy: mockOrderByImage,
      });
      const mockFromImage = vi.fn().mockReturnValue({
        where: mockWhereImage,
      });

      // Mock select to return different chains based on call
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is for rentals
          return { from: mockFrom } as any;
        } else {
          // Subsequent calls are for images
          return { from: mockFromImage } as any;
        }
      });

      // Act
      const result = await rentalDAL.getBorrowedListings(userId);

      // Assert
      expect(result).toHaveProperty("currentRentals");
      expect(result).toHaveProperty("upcomingRentals");
    });

    it("should return the exact expected shape for multiple listings with multiple images (characterization)", async () => {
      // Arrange
      const userId = "user-456";
      const now = new Date();
      const past = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2); // 2 days ago
      const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5); // 5 days out
      const farFuture = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 10);

      const rentalsRows = [
        {
          id: "rental-1",
          listingId: "listing-A",
          listingName: "Listing A",
          ownerId: "owner-1",
          ownerName: "Alice Owner",
          deliveryRequested: false,
          setupRequested: false,
          startDate: past,
          endDate: future,
          totalAmount: "100.00",
          status: "active",
          dailyRate: "10.00",
        },
        {
          id: "rental-2",
          listingId: "listing-B",
          listingName: "Listing B",
          ownerId: "owner-2",
          ownerName: "Bob Owner",
          deliveryRequested: true,
          setupRequested: false,
          startDate: future,
          endDate: farFuture,
          totalAmount: "200.00",
          status: "approved",
          dailyRate: "20.00",
        },
        {
          id: "rental-3",
          listingId: "listing-C",
          listingName: "Listing C",
          ownerId: "owner-3",
          ownerName: "Carol Owner",
          deliveryRequested: false,
          setupRequested: true,
          startDate: future,
          endDate: farFuture,
          totalAmount: "300.00",
          status: "approved",
          dailyRate: "30.00",
        },
      ];

      // Rentals select chain
      const mockOrderByRentals = vi.fn().mockResolvedValue(rentalsRows);
      const mockWhereRentals = vi
        .fn()
        .mockReturnValue({ orderBy: mockOrderByRentals });
      const mockInnerJoin2 = vi
        .fn()
        .mockReturnValue({ where: mockWhereRentals });
      const mockInnerJoin1 = vi
        .fn()
        .mockReturnValue({ innerJoin: mockInnerJoin2 });
      const mockFromRentals = vi
        .fn()
        .mockReturnValue({ innerJoin: mockInnerJoin1 });

      // Image rows: each listing has multiple images. First (min orderIndex) wins.
      // Support BOTH shapes:
      //   old (per-listing): .where().orderBy().limit() resolves to [{ imageUrl }]
      //   new (batched):     .where().orderBy() resolves to [{ listingId, imageUrl }, ...]
      const imagesByListing: Record<
        string,
        { imageUrl: string; orderIndex: number }[]
      > = {
        "listing-A": [
          { imageUrl: "https://img/A-0.jpg", orderIndex: 0 },
          { imageUrl: "https://img/A-1.jpg", orderIndex: 1 },
        ],
        "listing-B": [
          { imageUrl: "https://img/B-1.jpg", orderIndex: 1 },
          { imageUrl: "https://img/B-2.jpg", orderIndex: 2 },
        ],
        "listing-C": [
          { imageUrl: "https://img/C-0.jpg", orderIndex: 0 },
          { imageUrl: "https://img/C-3.jpg", orderIndex: 3 },
        ],
      };

      const batchedImageRows = Object.entries(imagesByListing)
        .flatMap(([listingId, imgs]) =>
          imgs.map((i) => ({
            listingId,
            imageUrl: i.imageUrl,
            orderIndex: i.orderIndex,
          })),
        )
        .sort(
          (a, b) =>
            a.listingId.localeCompare(b.listingId) ||
            a.orderIndex - b.orderIndex,
        )
        .map(({ listingId, imageUrl }) => ({ listingId, imageUrl }));

      // Per-listing chain (current code path)
      let perListingCallIndex = 0;
      const makePerListingChain = () => {
        const listingOrder = ["listing-A", "listing-B", "listing-C"];
        const mockLimit = vi.fn().mockImplementation(() => {
          const lid = listingOrder[perListingCallIndex++];
          const imgs = imagesByListing[lid] ?? [];
          const sorted = [...imgs].sort((a, b) => a.orderIndex - b.orderIndex);
          return Promise.resolve(
            sorted[0] ? [{ imageUrl: sorted[0].imageUrl }] : [],
          );
        });
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
      };

      // Batched chain (future code path)
      const makeBatchedChain = () => {
        const mockOrderBy = vi.fn().mockResolvedValue(batchedImageRows);
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
      };

      let selectCall = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: mockFromRentals } as any;
        // Return an object that works for BOTH the old per-listing chain
        // and the new batched chain. We do that by returning a chain where
        // .from().where().orderBy() resolves to batchedImageRows AND
        // .from().where().orderBy().limit() resolves to the per-listing
        // first image.
        const listingOrder = ["listing-A", "listing-B", "listing-C"];
        const mockLimit = vi.fn().mockImplementation(() => {
          const lid = listingOrder[perListingCallIndex++];
          const imgs = imagesByListing[lid] ?? [];
          const sorted = [...imgs].sort((a, b) => a.orderIndex - b.orderIndex);
          return Promise.resolve(
            sorted[0] ? [{ imageUrl: sorted[0].imageUrl }] : [],
          );
        });
        // orderBy: thenable (for batched) with .limit (for per-listing)
        const mockOrderBy: any = vi.fn().mockImplementation(() => {
          const p: any = Promise.resolve(batchedImageRows);
          p.limit = mockLimit;
          return p;
        });
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        return { from: vi.fn().mockReturnValue({ where: mockWhere }) } as any;
      });
      // silence unused warning
      void makePerListingChain;
      void makeBatchedChain;

      // Act
      const result = await rentalDAL.getBorrowedListings(userId);

      // Assert exact shape (byte-identical contract)
      expect(result).toEqual({
        currentRentals: [
          {
            id: "rental-1",
            listingId: "listing-A",
            listingName: "Listing A",
            ownerId: "owner-1",
            ownerName: "Alice Owner",
            deliveryRequested: false,
            setupRequested: false,
            startDate: past,
            endDate: future,
            totalAmount: "100.00",
            status: "active",
            dailyRate: "10.00",
            listingImageUrl: "https://img/A-0.jpg",
          },
        ],
        upcomingRentals: [
          {
            id: "rental-2",
            listingId: "listing-B",
            listingName: "Listing B",
            ownerId: "owner-2",
            ownerName: "Bob Owner",
            deliveryRequested: true,
            setupRequested: false,
            startDate: future,
            endDate: farFuture,
            totalAmount: "200.00",
            status: "approved",
            dailyRate: "20.00",
            listingImageUrl: "https://img/B-1.jpg",
          },
          {
            id: "rental-3",
            listingId: "listing-C",
            listingName: "Listing C",
            ownerId: "owner-3",
            ownerName: "Carol Owner",
            deliveryRequested: false,
            setupRequested: true,
            startDate: future,
            endDate: farFuture,
            totalAmount: "300.00",
            status: "approved",
            dailyRate: "30.00",
            listingImageUrl: "https://img/C-0.jpg",
          },
        ],
      });
    });
  });

  describe("approveRentalRequest", () => {
    it("should approve rental request when user is owner", async () => {
      // Arrange
      const requestId = "rental-request-123";
      const ownerId = "user-123";

      vi.mocked(db.query.rentalRequests.findFirst).mockResolvedValue({
        ...mockRentalRequest,
        ownerId: ownerId,
        status: "pending",
      } as any);

      // Mock select().from().where().limit() chain for rental request check
      const mockLimit = vi.fn().mockResolvedValue([mockRentalRequest]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });

      // Mock select().from().where() chain for conflict check
      const mockWhereConflict = vi.fn().mockResolvedValue([]);
      const mockFromConflict = vi.fn().mockReturnValue({
        where: mockWhereConflict,
      });

      // Mock select to return different chains based on call
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call is for rental request check
          return { from: mockFromSelect } as any;
        } else {
          // Subsequent calls are for conflict checks
          return { from: mockFromConflict } as any;
        }
      });

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockRentalRequest, status: "approved" }]);
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
      await rentalDAL.approveRentalRequest(requestId, ownerId);

      // Assert
      // approveRentalRequest returns void, so we just check it completes without error
      expect(db.update).toHaveBeenCalled();
    });

    it("should throw NotFoundError when request not found", async () => {
      // Arrange
      const requestId = "non-existent-request";
      const ownerId = "user-123";

      // Mock select().from().where().limit() chain returning empty
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      // Act & Assert
      await expect(
        rentalDAL.approveRentalRequest(requestId, ownerId),
      ).rejects.toThrow(NotFoundError);
    });

    it("should check for date conflicts before approving", async () => {
      // Arrange
      const requestId = "rental-request-123";
      const ownerId = "user-123";

      // Mock select().from().where().limit() chain for rental request check
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          ownerId: ownerId,
          status: "pending",
        },
      ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      // Mock update and insert for approval
      const mockReturning = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          status: "approved",
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      const mockInsertReturning = vi
        .fn()
        .mockResolvedValue([{ id: "rental-123" }]);
      const mockInsertValues = vi.fn().mockReturnValue({
        returning: mockInsertReturning,
      });
      vi.mocked(db.insert).mockReturnValue({
        values: mockInsertValues,
      } as any);

      // Note: Date conflict checking is not currently implemented in approveRentalRequest
      // This test verifies that approval succeeds even with potential conflicts
      // TODO: When conflict checking is implemented, update this test to expect rejection

      // Act
      await rentalDAL.approveRentalRequest(requestId, ownerId);

      // Assert
      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it("should throw when request status is not pending", async () => {
      const requestId = "rental-request-123";
      const ownerId = "user-123";
      const mockLimit = vi
        .fn()
        .mockResolvedValue([
          { ...mockRentalRequest, ownerId, status: "approved" },
        ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      await expect(
        rentalDAL.approveRentalRequest(requestId, ownerId),
      ).rejects.toThrow(/only pending requests can be approved/i);
    });
  });

  describe("declineRentalRequest", () => {
    it("should decline rental request when user is owner", async () => {
      // Arrange
      const requestId = "rental-request-123";
      const ownerId = "user-123";
      const reason = "Not available";

      // Mock select().from() chain
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      // Mock select().from().where().limit() chain
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          ownerId: ownerId,
          status: "pending",
        },
      ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([
          { ...mockRentalRequest, status: "denied", denialReason: reason },
        ]);
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
      await rentalDAL.declineRentalRequest(requestId, reason, ownerId);

      // Assert
      expect(db.update).toHaveBeenCalled();
    });

    it("should throw NotFoundError when request not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.declineRentalRequest("non-existent", "reason", "owner-1"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw when request status is not pending", async () => {
      const mockLimit = vi
        .fn()
        .mockResolvedValue([{ ...mockRentalRequest, status: "approved" }]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.declineRentalRequest("req-1", "Not available", "owner-1"),
      ).rejects.toThrow(/only pending requests can be declined/i);
    });
  });

  describe("cancelRentalRequest", () => {
    it("should cancel rental request when user is renter", async () => {
      // Arrange
      const requestId = "rental-request-123";
      const userId = "user-456"; // Renter

      // Mock select().from().where().limit() chain
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          renterId: userId,
          status: "pending",
        },
      ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockRentalRequest, status: "cancelled" }]);
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
      await rentalDAL.cancelRentalRequest(requestId, userId);

      // Assert
      expect(db.update).toHaveBeenCalled();
    });

    it("should cancel rental request when user is renter", async () => {
      // Arrange
      const requestId = "rental-request-123";
      const userId = "user-456";

      // Mock select().from().where().limit() chain
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          renterId: userId, // Same renter
        },
      ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockRentalRequest, status: "cancelled" }]);
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
      await rentalDAL.cancelRentalRequest(requestId, userId);

      // Assert
      expect(db.update).toHaveBeenCalled();
    });

    it("should not allow cancellation of approved/active rentals", async () => {
      // Arrange
      const requestId = "rental-request-123";
      const userId = "user-456";

      // Mock select().from().where().limit() chain
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          renterId: userId,
          status: "approved", // Cannot cancel approved
        },
      ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      // Act & Assert
      await expect(
        rentalDAL.cancelRentalRequest(requestId, userId),
      ).rejects.toThrow();
    });

    it("should throw NotFoundError when rental request not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.cancelRentalRequest("non-existent", "user-456"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getRentalDetailsById", () => {
    it("should return rental details when found", async () => {
      // Arrange
      const rentalId = "rental-123";
      const userId = "user-123";

      // The test mocks are complex because getRentalDetailsById makes many queries.
      // Instead, we'll verify the method throws NotFoundError when not found,
      // and test the positive case by mocking all the queries in sequence.

      // Mock select().from().leftJoin().leftJoin().where().limit() chain for rental request
      const mockRentalRequestData = {
        ...mockRentalDetails,
        id: rentalId,
        renterId: "user-456",
        ownerId: userId,
        listingId: "listing-123",
        status: "pending",
      };

      // Build the chain for the first query (rental requests with left joins)
      const mockLimit1 = vi.fn().mockResolvedValue([mockRentalRequestData]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockLeftJoin3 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin2 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin3 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      // Build the chain for listing images query
      const mockLimit2 = vi
        .fn()
        .mockResolvedValue([{ imageUrl: "https://example.com/image.jpg" }]);
      const mockOrderBy2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      // Build the chain for completed rentals query
      const mockWhere3 = vi.fn().mockResolvedValue([]);
      const mockFrom3 = vi.fn().mockReturnValue({ where: mockWhere3 });

      // Build the chain for rental record check (for review status)
      const mockLimit4 = vi
        .fn()
        .mockResolvedValue([
          { id: "rental-record-123", damageReported: false },
        ]);
      const mockWhere4 = vi.fn().mockReturnValue({ limit: mockLimit4 });
      const mockFrom4 = vi.fn().mockReturnValue({ where: mockWhere4 });

      // Mock select to handle multiple calls in sequence
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockFrom1 } as any; // Rental request query
        } else if (selectCallCount === 2) {
          return { from: mockFrom2 } as any; // Listing image query
        } else if (selectCallCount === 3) {
          return { from: mockFrom3 } as any; // Completed rentals query
        } else {
          return { from: mockFrom4 } as any; // Rental record check
        }
      });

      // Mock other queries using db.query
      vi.mocked(db.query.listings.findFirst).mockResolvedValue({
        id: "listing-123",
        name: "Test Listing",
        description: "Test description",
        brand: "TestBrand",
        model: "TestModel",
        condition: "good",
      } as any);
      vi.mocked(db.query.user.findFirst)
        .mockResolvedValueOnce({
          id: "user-456",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: new Date(),
        } as any) // Renter
        .mockResolvedValueOnce({
          id: userId,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          emailVerified: true,
          createdAt: new Date(),
        } as any); // Owner
      vi.mocked(db.query.blindReviews.findMany).mockResolvedValue([]);
      vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue(undefined);

      // Act
      const result = await rentalDAL.getRentalDetailsById(rentalId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(rentalId);
    });

    it("should throw NotFoundError when rental not found", async () => {
      // Arrange
      const rentalId = "non-existent-rental";

      // Mock select().from().leftJoin().leftJoin().leftJoin().where().limit() chain returning empty for rentalRequests query
      const mockLimit1 = vi.fn().mockResolvedValue([]);
      const mockWhere1 = vi.fn().mockReturnValue({
        limit: mockLimit1,
      });
      const mockLeftJoin3_1 = vi.fn().mockReturnValue({
        where: mockWhere1,
      });
      const mockLeftJoin2_1 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin3_1,
      });
      const mockLeftJoin1_1 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin2_1,
      });
      const mockFrom1 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin1_1,
      });

      // Mock select().from().leftJoin().leftJoin().where().limit() chain returning empty for rentals query
      // This is the fallback query when rentalRequests query returns empty
      const mockLimit2 = vi.fn().mockResolvedValue([]);
      const mockWhere2 = vi.fn().mockReturnValue({
        limit: mockLimit2,
      });
      const mockLeftJoin2_2 = vi.fn().mockReturnValue({
        where: mockWhere2,
      });
      const mockLeftJoin1_2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin2_2,
      });
      const mockFrom2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin1_2,
      });

      // Mock select to handle multiple calls
      // getRentalDetailsById first queries rentalRequests, then if empty, queries rentals
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockFrom1 } as any; // Rental request query (returns empty)
        } else {
          return { from: mockFrom2 } as any; // Rental query (also returns empty, triggers NotFoundError)
        }
      });

      // Act & Assert
      await expect(rentalDAL.getRentalDetailsById(rentalId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should return type rental when found by rentals.id path", async () => {
      const rentalId = "rental-uuid-1";
      const rentalRow = {
        id: rentalId,
        requestId: "req-1",
        listingId: "listing-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-02-05"),
        actualStartDate: new Date("2024-02-01"),
        actualEndDate: null,
        totalAmount: "100",
        securityDeposit: "50",
        pickupInstructions: null,
        returnInstructions: null,
        conditionAtPickup: null,
        conditionAtReturn: null,
        damageReported: false,
        damageDescription: null,
        damagePhotos: null,
        extensionRequested: false,
        extensionApproved: false,
        createdAt: new Date(),
        conversationId: null,
      };
      const requestRow = [
        {
          totalDays: 4,
          dailyRate: "25",
          deliveryRequested: false,
          deliveryAddress: null,
          deliveryFee: "0",
          setupRequested: false,
          setupFee: "0",
          message: null,
          status: "completed",
        },
      ];
      const mockLimit1 = vi.fn().mockResolvedValue([]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockLeftJoin3_first = vi.fn().mockReturnValue({
        where: mockWhere1,
      });
      const mockLeftJoin2_first = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin3_first,
      });
      const mockLeftJoin1_first = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin2_first,
      });
      const mockFrom1 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin1_first,
      });
      const mockLimit2 = vi.fn().mockResolvedValue([rentalRow]);
      const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockLeftJoin2_second = vi.fn().mockReturnValue({
        where: mockWhere2,
      });
      const mockLeftJoin1_second = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin2_second,
      });
      const mockFrom2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin1_second,
      });
      const mockLimit3 = vi.fn().mockResolvedValue(requestRow);
      const mockWhere3 = vi.fn().mockReturnValue({ limit: mockLimit3 });
      const mockFrom3 = vi.fn().mockReturnValue({ where: mockWhere3 });
      const mockLimit4 = vi
        .fn()
        .mockResolvedValue([{ imageUrl: "https://example.com/img.jpg" }]);
      const mockOrderBy4 = vi.fn().mockReturnValue({ limit: mockLimit4 });
      const mockWhere4 = vi.fn().mockReturnValue({ orderBy: mockOrderBy4 });
      const mockFrom4 = vi.fn().mockReturnValue({ where: mockWhere4 });
      const mockWhere5 = vi.fn().mockResolvedValue([]);
      const mockFrom5 = vi.fn().mockReturnValue({ where: mockWhere5 });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return { from: mockFrom1 } as any;
        if (selectCallCount === 2) return { from: mockFrom2 } as any;
        if (selectCallCount === 3) return { from: mockFrom3 } as any;
        if (selectCallCount === 4) return { from: mockFrom4 } as any;
        return { from: mockFrom5 } as any;
      });
      vi.mocked(db.query.listings.findFirst).mockResolvedValue({
        id: "listing-1",
        name: "Test Listing",
        brand: "Brand",
        model: "Model",
        condition: "good",
      } as any);
      vi.mocked(db.query.user.findFirst)
        .mockResolvedValueOnce({
          id: "renter-1",
          firstName: "Jane",
          lastName: "Renter",
          email: "j@example.com",
          createdAt: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: "owner-1",
          firstName: "John",
          lastName: "Owner",
          email: "o@example.com",
          createdAt: new Date(),
        } as any);
      vi.mocked(db.query.blindReviews.findMany).mockResolvedValue([]);
      vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue(undefined);

      const result = await rentalDAL.getRentalDetailsById(rentalId);

      expect(result.type).toBe("rental");
      expect(result.id).toBe(rentalId);
      expect(result.listingName).toBe("Test Listing");
    });
  });

  describe("startRental", () => {
    it("should start rental when user is owner", async () => {
      // Arrange
      const rentalId = "rental-123";
      const userId = "user-123";

      // Mock select().from().where().limit() chain
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          ownerId: userId,
          status: "approved",
        },
      ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockRentalDetails, status: "active" }]);
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
      const result = await rentalDAL.startRental(rentalId, userId);

      // Assert
      expect(result).toBeDefined();
    });

    /**
     * Requirements: mobile Req 10.2.1
     * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md (P-E8A-6)
     *
     * The guard this method's own docblock has promised since it was written.
     * `startDate` was selected for it and then never read, so an owner could
     * mark a rental active weeks early — starting the renter's period and
     * flipping the listing to `rented` before anyone had the item.
     */
    const arrangeStart = (startDate: Date) => {
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          ownerId: "user-123",
          status: "approved",
          startDate,
        },
      ]);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: mockLimit }),
        }),
      } as any);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ ...mockRentalDetails, status: "active" }]),
        }),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);
      return mockSet;
    };

    const daysFromNow = (offset: number) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return date;
    };

    it("refuses to start before the start date (Req 10.2.1)", async () => {
      arrangeStart(daysFromNow(3));

      await expect(
        rentalDAL.startRental("rental-123", "user-123"),
      ).rejects.toThrow(/before its start date/i);
    });

    // A rental starting TODAY carries a midnight startDate, already behind
    // `now` by the time anyone taps anything — an instant comparison would be
    // correct at 00:00 and wrong for the rest of the day.
    it("allows a start on the start date itself, whatever the time", async () => {
      arrangeStart(new Date(new Date().setHours(0, 0, 0, 0)));

      await expect(
        rentalDAL.startRental("rental-123", "user-123"),
      ).resolves.toBeDefined();
    });

    // Not hypothetical: the WEB client submits a `Date` from its picker, so
    // `startDate` is stored at whatever UTC time local midnight mapped to —
    // 05:00 for US Central, say. An instant comparison would then refuse a
    // same-day start until 05:00 on the morning of the rental, which is exactly
    // when an owner is handing the item over.
    it("allows a start on a start date that is not midnight-normalized", async () => {
      const today = new Date();
      today.setHours(23, 30, 0, 0);
      arrangeStart(today);

      await expect(
        rentalDAL.startRental("rental-123", "user-123"),
      ).resolves.toBeDefined();
    });

    it("allows a late start", async () => {
      arrangeStart(daysFromNow(-2));

      await expect(
        rentalDAL.startRental("rental-123", "user-123"),
      ).resolves.toBeDefined();
    });

    it("records the pickup condition when one is given", async () => {
      const mockSet = arrangeStart(daysFromNow(-1));

      await rentalDAL.startRental("rental-123", "user-123", {
        conditionAtPickup: "Scuff on the handle, works fine.",
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionAtPickup: "Scuff on the handle, works fine.",
        }),
      );
    });

    // An owner handing over a ladder in obvious condition should not be forced
    // to type a paragraph about it — and an absent note must not blank a stored
    // one.
    it("leaves the column alone when no condition is given", async () => {
      const mockSet = arrangeStart(daysFromNow(-1));

      await rentalDAL.startRental("rental-123", "user-123");

      const rentalUpdate = mockSet.mock.calls.find((call) =>
        Object.prototype.hasOwnProperty.call(call[0], "actualStartDate"),
      );
      expect(rentalUpdate?.[0]).not.toHaveProperty("conditionAtPickup");
    });

    it("should throw NotFoundError when request not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.startRental("non-existent", "user-123"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw when status is not approved", async () => {
      const mockLimit = vi
        .fn()
        .mockResolvedValue([
          { ...mockRentalRequest, ownerId: "user-123", status: "pending" },
        ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.startRental("rental-123", "user-123"),
      ).rejects.toThrow(/only approved rentals can be started/i);
    });
  });

  describe("endRental", () => {
    it("should end rental when user is owner", async () => {
      // Arrange
      const rentalId = "rental-123";
      const userId = "user-123";

      // Mock select().from().where().limit() chain
      const mockLimit = vi.fn().mockResolvedValue([
        {
          ...mockRentalRequest,
          ownerId: userId,
          status: "active",
        },
      ]);
      const mockWhereSelect = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFromSelect = vi.fn().mockReturnValue({
        where: mockWhereSelect,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFromSelect,
      } as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ ...mockRentalDetails, status: "completed" }]);
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
      const result = await rentalDAL.endRental(rentalId, userId);

      // Assert
      expect(result).toBeDefined();
    });

    it("should throw NotFoundError when request not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.endRental("non-existent", "user-123"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw when status is not active", async () => {
      const mockLimit = vi
        .fn()
        .mockResolvedValue([
          { ...mockRentalRequest, ownerId: "user-123", status: "approved" },
        ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.endRental("rental-123", "user-123"),
      ).rejects.toThrow(/only active rentals can be ended/i);
    });

    /** UAT-P1-26: duplicate return confirmation — 409 Conflict; no DB updates. */
    it("should throw ConflictError when rental is already completed (return already confirmed)", async () => {
      vi.clearAllMocks();

      const mockLimit = vi
        .fn()
        .mockResolvedValue([
          { ...mockRentalRequest, ownerId: "user-123", status: "completed" },
        ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.endRental("rental-123", "user-123"),
      ).rejects.toThrow(ConflictError);

      expect(vi.mocked(db.update)).not.toHaveBeenCalled();
    });
  });

  describe("getOverdueItemsForUser", () => {
    const userId = "user-123";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    it("should return overdue items for user as borrower or owner", async () => {
      const overdueRows = [
        {
          id: "req-1",
          listingName: "Power Drill",
          renterId: "renter-1",
          ownerName: "Jane Owner",
          endDate: (() => {
            const d = new Date(today);
            d.setDate(d.getDate() - 3);
            return d;
          })(),
        },
      ];
      const renterNameRows = [{ id: "renter-1", name: "Bob Renter" }];

      const mockOrderBy = vi.fn().mockResolvedValue(overdueRows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });

      const mockWhereUser = vi.fn().mockResolvedValue(renterNameRows);
      const mockFromUser = vi.fn().mockReturnValue({ where: mockWhereUser });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockFrom } as any;
        }
        return { from: mockFromUser } as any;
      });

      const result = await rentalDAL.getOverdueItemsForUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "req-1",
        listingName: "Power Drill",
        statusText: "3 days late",
        linkTo: expect.stringContaining("/dashboard/rental/req-1"),
      });
    });

    it("should return empty array when no overdue items", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.getOverdueItemsForUser(userId);

      expect(result).toEqual([]);
    });

    it("should return overdue items for user as owner with renter name and lending link", async () => {
      const ownerId = "user-123";
      const overdueRows = [
        {
          id: "req-2",
          listingName: "Saw",
          renterId: "renter-2",
          ownerName: "Jane Owner",
          endDate: (() => {
            const d = new Date(today);
            d.setDate(d.getDate() - 2);
            return d;
          })(),
        },
      ];
      const renterNameRows = [{ id: "renter-2", name: "Alice Renter" }];
      const mockOrderBy = vi.fn().mockResolvedValue(overdueRows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
      const mockWhereUser = vi.fn().mockResolvedValue(renterNameRows);
      const mockFromUser = vi.fn().mockReturnValue({ where: mockWhereUser });
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1
          ? ({ from: mockFrom } as any)
          : ({ from: mockFromUser } as any);
      });
      const result = await rentalDAL.getOverdueItemsForUser(ownerId);
      expect(result).toHaveLength(1);
      expect(result[0].otherPartyName).toBe("Alice Renter");
      expect(result[0].linkTo).toContain("view=lending");
    });
  });

  describe("countBorrowedListings", () => {
    it("should return count of active rentals for renter", async () => {
      const userId = "user-456";
      const mockWhere = vi.fn().mockResolvedValue([{}, {}, {}]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.countBorrowedListings(userId);

      expect(result).toBe(3);
    });

    it("should return 0 when no active rentals", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.countBorrowedListings("user-456");

      expect(result).toBe(0);
    });
  });

  describe("countSharedListings", () => {
    it("should return count of active rentals for owner", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{}, {}]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.countSharedListings("owner-123");

      expect(result).toBe(2);
    });
  });

  describe("getRentalRequestById", () => {
    it("should return rental request with listing image", async () => {
      const requestId = "req-123";
      const requestRow = {
        ...mockRentalRequest,
        id: requestId,
        listingId: "listing-123",
      };
      const mockLimit1 = vi.fn().mockResolvedValue([requestRow]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      const mockLimit2 = vi
        .fn()
        .mockResolvedValue([{ imageUrl: "https://example.com/img.jpg" }]);
      const mockOrderBy2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1
          ? ({ from: mockFrom1 } as any)
          : ({ from: mockFrom2 } as any);
      });

      const result = await rentalDAL.getRentalRequestById(requestId);

      expect(result).toBeDefined();
      expect(result.id).toBe(requestId);
      expect(result.listingImageUrl).toBe("https://example.com/img.jpg");
    });

    it("should throw NotFoundError when request not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.getRentalRequestById("non-existent"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getApprovedRentalCountForRenter", () => {
    it("should throw DALError when db select fails", async () => {
      const mockWhere = vi
        .fn()
        .mockRejectedValue(new Error("Connection refused"));
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.getApprovedRentalCountForRenter("renter-1"),
      ).rejects.toThrow(DALError);
    });

    it("should return count of approved/active/completed for renter", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ count: 5 }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result =
        await rentalDAL.getApprovedRentalCountForRenter("renter-1");

      expect(result).toBe(5);
    });

    it("should return 0 when result is empty or count undefined", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result =
        await rentalDAL.getApprovedRentalCountForRenter("renter-1");

      expect(result).toBe(0);
    });
  });

  describe("getRentalRequestsByStatus", () => {
    it("should return requests with listing images for status", async () => {
      const rows = [
        {
          ...mockRentalRequest,
          id: "req-1",
          listingId: "listing-1",
        },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      const mockOrderByImg = vi
        .fn()
        .mockResolvedValue([
          { listingId: "listing-1", imageUrl: "https://example.com/1.jpg" },
        ]);
      const mockWhereImg = vi.fn().mockReturnValue({
        orderBy: mockOrderByImg,
      });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhereImg });

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? ({ from: mockFrom1 } as any)
          : ({ from: mockFrom2 } as any);
      });

      const result = await rentalDAL.getRentalRequestsByStatus(
        "pending",
        "renter-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].listingImageUrl).toBe("https://example.com/1.jpg");
    });
  });

  describe("getLendingRequestsByStatus", () => {
    it("should return lending requests with renterName and image", async () => {
      const rows = [
        {
          id: "req-1",
          listingId: "listing-1",
          listingName: "Drill",
          renterId: "r-1",
          renterName: "Jane Renter",
          startDate: new Date(),
          endDate: new Date(),
          totalDays: 2,
          dailyRate: "10",
          totalAmount: "20",
          securityDeposit: "50",
          status: "pending",
          createdAt: new Date(),
          deliveryRequested: false,
          deliveryAddress: null,
          deliveryFee: "0",
          setupRequested: false,
          setupFee: null,
          message: null,
          deniedAt: null,
          denialReason: null,
          approvedAt: null,
          conversationId: null,
        },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      const mockOrderByImg = vi
        .fn()
        .mockResolvedValue([
          { listingId: "listing-1", imageUrl: "https://example.com/img.jpg" },
        ]);
      const mockWhereImg = vi.fn().mockReturnValue({
        orderBy: mockOrderByImg,
      });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhereImg });

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? ({ from: mockFrom1 } as any)
          : ({ from: mockFrom2 } as any);
      });

      const result = await rentalDAL.getLendingRequestsByStatus(
        "pending",
        "owner-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].renterName).toBe("Jane Renter");
      expect(result[0].listingImageUrl).toBe("https://example.com/img.jpg");
    });
  });

  describe("getRentalsPerMonth", () => {
    it("should return rentals per month with renterCount and ownerCount", async () => {
      const now = new Date();
      const rows = [
        {
          startDate: new Date(now.getFullYear(), now.getMonth(), 15),
          renterId: "user-1",
          ownerId: "user-2",
        },
      ];
      const mockWhere = vi.fn().mockResolvedValue(rows);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.getRentalsPerMonth("user-1", 6);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(6);
      result.forEach((item) => {
        expect(item).toHaveProperty("year");
        expect(item).toHaveProperty("month");
        expect(item).toHaveProperty("monthLabel");
        expect(item).toHaveProperty("renterCount");
        expect(item).toHaveProperty("ownerCount");
      });
    });
  });

  describe("getRecentRentalActivity", () => {
    it("should return activity with role and linkTo", async () => {
      const rows = [
        {
          id: "req-1",
          listingName: "Drill",
          renterId: "renter-1",
          ownerId: "owner-1",
          status: "approved",
          updatedAt: new Date(),
        },
      ];
      const mockLimit = vi.fn().mockResolvedValue(rows);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.getRecentRentalActivity("renter-1", 5);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("renter");
      expect(result[0].linkTo).toContain("view=renting");
    });
  });

  describe("getRentalsByStatus", () => {
    it("should return borrowed listings by status with image", async () => {
      const rows = [
        {
          id: "req-1",
          listingId: "listing-1",
          listingName: "Drill",
          ownerId: "owner-1",
          ownerName: "Owner",
          startDate: new Date(),
          endDate: new Date(),
          totalAmount: "50",
          status: "approved",
          dailyRate: "10",
          deliveryRequested: false,
          setupRequested: false,
          setupFee: null,
          conversationId: null,
        },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      const mockOrderByImg = vi
        .fn()
        .mockResolvedValue([
          { listingId: "listing-1", imageUrl: "https://example.com/img.jpg" },
        ]);
      const mockWhereImg = vi.fn().mockReturnValue({
        orderBy: mockOrderByImg,
      });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhereImg });

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? ({ from: mockFrom1 } as any)
          : ({ from: mockFrom2 } as any);
      });

      const result = await rentalDAL.getRentalsByStatus("approved", "renter-1");

      expect(result).toHaveLength(1);
      expect(result[0].listingImageUrl).toBe("https://example.com/img.jpg");
    });
  });

  describe("getLendingRentalsByStatus", () => {
    it("should return lending rentals with image", async () => {
      const rows = [
        {
          id: "req-1",
          listingId: "listing-1",
          listingName: "Drill",
          renterId: "r-1",
          renterName: "Renter",
          startDate: new Date(),
          endDate: new Date(),
          totalDays: 2,
          dailyRate: "10",
          totalAmount: "20",
          securityDeposit: "50",
          status: "pending",
          createdAt: new Date(),
          deliveryRequested: false,
          deliveryAddress: null,
          deliveryFee: "0",
          setupRequested: false,
          setupFee: null,
          message: null,
          deniedAt: null,
          denialReason: null,
          approvedAt: null,
          conversationId: null,
        },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin2 = vi.fn().mockReturnValue({
        leftJoin: mockLeftJoin,
      });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      const mockOrderByImg = vi
        .fn()
        .mockResolvedValue([
          { listingId: "listing-1", imageUrl: "https://example.com/img.jpg" },
        ]);
      const mockWhereImg = vi.fn().mockReturnValue({
        orderBy: mockOrderByImg,
      });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhereImg });

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? ({ from: mockFrom1 } as any)
          : ({ from: mockFrom2 } as any);
      });

      const result = await rentalDAL.getLendingRentalsByStatus(
        "pending",
        "owner-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].listingImageUrl).toBe("https://example.com/img.jpg");
    });
  });

  describe("updateRentalRequestPaymentStatus", () => {
    it("should throw DALError when db update fails", async () => {
      const mockWhere = vi
        .fn()
        .mockRejectedValue(new Error("Connection refused"));
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await expect(
        rentalDAL.updateRentalRequestPaymentStatus("req-1", {
          paymentStatus: "succeeded",
        }),
      ).rejects.toThrow(DALError);
    });

    it("should update payment status and call db.update", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await rentalDAL.updateRentalRequestPaymentStatus("req-1", {
        paymentStatus: "succeeded",
        paymentIntentId: "pi_123",
      });

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: "succeeded",
          paymentIntentId: "pi_123",
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe("updateRentalInstructions", () => {
    it("should update instructions and return rental and user details", async () => {
      const rentalRequest = {
        id: "req-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        listingId: "listing-1",
        status: "approved",
      };
      const mockLimit1 = vi.fn().mockResolvedValue([rentalRequest]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockWhereUpdate = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      const renterUser = {
        email: "renter@example.com",
        firstName: "Renter",
        lastName: "User",
      };
      const ownerUser = { firstName: "Owner", lastName: "User" };
      const listing = { name: "Test Listing" };
      const mockLimit2 = vi.fn().mockResolvedValue([renterUser]);
      const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockLimit3 = vi.fn().mockResolvedValue([ownerUser]);
      const mockWhere3 = vi.fn().mockReturnValue({ limit: mockLimit3 });
      const mockFrom3 = vi.fn().mockReturnValue({ where: mockWhere3 });
      const mockLimit4 = vi.fn().mockResolvedValue([listing]);
      const mockWhere4 = vi.fn().mockReturnValue({ limit: mockLimit4 });
      const mockFrom4 = vi.fn().mockReturnValue({ where: mockWhere4 });

      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return { from: mockFrom1 } as any;
        if (selectCallCount === 2) return { from: mockFrom2 } as any;
        if (selectCallCount === 3) return { from: mockFrom3 } as any;
        return { from: mockFrom4 } as any;
      });

      const result = await rentalDAL.updateRentalInstructions(
        "req-1",
        "owner-1",
        "Pick up at garage",
        "Return by 5pm",
      );

      expect(result.rental.id).toBe("req-1");
      expect(result.renterEmail).toBe("renter@example.com");
      expect(result.renterName).toBe("Renter User");
      expect(result.ownerName).toBe("Owner User");
      expect(result.listingName).toBe("Test Listing");
    });

    it("should throw NotFoundError when rental request not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.updateRentalInstructions("bad-id", "owner-1"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw when status is not approved or active", async () => {
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: "req-1",
          ownerId: "owner-1",
          renterId: "renter-1",
          listingId: "listing-1",
          status: "pending",
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        rentalDAL.updateRentalInstructions("req-1", "owner-1"),
      ).rejects.toThrow(/only.*approved or active/i);
    });
  });

  describe("getBookedDatesForListing", () => {
    it("should return booked dates and manual blocks with reason", async () => {
      const booked = [
        {
          startDate: new Date("2024-03-01"),
          endDate: new Date("2024-03-05"),
        },
      ];
      const blocks = [
        {
          startDate: new Date("2024-03-10"),
          endDate: new Date("2024-03-12"),
          reason: "Maintenance",
        },
      ];
      const mockOrderBy1 = vi.fn().mockResolvedValue(booked);
      const mockWhere1 = vi.fn().mockReturnValue({ orderBy: mockOrderBy1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockOrderBy2 = vi.fn().mockResolvedValue(blocks);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? ({ from: mockFrom1 } as any)
          : ({ from: mockFrom2 } as any);
      });

      const result = await rentalDAL.getBookedDatesForListing("listing-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        startDate: booked[0].startDate,
        endDate: booked[0].endDate,
      });
      expect(result[1].reason).toBe("Maintenance");
    });
  });

  describe("getSecurityDepositAuthId", () => {
    it("should return security deposit auth id when present", async () => {
      const mockLimit = vi
        .fn()
        .mockResolvedValue([{ securityDepositAuthId: "auth_123" }]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.getSecurityDepositAuthId("rental-1");

      expect(result).toBe("auth_123");
    });

    it("should return null when rental not found or auth id missing", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.getSecurityDepositAuthId("rental-1");

      expect(result).toBeNull();
    });
  });

  describe("getRentalsDueForPickupReminder", () => {
    it("should return rentals due for pickup reminder", async () => {
      const rows = [
        {
          requestId: "req-1",
          renterId: "r-1",
          renterEmail: "r@example.com",
          listingName: "Drill",
          startDate: new Date(),
          endDate: new Date(),
        },
      ];
      const mockWhere = vi.fn().mockResolvedValue(rows);
      const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.getRentalsDueForPickupReminder(
        24 * 60 * 60 * 1000,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        requestId: "req-1",
        renterEmail: "r@example.com",
        listingName: "Drill",
      });
    });
  });

  describe("getRentalsDueForReturnReminder", () => {
    it("should return rentals due for return reminder", async () => {
      const rows = [
        {
          requestId: "req-2",
          renterId: "r-2",
          renterEmail: "r2@example.com",
          listingName: "Saw",
          startDate: new Date(),
          endDate: new Date(),
        },
      ];
      const mockWhere = vi.fn().mockResolvedValue(rows);
      const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
      const mockInnerJoin1 = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin2,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin1,
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await rentalDAL.getRentalsDueForReturnReminder(
        24 * 60 * 60 * 1000,
      );

      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe("req-2");
    });
  });

  describe("getActionableAlerts", () => {
    it("returns an empty array when no rows match any category", async () => {
      const chain = {
        from: vi.fn(),
        innerJoin: vi.fn(),
        where: vi.fn().mockResolvedValue([]),
      };
      chain.from.mockReturnValue(chain);
      chain.innerJoin.mockReturnValue(chain);
      vi.mocked(db.select).mockReturnValue(chain as any);

      const result = await rentalDAL.getActionableAlerts("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("claimRentalRequestPaymentProcessing", () => {
    const mockUpdateChain = (returned: Array<{ id: string }>) => {
      const mockReturning = vi.fn().mockResolvedValue(returned);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);
      return { mockSet, mockWhere, mockReturning };
    };

    it("returns true when the request is pending (conditional update matches)", async () => {
      const { mockSet, mockWhere } = mockUpdateChain([{ id: "request-123" }]);

      const result =
        await rentalDAL.claimRentalRequestPaymentProcessing("request-123");

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: "processing" }),
      );
      expect(mockWhere).toHaveBeenCalledTimes(1);
    });

    it("returns true when the request previously failed (retry is claimable)", async () => {
      mockUpdateChain([{ id: "request-123" }]);

      const result =
        await rentalDAL.claimRentalRequestPaymentProcessing("request-123");

      expect(result).toBe(true);
    });

    it("returns false when the request is already processing (claim lost)", async () => {
      mockUpdateChain([]);

      const result =
        await rentalDAL.claimRentalRequestPaymentProcessing("request-123");

      expect(result).toBe(false);
    });

    it("returns false when the payment already succeeded", async () => {
      mockUpdateChain([]);

      const result =
        await rentalDAL.claimRentalRequestPaymentProcessing("request-123");

      expect(result).toBe(false);
    });
  });
});
