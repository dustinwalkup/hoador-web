import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { blindReviewDAL } from "../index";
import { ConflictError } from "../errors";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

/** Render a captured drizzle WHERE clause to SQL text for guard assertions. */
const whereSql = (where: unknown) =>
  new PgDialect().sqlToQuery(where as SQL).sql;

const reviewRow = {
  id: "rev-1",
  rentalId: "rental-1",
  serviceBookingId: null,
  reviewerId: "renter-1",
  revieweeId: "owner-1",
  rating: 5,
  comment: null,
  submittedAt: new Date(),
  releasedAt: null,
  reviewWindowEndAt: new Date("2026-06-08T15:00:00Z"),
};

describe("BlindReviewDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("create", () => {
    it("inserts an unreleased review and returns the row", async () => {
      const mockReturning = vi.fn().mockResolvedValue([reviewRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const result = await blindReviewDAL.create({
        rentalId: "rental-1",
        reviewerId: "renter-1",
        revieweeId: "owner-1",
        rating: 5,
        reviewWindowEndAt: reviewRow.reviewWindowEndAt,
      });

      expect(result).toEqual(reviewRow);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          rentalId: "rental-1",
          serviceBookingId: null,
          comment: null,
        }),
      );
      // Blindness is the insert's default: nothing sets releasedAt here.
      expect(mockValues.mock.calls[0][0]).not.toHaveProperty("releasedAt");
    });

    it("maps a unique violation to a ConflictError with a specific message", async () => {
      const mockReturning = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const attempt = blindReviewDAL.create({
        rentalId: "rental-1",
        reviewerId: "renter-1",
        revieweeId: "owner-1",
        rating: 5,
        reviewWindowEndAt: reviewRow.reviewWindowEndAt,
      });

      await expect(attempt).rejects.toThrow(ConflictError);
      await expect(attempt).rejects.toThrow(
        "You have already submitted a review for this booking",
      );
    });
  });

  describe("releaseReviews", () => {
    it("only stamps reviews that are still unreleased", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      await blindReviewDAL.releaseReviews(["rev-1", "rev-2"]);

      expect(whereSql(mockWhere.mock.calls[0][0])).toContain(
        '"blind_reviews"."released_at" is null',
      );
    });
  });

  describe("releaseExpired", () => {
    it("returns without touching the database for an empty batch", async () => {
      await blindReviewDAL.releaseExpired([]);

      expect(db.update).not.toHaveBeenCalled();
    });

    it("updates only the given reviews that are still unreleased", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      await blindReviewDAL.releaseExpired(["rev-1", "rev-2"]);

      expect(db.update).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ releasedAt: expect.anything() }),
      );
      const sql = whereSql(mockWhere.mock.calls[0][0]);
      expect(sql).toContain('"blind_reviews"."id" in');
      // An overlapping cron run must not re-release (and re-notify) rows.
      expect(sql).toContain('"blind_reviews"."released_at" is null');
    });
  });

  describe("findUnreleasedExpired", () => {
    it("returns unreleased reviews past their window, limited to the batch", async () => {
      const mockLimit = vi.fn().mockResolvedValue([reviewRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await blindReviewDAL.findUnreleasedExpired(25);

      expect(result).toEqual([reviewRow]);
      expect(mockLimit).toHaveBeenCalledWith(25);
      const sql = whereSql(mockWhere.mock.calls[0][0]);
      expect(sql).toContain('"blind_reviews"."released_at" is null');
      expect(sql).toContain('"blind_reviews"."review_window_end_at" <= now()');
    });
  });
});
