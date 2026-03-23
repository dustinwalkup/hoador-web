import { describe, it, expect, vi, beforeEach } from "vitest";
import { serviceReviewDAL } from "../index";
import { ConflictError } from "../errors";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

const reviewRow = {
  id: "rev-1",
  bookingId: "book-1",
  listingId: "list-1",
  reviewerId: "u1",
  revieweeId: "u2",
  rating: 5,
  comment: "Great",
  createdAt: new Date(),
};

describe("ServiceReviewDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("inserts and returns the review", async () => {
      const mockReturning = vi.fn().mockResolvedValue([reviewRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const result = await serviceReviewDAL.create({
        bookingId: reviewRow.bookingId,
        listingId: reviewRow.listingId,
        reviewerId: reviewRow.reviewerId,
        revieweeId: reviewRow.revieweeId,
        rating: 5,
        comment: "Great",
      });

      expect(result).toEqual(reviewRow);
    });

    it("maps unique violation to ConflictError", async () => {
      const err = Object.assign(new Error("dup"), { code: "23505" });
      const mockReturning = vi.fn().mockRejectedValue(err);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      await expect(
        serviceReviewDAL.create({
          bookingId: "b",
          listingId: "l",
          reviewerId: "r",
          revieweeId: "e",
          rating: 5,
          comment: null,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("findByBooking", () => {
    it("returns mapped reviews for a booking", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          review: reviewRow,
          reviewer: {
            id: "u1",
            firstName: "A",
            lastName: "B",
            profileImageUrl: null,
            email: "a@b.com",
          },
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const rows = await serviceReviewDAL.findByBooking("book-1");
      expect(rows).toHaveLength(1);
      expect(rows[0].bookingId).toBe("book-1");
    });
  });

  describe("findByListing", () => {
    it("returns reviews scoped to listingId", async () => {
      const mapped = {
        ...reviewRow,
        reviewer: {
          id: "u1",
          firstName: "A",
          lastName: "B",
          profileImageUrl: null,
          email: "a@b.com",
        },
      };
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          review: reviewRow,
          reviewer: mapped.reviewer,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const rows = await serviceReviewDAL.findByListing("list-1");
      expect(rows).toHaveLength(1);
      expect(rows[0].listingId).toBe("list-1");
      expect(rows[0].reviewer.email).toBe("a@b.com");
    });
  });

  describe("calculateProviderAggregateRating", () => {
    it("returns average and count from aggregate query", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ avg: "4.5", cnt: "4" }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result =
        await serviceReviewDAL.calculateProviderAggregateRating("prov-1");

      expect(result.count).toBe(4);
      expect(result.average).toBe(4.5);
    });

    it("returns zeros when no reviews", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ avg: null, cnt: "0" }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result =
        await serviceReviewDAL.calculateProviderAggregateRating("prov-empty");

      expect(result).toEqual({ average: 0, count: 0 });
    });
  });

  describe("updateProviderAggregateRating", () => {
    it("upserts provider profile with aggregate fields", async () => {
      vi.spyOn(
        serviceReviewDAL,
        "calculateProviderAggregateRating",
      ).mockResolvedValue({ average: 4.25, count: 4 });

      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockValues = vi
        .fn()
        .mockReturnValue({ onConflictDoUpdate: mockOnConflict });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      await serviceReviewDAL.updateProviderAggregateRating("prov-1");

      expect(
        serviceReviewDAL.calculateProviderAggregateRating,
      ).toHaveBeenCalledWith("prov-1");
      expect(mockValues).toHaveBeenCalled();
      expect(mockOnConflict).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });
});
