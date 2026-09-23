import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BlindReviewService } from "../blind-review-service";
import { REVIEW_WINDOW_DAYS } from "../../constants";
import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";

/**
 * Characterization tests for the blind-review system.
 *
 * The booking lookups (`resolveRental` / `resolveServiceBooking`) and the
 * notification name lookup query `db` directly, so `db.select` is stubbed with
 * a chain that serves both shapes: `.limit(1)` for the lookups, and a thenable
 * `.where()` for the user-name query. Each test queues the rows its selects
 * should see, in call order.
 */

const mockCreate = vi.fn();
const mockFindByBooking = vi.fn();
const mockReleaseReviews = vi.fn();
const mockFindByReviewerAndBooking = vi.fn();
const mockFindUnreleasedExpired = vi.fn();
const mockReleaseExpired = vi.fn();
const mockUpdateReviewAggregate = vi.fn();
const mockSendReleased = vi.fn();
const mockDbSelect = vi.fn();

vi.mock("@/dal", () => ({
  blindReviewDAL: {
    create: (...a: unknown[]) => mockCreate(...a),
    findByBooking: (...a: unknown[]) => mockFindByBooking(...a),
    releaseReviews: (...a: unknown[]) => mockReleaseReviews(...a),
    findByReviewerAndBooking: (...a: unknown[]) =>
      mockFindByReviewerAndBooking(...a),
    findUnreleasedExpired: (...a: unknown[]) => mockFindUnreleasedExpired(...a),
    releaseExpired: (...a: unknown[]) => mockReleaseExpired(...a),
  },
  userDAL: {
    updateReviewAggregate: (...a: unknown[]) => mockUpdateReviewAggregate(...a),
  },
}));

vi.mock("../../notifications/blind-review-released", () => ({
  sendReviewReleasedNotification: (...a: unknown[]) => mockSendReleased(...a),
}));

vi.mock("@/db/db", () => ({
  db: { select: (...a: unknown[]) => mockDbSelect(...a) },
}));

/** A drizzle select chain that resolves `rows` via `.limit()` or `await`. */
function selectChain(rows: unknown[] | Error) {
  const settle = () =>
    rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.where = () => chain;
  chain.limit = () => settle();
  chain.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected: (e: unknown) => unknown,
  ) => settle().then(onFulfilled, onRejected);
  return chain;
}

/** Queue the rows the next `db.select` call resolves to. */
const nextSelect = (rows: unknown[] | Error) =>
  mockDbSelect.mockImplementationOnce(() => selectChain(rows));

/** Let fire-and-forget promise chains settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const COMPLETED_AT = new Date("2026-06-01T15:00:00Z");
/** Mirrors the service's own window math (local-time `setDate`), so it is TZ-proof. */
const windowEndFor = (completedAt: Date) => {
  const end = new Date(completedAt);
  end.setDate(end.getDate() + REVIEW_WINDOW_DAYS);
  return end;
};
const WINDOW_END = windowEndFor(COMPLETED_AT);
const IN_WINDOW = new Date(COMPLETED_AT.getTime() + 60 * 60 * 1000);

const rentalRow = {
  rentalId: "rental-1",
  renterId: "renter-1",
  ownerId: "owner-1",
  returnConfirmedAt: COMPLETED_AT,
  requestStatus: "completed",
};

const serviceRow = {
  id: "sb-1",
  requesterId: "client-1",
  providerId: "prov-1",
  status: "completed",
  completedAt: COMPLETED_AT,
};

const review = (overrides: Record<string, unknown>) => ({
  id: "rev-1",
  rentalId: "rental-1",
  serviceBookingId: null,
  reviewerId: "renter-1",
  revieweeId: "owner-1",
  rating: 5,
  comment: null,
  releasedAt: null,
  reviewWindowEndAt: WINDOW_END,
  ...overrides,
});

describe("BlindReviewService", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReset();
    // Any select a test did not queue (e.g. the notification name lookup)
    // resolves to no rows.
    mockDbSelect.mockImplementation(() => selectChain([]));
    mockCreate.mockResolvedValue({ id: "rev-new" });
    mockFindByBooking.mockResolvedValue([]);
    mockReleaseReviews.mockResolvedValue(undefined);
    mockReleaseExpired.mockResolvedValue(undefined);
    mockUpdateReviewAggregate.mockResolvedValue(undefined);
    mockSendReleased.mockResolvedValue(undefined);
    mockFindByReviewerAndBooking.mockResolvedValue(null);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(IN_WINDOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  describe("submitReview", () => {
    it("rejects a non-participant without creating a review", async () => {
      nextSelect([rentalRow]);

      await expect(
        BlindReviewService.submitReview({
          userId: "stranger",
          rentalId: "rental-1",
          rating: 5,
        }),
      ).rejects.toThrow(ForbiddenError);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects once the review window has passed", async () => {
      vi.setSystemTime(new Date(WINDOW_END.getTime() + 1));
      nextSelect([rentalRow]);

      await expect(
        BlindReviewService.submitReview({
          userId: "renter-1",
          rentalId: "rental-1",
          rating: 5,
        }),
      ).rejects.toThrow(ValidationError);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("allows a submission at exactly the window end (strict `>`)", async () => {
      vi.setSystemTime(WINDOW_END);
      nextSelect([rentalRow]);

      await BlindReviewService.submitReview({
        userId: "renter-1",
        rentalId: "rental-1",
        rating: 4,
      });

      expect(mockCreate).toHaveBeenCalled();
    });

    it("creates the review against the other party with the derived window", async () => {
      nextSelect([rentalRow]);

      const out = await BlindReviewService.submitReview({
        userId: "owner-1",
        rentalId: "rental-1",
        rating: 3,
        comment: "ok",
      });

      expect(out).toEqual({ reviewId: "rev-new" });
      expect(mockCreate).toHaveBeenCalledWith({
        rentalId: "rental-1",
        serviceBookingId: undefined,
        reviewerId: "owner-1",
        revieweeId: "renter-1",
        rating: 3,
        comment: "ok",
        reviewWindowEndAt: WINDOW_END,
      });
    });

    it("keeps the first of two reviews blind: no release, aggregate or notification", async () => {
      nextSelect([rentalRow]);
      mockFindByBooking.mockResolvedValue([review({ id: "rev-new" })]);

      await BlindReviewService.submitReview({
        userId: "renter-1",
        rentalId: "rental-1",
        rating: 5,
      });
      await flush();

      expect(mockReleaseReviews).not.toHaveBeenCalled();
      expect(mockUpdateReviewAggregate).not.toHaveBeenCalled();
      expect(mockSendReleased).not.toHaveBeenCalled();
    });

    it("releases both reviews, updates each reviewee's aggregate, and notifies on the second", async () => {
      nextSelect([rentalRow]);
      mockFindByBooking.mockResolvedValue([
        review({ id: "rev-a", reviewerId: "renter-1", revieweeId: "owner-1" }),
        review({ id: "rev-b", reviewerId: "owner-1", revieweeId: "renter-1" }),
      ]);
      // Name lookup for the notifications.
      nextSelect([
        { id: "renter-1", firstName: "Rae", lastName: "Renter" },
        { id: "owner-1", firstName: "Oli", lastName: "Owner" },
      ]);

      await BlindReviewService.submitReview({
        userId: "owner-1",
        rentalId: "rental-1",
        rating: 5,
      });
      await flush();

      expect(mockReleaseReviews).toHaveBeenCalledWith(["rev-a", "rev-b"]);
      expect(mockUpdateReviewAggregate).toHaveBeenCalledTimes(2);
      expect(mockUpdateReviewAggregate).toHaveBeenCalledWith("owner-1");
      expect(mockUpdateReviewAggregate).toHaveBeenCalledWith("renter-1");
      expect(mockSendReleased).toHaveBeenCalledTimes(2);
      expect(mockSendReleased).toHaveBeenCalledWith(
        expect.objectContaining({
          revieweeId: "owner-1",
          revieweeName: "Oli Owner",
          reviewerName: "Rae Renter",
          bookingType: "rental",
          bookingId: "rental-1",
        }),
      );
    });

    it("does not fail the submission when release notifications fail", async () => {
      nextSelect([rentalRow]);
      mockFindByBooking.mockResolvedValue([
        review({ id: "rev-a", reviewerId: "renter-1", revieweeId: "owner-1" }),
        review({ id: "rev-b", reviewerId: "owner-1", revieweeId: "renter-1" }),
      ]);
      // The name lookup blows up, rejecting notifyReleasedReviews itself.
      nextSelect(new Error("db down"));

      await expect(
        BlindReviewService.submitReview({
          userId: "owner-1",
          rentalId: "rental-1",
          rating: 5,
        }),
      ).resolves.toEqual({ reviewId: "rev-new" });
      await flush();

      // Fire-and-forget: the reviews were still released.
      expect(mockReleaseReviews).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to send release notifications:",
        expect.any(Error),
      );
    });

    it("resolves a rental-request id to the rental id it stores (F4)", async () => {
      // The lookup matches rentals.id OR rentals.requestId; the row carries
      // the real rental id, which is what the review must be keyed on.
      nextSelect([rentalRow]);

      await BlindReviewService.submitReview({
        userId: "renter-1",
        rentalId: "request-1",
        rating: 5,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ rentalId: "rental-1" }),
      );
      expect(mockFindByBooking).toHaveBeenCalledWith({
        rentalId: "rental-1",
        serviceBookingId: undefined,
      });
    });

    it("refuses a rental marked completed but with no return timestamp (F7)", async () => {
      nextSelect([{ ...rentalRow, returnConfirmedAt: null }]);

      await expect(
        BlindReviewService.submitReview({
          userId: "renter-1",
          rentalId: "rental-1",
          rating: 5,
        }),
      ).rejects.toThrow(ValidationError);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("refuses a rental whose request is not completed", async () => {
      nextSelect([{ ...rentalRow, requestStatus: "active" }]);

      await expect(
        BlindReviewService.submitReview({
          userId: "renter-1",
          rentalId: "rental-1",
          rating: 5,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("refuses a service booking that is not completed", async () => {
      nextSelect([{ ...serviceRow, status: "accepted" }]);

      await expect(
        BlindReviewService.submitReview({
          userId: "client-1",
          serviceBookingId: "sb-1",
          rating: 5,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError for an unknown booking", async () => {
      nextSelect([]);

      await expect(
        BlindReviewService.submitReview({
          userId: "client-1",
          serviceBookingId: "missing",
          rating: 5,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("requires a rental or service booking id", async () => {
      await expect(
        BlindReviewService.submitReview({ userId: "client-1", rating: 5 }),
      ).rejects.toThrow(ValidationError);
    });

    it("measures a service booking's window from completedAt", async () => {
      nextSelect([serviceRow]);

      await BlindReviewService.submitReview({
        userId: "prov-1",
        serviceBookingId: "sb-1",
        rating: 4,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceBookingId: "sb-1",
          reviewerId: "prov-1",
          revieweeId: "client-1",
          reviewWindowEndAt: WINDOW_END,
        }),
      );
    });
  });

  describe("getReviewStatus", () => {
    const SAFE_DEFAULT = {
      hasReviewed: false,
      canReview: false,
      reviewWindowEndAt: null,
    };

    it("collapses a lookup failure into the safe default (F3)", async () => {
      // A database error is indistinguishable from "no opportunity" today.
      nextSelect(new Error("connection reset"));

      await expect(
        BlindReviewService.getReviewStatus("renter-1", {
          rentalId: "rental-1",
        }),
      ).resolves.toEqual(SAFE_DEFAULT);
    });

    it("returns the safe default for a booking that is not completed", async () => {
      nextSelect([{ ...serviceRow, status: "accepted" }]);

      await expect(
        BlindReviewService.getReviewStatus("client-1", {
          serviceBookingId: "sb-1",
        }),
      ).resolves.toEqual(SAFE_DEFAULT);
    });

    it("returns the safe default for a non-participant without looking up reviews", async () => {
      nextSelect([rentalRow]);

      await expect(
        BlindReviewService.getReviewStatus("stranger", {
          rentalId: "rental-1",
        }),
      ).resolves.toEqual(SAFE_DEFAULT);
      expect(mockFindByReviewerAndBooking).not.toHaveBeenCalled();
    });

    it("reports an existing review as reviewed and not reviewable", async () => {
      nextSelect([rentalRow]);
      mockFindByReviewerAndBooking.mockResolvedValue(review({}));

      await expect(
        BlindReviewService.getReviewStatus("renter-1", {
          rentalId: "rental-1",
        }),
      ).resolves.toEqual({
        hasReviewed: true,
        canReview: false,
        reviewWindowEndAt: WINDOW_END.toISOString(),
      });
    });

    it("allows a review inside the window", async () => {
      nextSelect([rentalRow]);

      await expect(
        BlindReviewService.getReviewStatus("renter-1", {
          rentalId: "rental-1",
        }),
      ).resolves.toEqual({
        hasReviewed: false,
        canReview: true,
        reviewWindowEndAt: WINDOW_END.toISOString(),
      });
    });

    it("still allows a review at exactly the window end (`<=`)", async () => {
      vi.setSystemTime(WINDOW_END);
      nextSelect([rentalRow]);

      const status = await BlindReviewService.getReviewStatus("renter-1", {
        rentalId: "rental-1",
      });

      expect(status.canReview).toBe(true);
    });

    it("reports a closed window with its end date after it passes", async () => {
      vi.setSystemTime(new Date(WINDOW_END.getTime() + 1));
      nextSelect([rentalRow]);

      await expect(
        BlindReviewService.getReviewStatus("renter-1", {
          rentalId: "rental-1",
        }),
      ).resolves.toEqual({
        hasReviewed: false,
        canReview: false,
        reviewWindowEndAt: WINDOW_END.toISOString(),
      });
    });

    it("looks up the caller's review by the resolved rental id, not the raw param", async () => {
      nextSelect([rentalRow]);

      await BlindReviewService.getReviewStatus("renter-1", {
        rentalId: "request-1",
      });

      expect(mockFindByReviewerAndBooking).toHaveBeenCalledWith("renter-1", {
        rentalId: "rental-1",
        serviceBookingId: undefined,
      });
    });
  });

  describe("releaseExpiredReviews", () => {
    it("does nothing when no reviews have expired", async () => {
      mockFindUnreleasedExpired.mockResolvedValue([]);

      await expect(BlindReviewService.releaseExpiredReviews()).resolves.toEqual(
        { eligible: 0, released: 0, failed: 0 },
      );

      expect(mockFindUnreleasedExpired).toHaveBeenCalledWith(100);
      expect(mockReleaseExpired).not.toHaveBeenCalled();
      expect(mockUpdateReviewAggregate).not.toHaveBeenCalled();
    });

    const rentalPair = [
      review({ id: "r1", reviewerId: "renter-1", revieweeId: "owner-1" }),
      review({ id: "r2", reviewerId: "owner-1", revieweeId: "renter-1" }),
    ];
    const servicePair = [
      review({
        id: "s1",
        rentalId: null,
        serviceBookingId: "sb-1",
        reviewerId: "client-1",
        revieweeId: "prov-1",
      }),
      review({
        id: "s2",
        rentalId: null,
        serviceBookingId: "sb-1",
        reviewerId: "prov-1",
        revieweeId: "client-1",
      }),
    ];

    it("releases each booking's reviews as one group", async () => {
      mockFindUnreleasedExpired.mockResolvedValue([
        rentalPair[0],
        servicePair[0],
        rentalPair[1],
        servicePair[1],
      ]);

      await expect(
        BlindReviewService.releaseExpiredReviews(50),
      ).resolves.toEqual({ eligible: 4, released: 4, failed: 0 });
      await flush();

      expect(mockFindUnreleasedExpired).toHaveBeenCalledWith(50);
      expect(mockReleaseExpired).toHaveBeenCalledTimes(2);
      expect(mockReleaseExpired).toHaveBeenCalledWith(["r1", "r2"]);
      expect(mockReleaseExpired).toHaveBeenCalledWith(["s1", "s2"]);
      expect(mockSendReleased).toHaveBeenCalledWith(
        expect.objectContaining({ bookingType: "service", bookingId: "sb-1" }),
      );
    });

    it("counts a failing group as failed and still releases the others", async () => {
      mockFindUnreleasedExpired.mockResolvedValue([
        ...rentalPair,
        ...servicePair,
      ]);
      mockReleaseExpired.mockImplementation(async (ids: string[]) => {
        if (ids.includes("r1")) throw new Error("deadlock");
      });

      await expect(BlindReviewService.releaseExpiredReviews()).resolves.toEqual(
        { eligible: 4, released: 2, failed: 2 },
      );

      expect(mockReleaseExpired).toHaveBeenCalledWith(["s1", "s2"]);
      // The failed group's reviewees are not re-aggregated.
      expect(mockUpdateReviewAggregate).not.toHaveBeenCalledWith("owner-1");
      expect(mockUpdateReviewAggregate).not.toHaveBeenCalledWith("renter-1");
    });

    it("updates each distinct reviewee's aggregate once per group", async () => {
      // A single expired review (the other party never submitted).
      mockFindUnreleasedExpired.mockResolvedValue([
        rentalPair[0],
        ...servicePair,
      ]);

      await BlindReviewService.releaseExpiredReviews();

      expect(mockUpdateReviewAggregate).toHaveBeenCalledTimes(3);
      expect(mockUpdateReviewAggregate).toHaveBeenCalledWith("owner-1");
      expect(mockUpdateReviewAggregate).toHaveBeenCalledWith("prov-1");
      expect(mockUpdateReviewAggregate).toHaveBeenCalledWith("client-1");
    });
  });
});
