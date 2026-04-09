import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewService } from "../review-service";
import { ValidationError } from "@/dal/errors";

const mockCreateReview = vi.fn();
const mockGetReviewByRentalId = vi.fn();
const mockGetReviewByRequestId = vi.fn();
const mockTrackActivity = vi.fn();
const mockSendReviewSubmittedAdminNotification = vi.fn(
  async (...args: unknown[]) => {
    void args;
    return undefined;
  },
);

vi.mock("@/dal", () => ({
  reviewDAL: {
    createReview: (...args: unknown[]) => mockCreateReview(...args),
    getReviewByRentalId: (...args: unknown[]) =>
      mockGetReviewByRentalId(...args),
    getReviewByRequestId: (...args: unknown[]) =>
      mockGetReviewByRequestId(...args),
  },
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: (...args: unknown[]) => mockTrackActivity(...args),
}));

vi.mock("@/features/reviews/notifications/review-submitted", () => ({
  sendReviewSubmittedAdminNotification: (...args: unknown[]) =>
    mockSendReviewSubmittedAdminNotification(...args),
}));

describe("ReviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createReview", () => {
    it("tracks activity and sends admin notification when review has id", async () => {
      mockCreateReview.mockResolvedValue({
        id: "rev-1",
        listingId: "list-1",
      });

      const result = await ReviewService.createReview("user-1", {
        rentalId: "rent-1",
        rating: 5,
        comment: "Great",
      });

      expect(result.reviewId).toBe("rev-1");
      expect(mockTrackActivity).toHaveBeenCalledWith(
        "user-1",
        "review_created",
        {
          reviewId: "rev-1",
          rentalId: "rent-1",
          requestId: undefined,
        },
      );
      expect(mockSendReviewSubmittedAdminNotification).toHaveBeenCalledWith({
        id: "rev-1",
        listingId: "list-1",
        rating: 5,
      });
    });

    it("does not track or notify when review has no id", async () => {
      mockCreateReview.mockResolvedValue(undefined);

      const result = await ReviewService.createReview("user-1", {
        rentalId: "rent-1",
        rating: 5,
        comment: "Great",
      });

      expect(result.reviewId).toBeUndefined();
      expect(mockTrackActivity).not.toHaveBeenCalled();
      expect(mockSendReviewSubmittedAdminNotification).not.toHaveBeenCalled();
    });
  });

  describe("getReviewByRentalOrRequest", () => {
    it("throws ValidationError when neither rentalId nor requestId is set", async () => {
      await expect(
        ReviewService.getReviewByRentalOrRequest({
          rentalId: null,
          requestId: null,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("uses requestId when both ids are present", async () => {
      mockGetReviewByRequestId.mockResolvedValue({ id: "by-req" });
      mockGetReviewByRentalId.mockResolvedValue({ id: "by-rental" });

      const review = await ReviewService.getReviewByRentalOrRequest({
        rentalId: "rent-1",
        requestId: "req-1",
      });

      expect(review).toEqual({ id: "by-req" });
      expect(mockGetReviewByRequestId).toHaveBeenCalledWith("req-1");
      expect(mockGetReviewByRentalId).not.toHaveBeenCalled();
    });

    it("loads by rentalId when only rentalId is set", async () => {
      mockGetReviewByRentalId.mockResolvedValue({ id: "r1" });

      const review = await ReviewService.getReviewByRentalOrRequest({
        rentalId: "rent-99",
        requestId: null,
      });

      expect(mockGetReviewByRentalId).toHaveBeenCalledWith("rent-99");
      expect(review).toEqual({ id: "r1" });
    });
  });
});
