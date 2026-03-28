import { serviceBookingDAL, serviceListingDAL, serviceReviewDAL } from "@/dal";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/dal/errors";

/**
 * Reviews for completed HOA service bookings.
 */
export class ServiceReviewService {
  /**
   * Submit one review per party per booking; updates provider aggregate rating.
   */
  static async submitReview(
    bookingId: string,
    reviewerId: string,
    input: { rating: number; comment?: string },
  ): Promise<void> {
    const booking = await serviceBookingDAL.getById(bookingId);
    if (!booking) {
      throw new NotFoundError("Service booking", bookingId);
    }

    if (booking.status !== "completed") {
      throw new ValidationError(
        "Reviews are only allowed for completed bookings",
        "status",
      );
    }

    if (
      reviewerId !== booking.requesterId &&
      reviewerId !== booking.providerId
    ) {
      throw new ForbiddenError("You cannot review this booking");
    }

    const rating = Math.round(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError(
        "Rating must be an integer from 1 to 5",
        "rating",
      );
    }

    const revieweeId =
      reviewerId === booking.requesterId
        ? booking.providerId
        : booking.requesterId;

    const listing = await serviceListingDAL.getById(booking.listingId);
    if (!listing) {
      throw new NotFoundError("Service listing", booking.listingId);
    }

    try {
      await serviceReviewDAL.create({
        bookingId,
        listingId: booking.listingId,
        reviewerId,
        revieweeId,
        rating,
        comment: input.comment?.trim() ? input.comment.trim() : null,
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        throw new ConflictError("review_already_submitted");
      }
      throw error;
    }

    await serviceReviewDAL.updateProviderAggregateRating(listing.providerId);
  }
}
