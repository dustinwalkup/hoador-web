import { reviewDAL } from "@/dal";
import { ValidationError } from "@/dal/errors";
import { trackActivity } from "@/features/activity/lib/track-activity";
import { sendReviewSubmittedAdminNotification } from "@/features/reviews/notifications/review-submitted";

/** Payload for creating a review after API validation (matches review DAL input). */
export interface CreateReviewPayload {
  rentalId?: string;
  requestId?: string;
  rating: number;
  comment: string;
  accuracyRating?: number;
  listingConditionRating?: number;
  ownerCommunicationRating?: number;
}

/**
 * Application service for rental reviews (create and lookup by rental or request).
 */
export class ReviewService {
  /**
   * Creates a review, records activity, and notifies admins when a review id exists.
   *
   * @param userId - Authenticated reviewer (renter)
   * @param reviewData - Validated review fields
   * @returns The new review id when creation succeeds
   */
  static async createReview(
    userId: string,
    reviewData: CreateReviewPayload,
  ): Promise<{ reviewId?: string }> {
    const review = await reviewDAL.createReview(userId, reviewData);

    if (review?.id) {
      trackActivity(userId, "review_created", {
        reviewId: review.id,
        rentalId: reviewData.rentalId,
        requestId: reviewData.requestId,
      });

      sendReviewSubmittedAdminNotification({
        id: review.id,
        listingId: review.listingId ?? null,
        rating: reviewData.rating,
      }).catch((err) => {
        console.error(
          "Failed to send review submitted admin notification:",
          err,
        );
      });
    }

    return { reviewId: review?.id };
  }

  /**
   * Loads a review by rental id or request id. When both are present, request id wins.
   *
   * @param params - Exactly one of rentalId or requestId should be set (requestId takes precedence)
   * @returns Review row with reviewer info, or null if not found
   * @throws ValidationError when neither id is provided
   */
  static async getReviewByRentalOrRequest(params: {
    rentalId?: string | null;
    requestId?: string | null;
  }): Promise<Awaited<ReturnType<typeof reviewDAL.getReviewByRentalId>>> {
    const { rentalId, requestId } = params;

    if (!rentalId && !requestId) {
      throw new ValidationError(
        "rentalId or requestId query parameter is required",
      );
    }

    if (requestId) {
      return reviewDAL.getReviewByRequestId(requestId);
    }

    return reviewDAL.getReviewByRentalId(rentalId!);
  }
}
