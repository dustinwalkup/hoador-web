import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/db";
import { blindReviewDAL, userDAL } from "@/dal";
import { NotFoundError, ValidationError, ForbiddenError } from "@/dal/errors";
import type { BlindReviewWithReviewer } from "@/dal/blind-review.dal";
import type { PaginatedResult } from "@/dal/types";
import { rentals, rentalRequests } from "@/db/schemas/rentals.schema";
import { serviceBookings } from "@/db/schemas/services.schema";
import { user } from "@/db/schemas/user.schema";
import { REVIEW_WINDOW_DAYS } from "../constants";
import { sendReviewReleasedNotification } from "../notifications/blind-review-released";

/** Resolved booking info needed for review logic. */
interface ResolvedBooking {
  type: "rental" | "service";
  rentalId?: string;
  serviceBookingId?: string;
  participantA: string;
  participantB: string;
  completedAt: Date;
  reviewWindowEndAt: Date;
}

/**
 * Application service for the blind review system.
 * All methods are static — no instance state.
 */
export class BlindReviewService {
  /**
   * Submit a review for a completed booking.
   * Creates the review, checks if both parties have submitted, and releases if so.
   */
  static async submitReview(params: {
    userId: string;
    rentalId?: string;
    serviceBookingId?: string;
    rating: number;
    comment?: string;
  }): Promise<{ reviewId: string }> {
    const booking = await BlindReviewService.resolveBooking({
      rentalId: params.rentalId,
      serviceBookingId: params.serviceBookingId,
    });

    // Validate user is a participant
    const isParticipant =
      params.userId === booking.participantA ||
      params.userId === booking.participantB;
    if (!isParticipant) {
      throw new ForbiddenError("You are not a participant in this booking");
    }

    // Derive reviewee (the other party)
    const revieweeId =
      params.userId === booking.participantA
        ? booking.participantB
        : booking.participantA;

    // Self-review guard (should be impossible given the above, but defense-in-depth)
    if (params.userId === revieweeId) {
      throw new ValidationError("You cannot review yourself");
    }

    // Validate window not expired
    if (new Date() > booking.reviewWindowEndAt) {
      throw new ValidationError(
        "The review window has expired for this booking",
      );
    }

    // Create review (DAL throws ConflictError on duplicate)
    const review = await blindReviewDAL.create({
      rentalId: booking.rentalId,
      serviceBookingId: booking.serviceBookingId,
      reviewerId: params.userId,
      revieweeId,
      rating: params.rating,
      comment: params.comment ?? null,
      reviewWindowEndAt: booking.reviewWindowEndAt,
    });

    // Release check: does the other party's review exist?
    const allReviews = await blindReviewDAL.findByBooking({
      rentalId: booking.rentalId,
      serviceBookingId: booking.serviceBookingId,
    });

    if (allReviews.length === 2) {
      // Both reviews exist — release both immediately
      const reviewIds = allReviews.map((r) => r.id);
      await blindReviewDAL.releaseReviews(reviewIds);

      // Update aggregates and notify both reviewees
      const revieweeIds = [...new Set(allReviews.map((r) => r.revieweeId))];
      await Promise.all(
        revieweeIds.map((id) => userDAL.updateReviewAggregate(id)),
      );

      // Send notifications (fire-and-forget)
      BlindReviewService.notifyReleasedReviews(allReviews, booking.type).catch(
        (err) => console.error("Failed to send release notifications:", err),
      );
    }

    return { reviewId: review.id };
  }

  /**
   * Return released reviews for a booking (0, 1, or 2), enriched with reviewer role.
   */
  static async getBookingReviews(params: {
    rentalId?: string;
    serviceBookingId?: string;
  }): Promise<(BlindReviewWithReviewer & { reviewerRole: string })[]> {
    const booking = await BlindReviewService.resolveBooking(params);
    const resolvedParams = {
      rentalId: booking.rentalId,
      serviceBookingId: booking.serviceBookingId,
    };
    const reviews = await blindReviewDAL.findReleasedByBooking(resolvedParams);

    // Map reviewer ID to their role in the booking
    const roleMap = new Map<string, string>();
    if (booking.type === "rental") {
      roleMap.set(booking.participantA, "Renter");
      roleMap.set(booking.participantB, "Owner");
    } else {
      roleMap.set(booking.participantA, "Client");
      roleMap.set(booking.participantB, "Provider");
    }

    return reviews.map((review) => ({
      ...review,
      reviewerRole: roleMap.get(review.reviewer.id) ?? "User",
    }));
  }

  /**
   * Return review status for the current user on a booking.
   * { hasReviewed, canReview, reviewWindowEndAt }
   */
  static async getReviewStatus(
    userId: string,
    params: { rentalId?: string; serviceBookingId?: string },
  ): Promise<{
    hasReviewed: boolean;
    canReview: boolean;
    reviewWindowEndAt: string | null;
  }> {
    let booking: ResolvedBooking;
    try {
      booking = await BlindReviewService.resolveBooking(params);
    } catch {
      // Booking not found or not completed — no review status
      return { hasReviewed: false, canReview: false, reviewWindowEndAt: null };
    }

    const isParticipant =
      userId === booking.participantA || userId === booking.participantB;
    if (!isParticipant) {
      return { hasReviewed: false, canReview: false, reviewWindowEndAt: null };
    }

    // Use the resolved booking IDs (not the raw params) because the detail
    // page may pass a rental-request ID while blind_reviews stores the rental ID.
    const resolvedParams = {
      rentalId: booking.rentalId,
      serviceBookingId: booking.serviceBookingId,
    };
    const existingReview = await blindReviewDAL.findByReviewerAndBooking(
      userId,
      resolvedParams,
    );
    const hasReviewed = existingReview !== null;
    const withinWindow = new Date() <= booking.reviewWindowEndAt;
    const canReview = !hasReviewed && withinWindow;

    return {
      hasReviewed,
      canReview,
      reviewWindowEndAt: booking.reviewWindowEndAt.toISOString(),
    };
  }

  /**
   * Paginated released reviews for a user + aggregate summary.
   * For profile display.
   */
  static async getUserReviews(
    revieweeId: string,
    options: { limit: number; offset: number },
  ): Promise<{
    reviews: PaginatedResult<BlindReviewWithReviewer>;
    aggregate: { averageRating: number; totalReviews: number };
  }> {
    const [reviews, aggregate] = await Promise.all([
      blindReviewDAL.findReleasedByReviewee(revieweeId, options),
      blindReviewDAL.getAggregate(revieweeId),
    ]);

    return { reviews, aggregate };
  }

  /**
   * Batch find unreleased expired reviews, release them, update aggregates, notify.
   * Called by cron endpoint.
   */
  static async releaseExpiredReviews(
    batchSize = 100,
  ): Promise<{ eligible: number; released: number; failed: number }> {
    const expired = await blindReviewDAL.findUnreleasedExpired(batchSize);

    if (expired.length === 0) {
      return { eligible: 0, released: 0, failed: 0 };
    }

    // Group by booking (rentalId or serviceBookingId)
    const bookingGroups = new Map<string, typeof expired>();
    for (const review of expired) {
      const key = review.rentalId ?? review.serviceBookingId!;
      const group = bookingGroups.get(key) ?? [];
      group.push(review);
      bookingGroups.set(key, group);
    }

    let released = 0;
    let failed = 0;

    for (const [, reviews] of bookingGroups) {
      try {
        const reviewIds = reviews.map((r) => r.id);
        await blindReviewDAL.releaseExpired(reviewIds);

        // Update aggregates for each reviewee in this group
        const revieweeIds = [...new Set(reviews.map((r) => r.revieweeId))];
        await Promise.all(
          revieweeIds.map((id) => userDAL.updateReviewAggregate(id)),
        );

        // Determine booking type from the first review
        const bookingType = reviews[0].rentalId ? "rental" : "service";

        // Notify (fire-and-forget)
        BlindReviewService.notifyReleasedReviews(reviews, bookingType).catch(
          (err) =>
            console.error("Failed to send cron release notifications:", err),
        );

        released += reviews.length;
      } catch (err) {
        console.error("Failed to release expired review group:", err);
        failed += reviews.length;
      }
    }

    return { eligible: expired.length, released, failed };
  }

  // ---- Private helpers ----

  /**
   * Resolve a booking reference to participants, completion date, and review window.
   * Validates booking exists and is completed.
   */
  private static async resolveBooking(params: {
    rentalId?: string;
    serviceBookingId?: string;
  }): Promise<ResolvedBooking> {
    if (params.rentalId) {
      return BlindReviewService.resolveRental(params.rentalId);
    }
    if (params.serviceBookingId) {
      return BlindReviewService.resolveServiceBooking(params.serviceBookingId);
    }
    throw new ValidationError(
      "Exactly one of rentalId or serviceBookingId is required",
    );
  }

  private static async resolveRental(
    rentalId: string,
  ): Promise<ResolvedBooking> {
    // Look up by rentals.id first, then fall back to rentals.requestId
    // (the detail page passes the request ID as the rental identifier)
    const [row] = await db
      .select({
        rentalId: rentals.id,
        renterId: rentals.renterId,
        ownerId: rentals.ownerId,
        returnConfirmedAt: rentals.returnConfirmedAt,
        requestStatus: rentalRequests.status,
      })
      .from(rentals)
      .innerJoin(rentalRequests, eq(rentalRequests.id, rentals.requestId))
      .where(or(eq(rentals.id, rentalId), eq(rentals.requestId, rentalId)))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Rental", rentalId);
    }

    if (row.requestStatus !== "completed") {
      throw new ValidationError(
        "Reviews can only be submitted for completed bookings",
      );
    }

    // Use returnConfirmedAt as the completion timestamp
    const completedAt = row.returnConfirmedAt;
    if (!completedAt) {
      throw new ValidationError(
        "Reviews can only be submitted for completed bookings",
      );
    }

    const reviewWindowEndAt = new Date(completedAt);
    reviewWindowEndAt.setDate(reviewWindowEndAt.getDate() + REVIEW_WINDOW_DAYS);

    return {
      type: "rental",
      rentalId: row.rentalId,
      participantA: row.renterId,
      participantB: row.ownerId,
      completedAt,
      reviewWindowEndAt,
    };
  }

  private static async resolveServiceBooking(
    serviceBookingId: string,
  ): Promise<ResolvedBooking> {
    const [row] = await db
      .select({
        id: serviceBookings.id,
        requesterId: serviceBookings.requesterId,
        providerId: serviceBookings.providerId,
        status: serviceBookings.status,
        completedAt: serviceBookings.completedAt,
      })
      .from(serviceBookings)
      .where(eq(serviceBookings.id, serviceBookingId))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Service booking", serviceBookingId);
    }

    if (row.status !== "completed") {
      throw new ValidationError(
        "Reviews can only be submitted for completed bookings",
      );
    }

    const completedAt = row.completedAt;
    if (!completedAt) {
      throw new ValidationError(
        "Reviews can only be submitted for completed bookings",
      );
    }

    const reviewWindowEndAt = new Date(completedAt);
    reviewWindowEndAt.setDate(reviewWindowEndAt.getDate() + REVIEW_WINDOW_DAYS);

    return {
      type: "service",
      serviceBookingId: row.id,
      participantA: row.requesterId,
      participantB: row.providerId,
      completedAt,
      reviewWindowEndAt,
    };
  }

  /**
   * Send "review received" notifications to each reviewee in a set of released reviews.
   */
  private static async notifyReleasedReviews(
    reviews: {
      reviewerId: string;
      revieweeId: string;
      rating: number;
      rentalId: string | null;
      serviceBookingId: string | null;
    }[],
    bookingType: "rental" | "service",
  ): Promise<void> {
    const userIds = [
      ...new Set(reviews.flatMap((r) => [r.reviewerId, r.revieweeId])),
    ];

    const userRows =
      userIds.length > 0
        ? await db
            .select({
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
            })
            .from(user)
            .where(inArray(user.id, userIds))
        : [];

    const userMap = new Map(
      userRows.map((u) => [
        u.id,
        `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "User",
      ]),
    );

    await Promise.allSettled(
      reviews.map((review) => {
        const bookingId = review.rentalId ?? review.serviceBookingId!;
        return sendReviewReleasedNotification({
          revieweeId: review.revieweeId,
          revieweeName: userMap.get(review.revieweeId) ?? "User",
          reviewerName: userMap.get(review.reviewerId) ?? "Someone",
          rating: review.rating,
          bookingType,
          bookingId,
        });
      }),
    );
  }
}
