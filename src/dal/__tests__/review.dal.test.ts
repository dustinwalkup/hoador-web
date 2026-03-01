import { describe, it, expect, vi, beforeEach } from "vitest";
import { reviewDAL } from "../index";
import { NotFoundError, ValidationError, ConflictError } from "../errors";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    query: {
      user: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("ReviewDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSummaryForUser", () => {
    it("should return average rating and total reviews when reviews exist", async () => {
      const userId = "user-123";
      const mockRatings = [{ rating: 4 }, { rating: 5 }, { rating: 3 }];
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockRatings),
        }),
      } as any);

      const result = await reviewDAL.getSummaryForUser(userId);

      expect(result).toEqual({
        averageRating: 4,
        totalReviews: 3,
      });
    });

    it("should return 0 average and 0 total when no reviews", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await reviewDAL.getSummaryForUser("user-123");

      expect(result).toEqual({
        averageRating: 0,
        totalReviews: 0,
      });
    });
  });

  describe("getRatingDistribution", () => {
    it("should return full 1-5 distribution with counts", async () => {
      const distribution = [
        { rating: 1, count: 0 },
        { rating: 2, count: 1 },
        { rating: 3, count: 2 },
        { rating: 4, count: 3 },
        { rating: 5, count: 1 },
      ];
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(distribution),
            }),
          }),
        }),
      } as any);

      const result = await reviewDAL.getRatingDistribution("user-123");

      expect(result).toHaveLength(5);
      expect(result).toEqual([
        { rating: 1, count: 0 },
        { rating: 2, count: 1 },
        { rating: 3, count: 2 },
        { rating: 4, count: 3 },
        { rating: 5, count: 1 },
      ]);
    });

    it("should fill missing ratings with 0", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([{ rating: 5, count: 10 }]),
            }),
          }),
        }),
      } as any);

      const result = await reviewDAL.getRatingDistribution("user-123");

      expect(result).toEqual([
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 0 },
        { rating: 4, count: 0 },
        { rating: 5, count: 10 },
      ]);
    });
  });

  describe("getReviewsCount", () => {
    it("should return count when reviews exist", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 7 }]),
        }),
      } as any);

      const result = await reviewDAL.getReviewsCount("user-123");

      expect(result).toBe(7);
    });

    it("should return 0 when no result", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await reviewDAL.getReviewsCount("user-123");

      expect(result).toBe(0);
    });
  });

  describe("getRecentReviews", () => {
    it("should return reviews with reviewer and listing when data exists", async () => {
      const mockReviews = [
        {
          id: "rev-1",
          rating: 5,
          comment: "Great",
          title: "Good",
          createdAt: new Date("2025-01-01"),
          reviewerId: "r1",
          listingId: "l1",
          accuracyRating: null,
          listingConditionRating: null,
          ownerCommunicationRating: null,
        },
      ];
      const mockReviewers = [
        {
          id: "r1",
          firstName: "Alice",
          lastName: "Smith",
          profileImageUrl: "https://avatar.url",
        },
      ];
      const mockListings = [{ id: "l1", name: "Drill" }];

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockReviews),
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (selectCallCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockReviewers),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockListings),
          }),
        } as any;
      });

      const result = await reviewDAL.getRecentReviews("user-123", {
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "rev-1",
        rating: 5,
        comment: "Great",
        title: "Good",
        reviewer: {
          id: "r1",
          name: "Alice Smith",
          avatarUrl: "https://avatar.url",
        },
        listing: { id: "l1", name: "Drill" },
      });
    });

    it("should return empty array and not query user/listings when no reviews", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any);

      const result = await reviewDAL.getRecentReviews("user-123");

      expect(result).toEqual([]);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it("should use sortBy rating and sortOrder asc when provided", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any);

      await reviewDAL.getRecentReviews("user-123", {
        sortBy: "rating",
        sortOrder: "asc",
      });

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getUserReviewsSummary", () => {
    it("should return summary, distribution, and recent reviews", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ rating: 5 }]),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([{ rating: 5, count: 1 }]),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        } as any);

      const result = await reviewDAL.getUserReviewsSummary("user-123");

      expect(result).toHaveProperty("summary");
      expect(result.summary).toEqual({ averageRating: 5, totalReviews: 1 });
      expect(result).toHaveProperty("distribution");
      expect(result).toHaveProperty("recentReviews");
      expect(result.recentReviews).toEqual([]);
    });
  });

  describe("getReviewByRentalId", () => {
    it("should return review with reviewer when found", async () => {
      const mockReview = {
        id: "rev-1",
        rentalId: "rent-1",
        reviewerId: "r1",
        revieweeId: "reviewee-1",
        listingId: "l1",
        rating: 5,
        title: "Good",
        comment: "Great",
        accuracyRating: null,
        listingConditionRating: null,
        ownerCommunicationRating: null,
        isOwnerReview: false,
        isPublic: true,
        helpfulCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockReviewer = {
        id: "r1",
        firstName: "Alice",
        lastName: "Smith",
        profileImageUrl: null,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockReview]),
          }),
        }),
      } as any);
      vi.mocked(db.query.user.findFirst).mockResolvedValue(mockReviewer as any);

      const result = await reviewDAL.getReviewByRentalId("rent-1");

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        ...mockReview,
        reviewer: {
          id: "r1",
          firstName: "Alice",
          lastName: "Smith",
          profileImageUrl: null,
        },
      });
    });

    it("should return null when no review found", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await reviewDAL.getReviewByRentalId("rent-1");

      expect(result).toBeNull();
    });

    it("should return review with reviewer null when reviewer fetch fails", async () => {
      const mockReview = {
        id: "rev-1",
        rentalId: "rent-1",
        reviewerId: "r1",
        revieweeId: "reviewee-1",
        listingId: "l1",
        rating: 5,
        title: "Good",
        comment: "Great",
        accuracyRating: null,
        listingConditionRating: null,
        ownerCommunicationRating: null,
        isOwnerReview: false,
        isPublic: true,
        helpfulCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockReview]),
          }),
        }),
      } as any);
      vi.mocked(db.query.user.findFirst).mockRejectedValue(
        new Error("DB error"),
      );

      const result = await reviewDAL.getReviewByRentalId("rent-1");

      expect(result).not.toBeNull();
      expect(result).toMatchObject({ ...mockReview, reviewer: null });
    });

    it("should throw database error when query fails with relation message", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockRejectedValue(new Error("relation does not exist")),
          }),
        }),
      } as any);

      await expect(reviewDAL.getReviewByRentalId("rent-1")).rejects.toThrow(
        /Database error/,
      );
    });
  });

  describe("getReviewByRequestId", () => {
    it("should return null when no rental for request", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await reviewDAL.getReviewByRequestId("req-1");

      expect(result).toBeNull();
    });

    it("should return review when rental exists and has review", async () => {
      const mockRental = [{ id: "rent-1" }];
      const mockReview = {
        id: "rev-1",
        rentalId: "rent-1",
        reviewerId: "r1",
        revieweeId: "reviewee-1",
        listingId: "l1",
        rating: 5,
        title: "Good",
        comment: "Great",
        accuracyRating: null,
        listingConditionRating: null,
        ownerCommunicationRating: null,
        isOwnerReview: false,
        isPublic: true,
        helpfulCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewer: null,
      };

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockRental),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockReview]),
            }),
          }),
        } as any);
      vi.mocked(db.query.user.findFirst).mockResolvedValue(undefined);

      const result = await reviewDAL.getReviewByRequestId("req-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("rev-1");
    });
  });

  describe("canLeaveReview", () => {
    it("should return canLeave: false when rental not found", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      const result = await reviewDAL.canLeaveReview("rent-1", "user-1");

      expect(result).toEqual({ canLeave: false, reason: "Rental not found" });
    });

    it("should return canLeave: false when user is not renter", async () => {
      const rentalRow = {
        rentalId: "rent-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        damageReported: false,
        requestStatus: "completed",
      };
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([rentalRow]),
            }),
          }),
        }),
      } as any);

      const result = await reviewDAL.canLeaveReview("rent-1", "other-user");

      expect(result).toEqual({
        canLeave: false,
        reason: "Only the renter can leave a review",
      });
    });

    it("should return canLeave: false when request status is not completed", async () => {
      const rentalRow = {
        rentalId: "rent-1",
        renterId: "user-1",
        ownerId: "owner-1",
        damageReported: false,
        requestStatus: "pending",
      };
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([rentalRow]),
            }),
          }),
        }),
      } as any);

      const result = await reviewDAL.canLeaveReview("rent-1", "user-1");

      expect(result).toEqual({
        canLeave: false,
        reason: "Reviews can only be left for completed rentals",
      });
    });

    it("should return canLeave: false when damage is reported", async () => {
      const rentalRow = {
        rentalId: "rent-1",
        renterId: "user-1",
        ownerId: "owner-1",
        damageReported: true,
        requestStatus: "completed",
      };
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([rentalRow]),
            }),
          }),
        }),
      } as any);

      const result = await reviewDAL.canLeaveReview("rent-1", "user-1");

      expect(result).toEqual({
        canLeave: false,
        reason: "Reviews cannot be left when damage is reported",
      });
    });

    it("should return canLeave: false when review already exists", async () => {
      const rentalRow = {
        rentalId: "rent-1",
        renterId: "user-1",
        ownerId: "owner-1",
        damageReported: false,
        requestStatus: "completed",
      };
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([rentalRow]),
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "existing-review" }]),
            }),
          }),
        } as any;
      });

      const result = await reviewDAL.canLeaveReview("rent-1", "user-1");

      expect(result).toEqual({
        canLeave: false,
        reason: "Review already exists for this rental",
      });
    });

    it("should return canLeave: true when all checks pass", async () => {
      const rentalRow = {
        rentalId: "rent-1",
        renterId: "user-1",
        ownerId: "owner-1",
        damageReported: false,
        requestStatus: "completed",
      };
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([rentalRow]),
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any;
      });

      const result = await reviewDAL.canLeaveReview("rent-1", "user-1");

      expect(result).toEqual({ canLeave: true });
    });
  });

  describe("createReview", () => {
    const validData = {
      rentalId: "rent-1",
      rating: 5,
      comment: "Great experience",
    };

    it("should throw ValidationError when rating is out of range", async () => {
      await expect(
        reviewDAL.createReview("user-1", { ...validData, rating: 0 }),
      ).rejects.toThrow(ValidationError);
      await expect(
        reviewDAL.createReview("user-1", { ...validData, rating: 6 }),
      ).rejects.toThrow("Rating must be between 1 and 5");
    });

    it("should throw ValidationError when optional ratings are out of range", async () => {
      await expect(
        reviewDAL.createReview("user-1", {
          ...validData,
          accuracyRating: 0,
        }),
      ).rejects.toThrow("Accuracy rating must be between 1 and 5");
      await expect(
        reviewDAL.createReview("user-1", {
          ...validData,
          listingConditionRating: 6,
        }),
      ).rejects.toThrow("Listing condition rating must be between 1 and 5");
      await expect(
        reviewDAL.createReview("user-1", {
          ...validData,
          ownerCommunicationRating: 0,
        }),
      ).rejects.toThrow("Owner communication rating must be between 1 and 5");
    });

    it("should throw ValidationError when neither rentalId nor requestId provided", async () => {
      await expect(
        reviewDAL.createReview("user-1", {
          rating: 5,
          comment: "Ok",
        }),
      ).rejects.toThrow("Either rentalId or requestId is required");
    });

    it("should throw NotFoundError when requestId has no rental", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(
        reviewDAL.createReview("user-1", {
          requestId: "req-1",
          rating: 5,
          comment: "Ok",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("should create review when rentalId provided and canLeave is true", async () => {
      const rentalRow = {
        renterId: "user-1",
        ownerId: "owner-1",
        listingId: "listing-1",
      };
      const createdReview = {
        id: "rev-new",
        rentalId: "rent-1",
        reviewerId: "user-1",
        revieweeId: "owner-1",
        listingId: "listing-1",
        rating: 5,
        comment: "Great experience",
        isOwnerReview: false,
        accuracyRating: null,
        listingConditionRating: null,
        ownerCommunicationRating: null,
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      rentalId: "rent-1",
                      renterId: "user-1",
                      ownerId: "owner-1",
                      damageReported: false,
                      requestStatus: "completed",
                    },
                  ]),
                }),
              }),
            }),
          } as any;
        }
        if (selectCallCount === 2 || selectCallCount === 4) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([rentalRow]),
            }),
          }),
        } as any;
      });
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdReview]),
        }),
      } as any);

      const result = await reviewDAL.createReview("user-1", validData);

      expect(result).toEqual(createdReview);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should resolve rentalId from requestId when requestId provided", async () => {
      const rentalFromRequest = [{ id: "rent-from-req" }];
      const rentalRow = {
        renterId: "user-1",
        ownerId: "owner-1",
        listingId: "listing-1",
      };
      const createdReview = {
        id: "rev-new",
        rentalId: "rent-from-req",
        reviewerId: "user-1",
        revieweeId: "owner-1",
        listingId: "listing-1",
        rating: 5,
        comment: "Great",
        isOwnerReview: false,
        accuracyRating: null,
        listingConditionRating: null,
        ownerCommunicationRating: null,
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(rentalFromRequest),
              }),
            }),
          } as any;
        }
        if (selectCallCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      rentalId: "rent-from-req",
                      renterId: "user-1",
                      ownerId: "owner-1",
                      damageReported: false,
                      requestStatus: "completed",
                    },
                  ]),
                }),
              }),
            }),
          } as any;
        }
        if (selectCallCount === 3 || selectCallCount === 5) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([rentalRow]),
            }),
          }),
        } as any;
      });
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdReview]),
        }),
      } as any);

      const result = await reviewDAL.createReview("user-1", {
        requestId: "req-1",
        rating: 5,
        comment: "Great",
      });

      expect(result.rentalId).toBe("rent-from-req");
    });

    it("should throw ValidationError when canLeaveReview returns false", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  rentalId: "rent-1",
                  renterId: "other-user",
                  ownerId: "owner-1",
                  damageReported: false,
                  requestStatus: "completed",
                },
              ]),
            }),
          }),
        }),
      } as any);

      await expect(reviewDAL.createReview("user-1", validData)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ConflictError when review already exists", async () => {
      const rentalRow = {
        renterId: "user-1",
        ownerId: "owner-1",
        listingId: "listing-1",
      };
      const existingReview = { id: "existing-review" };
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      rentalId: "rent-1",
                      renterId: "user-1",
                      ownerId: "owner-1",
                      damageReported: false,
                      requestStatus: "completed",
                    },
                  ]),
                }),
              }),
            }),
          } as any;
        }
        if (selectCallCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as any;
        }
        if (selectCallCount === 3) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([rentalRow]),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([existingReview]),
            }),
          }),
        } as any;
      });

      const err = await reviewDAL.createReview("user-1", validData).then(
        () => null,
        (e) => e,
      );
      expect(err).toBeInstanceOf(ConflictError);
      expect(err).toMatchObject({
        message: "Review already exists for this rental",
        code: "CONFLICT",
      });
    });

    it("should include optional ratings in insert when provided", async () => {
      const rentalRow = {
        renterId: "user-1",
        ownerId: "owner-1",
        listingId: "listing-1",
      };
      const mockValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "rev-1",
            rentalId: "rent-1",
            reviewerId: "user-1",
            revieweeId: "owner-1",
            listingId: "listing-1",
            rating: 5,
            comment: "Great",
            accuracyRating: 4,
            listingConditionRating: 5,
            ownerCommunicationRating: 3,
          },
        ]),
      });
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      rentalId: "rent-1",
                      renterId: "user-1",
                      ownerId: "owner-1",
                      damageReported: false,
                      requestStatus: "completed",
                    },
                  ]),
                }),
              }),
            }),
          } as any;
        }
        if (selectCallCount === 2 || selectCallCount === 4) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([rentalRow]),
            }),
          }),
        } as any;
      });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      await reviewDAL.createReview("user-1", {
        ...validData,
        accuracyRating: 4,
        listingConditionRating: 5,
        ownerCommunicationRating: 3,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          accuracyRating: 4,
          listingConditionRating: 5,
          ownerCommunicationRating: 3,
        }),
      );
    });
  });
});
