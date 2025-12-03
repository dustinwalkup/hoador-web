import { eq, desc, count, inArray } from "drizzle-orm";
import { reviews, rentals, rentalRequests } from "@/db/schemas/rentals.schema";
import { user } from "@/db/schemas/user.schema";
import { listings } from "@/db/schemas/listings.schema";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { BaseDAL } from "./base";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "./errors";
import { tryCatch } from "@walkup/walkup-utils";

export class ReviewDAL extends BaseDAL {
  async getSummaryForUser(userId: string) {
    const ratings = await this.db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));

    const total = ratings.length;
    const avg =
      total > 0
        ? ratings.reduce((acc, { rating }) => acc + rating, 0) / total
        : 0;

    return {
      averageRating: Number(avg.toFixed(1)),
      totalReviews: total,
    };
  }

  async getRatingDistribution(userId: string) {
    const distribution = await this.db
      .select({
        rating: reviews.rating,
        count: count(),
      })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId))
      .groupBy(reviews.rating)
      .orderBy(reviews.rating);

    // Create a complete distribution (1-5 stars)
    const completeDistribution = [];
    for (let i = 1; i <= 5; i++) {
      const found = distribution.find((d) => d.rating === i);
      completeDistribution.push({
        rating: i,
        count: found?.count || 0,
      });
    }

    return completeDistribution;
  }

  async getReviewsCount(userId: string) {
    const result = await this.db
      .select({ count: count() })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));

    return result[0]?.count || 0;
  }

  async getRecentReviews(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: "createdAt" | "rating";
      sortOrder?: "asc" | "desc";
    } = {},
  ) {
    const {
      limit = 10,
      offset = 0,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    // Build order by clause
    const orderByClause =
      sortOrder === "asc"
        ? sortBy === "rating"
          ? reviews.rating
          : reviews.createdAt
        : sortBy === "rating"
          ? desc(reviews.rating)
          : desc(reviews.createdAt);

    const userReviews = await this.db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        title: reviews.title,
        createdAt: reviews.createdAt,
        reviewerId: reviews.reviewerId,
        listingId: reviews.listingId,
        accuracyRating: reviews.accuracyRating,
        listingConditionRating: reviews.listingConditionRating,
        ownerCommunicationRating: reviews.ownerCommunicationRating,
      })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get reviewer and listing details separately
    const reviewerIds = [...new Set(userReviews.map((r) => r.reviewerId))];
    const listingIds = [...new Set(userReviews.map((r) => r.listingId))];

    // Handle empty arrays to avoid SQL errors
    const [reviewers, listingDetails] = await Promise.all([
      reviewerIds.length > 0
        ? this.db
            .select({
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImageUrl: user.profileImageUrl,
            })
            .from(user)
            .where(inArray(user.id, reviewerIds))
        : [],
      listingIds.length > 0
        ? this.db
            .select({
              id: listings.id,
              name: listings.name,
            })
            .from(listings)
            .where(inArray(listings.id, listingIds))
        : [],
    ]);

    return userReviews.map((review) => {
      const reviewer = reviewers.find((r) => r.id === review.reviewerId);
      const listing = listingDetails.find((t) => t.id === review.listingId);

      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        title: review.title,
        createdAt: review.createdAt,
        accuracyRating: review.accuracyRating,
        listingConditionRating: review.listingConditionRating,
        ownerCommunicationRating: review.ownerCommunicationRating,
        reviewer: reviewer
          ? {
              id: reviewer.id,
              name: `${reviewer.firstName} ${reviewer.lastName}`,
              avatarUrl: reviewer.profileImageUrl || null,
            }
          : null,
        listing: listing
          ? {
              id: listing.id,
              name: listing.name,
            }
          : null,
      };
    });
  }

  async getUserReviewsSummary() {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const [summary, distribution, recentReviews] = await Promise.all([
      this.getSummaryForUser(userId),
      this.getRatingDistribution(userId),
      this.getRecentReviews(userId, { limit: 3 }),
    ]);

    return {
      summary,
      distribution,
      recentReviews,
    };
  }

  /**
   * Get review by rental ID
   */
  async getReviewByRentalId(rentalId: string) {
    const { data: result, error } = await tryCatch(
      this.db
        .select({
          id: reviews.id,
          rentalId: reviews.rentalId,
          reviewerId: reviews.reviewerId,
          revieweeId: reviews.revieweeId,
          listingId: reviews.listingId,
          rating: reviews.rating,
          title: reviews.title,
          comment: reviews.comment,
          accuracyRating: reviews.accuracyRating,
          listingConditionRating: reviews.listingConditionRating,
          ownerCommunicationRating: reviews.ownerCommunicationRating,
          isOwnerReview: reviews.isOwnerReview,
          isPublic: reviews.isPublic,
          helpfulCount: reviews.helpfulCount,
          createdAt: reviews.createdAt,
          updatedAt: reviews.updatedAt,
        })
        .from(reviews)
        .where(eq(reviews.rentalId, rentalId))
        .limit(1),
    );

    if (error) {
      console.error("Error fetching review by rental ID:", error);
      // Extract more details from the error
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to fetch review";

      // Check if it's a database connection or table issue
      if (
        errorMessage.includes("Failed query") ||
        errorMessage.includes("relation") ||
        errorMessage.includes("does not exist")
      ) {
        throw new Error(
          `Database error: ${errorMessage}. This might indicate a connection issue or missing table/columns.`,
        );
      }

      throw error;
    }

    if (!result || result.length === 0 || !result[0]) {
      return null;
    }

    const reviewData = result[0];

    // Get reviewer details
    const { data: reviewer, error: reviewerError } = await tryCatch(
      this.db.query.user.findFirst({
        where: eq(user.id, reviewData.reviewerId),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
        },
      }),
    );

    if (reviewerError) {
      console.error("Error fetching reviewer details:", reviewerError);
      // Return review without reviewer details if fetch fails
      return {
        ...reviewData,
        reviewer: null,
      };
    }

    return {
      ...reviewData,
      reviewer: reviewer
        ? {
            id: reviewer.id,
            firstName: reviewer.firstName,
            lastName: reviewer.lastName,
            profileImageUrl: reviewer.profileImageUrl,
          }
        : null,
    };
  }

  /**
   * Get review by rental request ID (finds rental first, then review)
   */
  async getReviewByRequestId(requestId: string) {
    // Find the rental record for this request
    const rentalRecord = await this.db
      .select({ id: rentals.id })
      .from(rentals)
      .where(eq(rentals.requestId, requestId))
      .limit(1);

    if (!rentalRecord[0]) {
      return null;
    }

    // Get review for this rental
    return await this.getReviewByRentalId(rentalRecord[0].id);
  }

  /**
   * Check if user can leave a review for a rental
   */
  async canLeaveReview(
    rentalId: string,
    userId: string,
  ): Promise<{
    canLeave: boolean;
    reason?: string;
  }> {
    // Get rental with request status
    const rentalData = await this.db
      .select({
        rentalId: rentals.id,
        renterId: rentals.renterId,
        ownerId: rentals.ownerId,
        damageReported: rentals.damageReported,
        requestStatus: rentalRequests.status,
      })
      .from(rentals)
      .innerJoin(rentalRequests, eq(rentalRequests.id, rentals.requestId))
      .where(eq(rentals.id, rentalId))
      .limit(1);

    if (!rentalData[0]) {
      return { canLeave: false, reason: "Rental not found" };
    }

    const rental = rentalData[0];

    // Check if user is the renter
    if (rental.renterId !== userId) {
      return { canLeave: false, reason: "Only the renter can leave a review" };
    }

    // Check if rental status is completed
    if (rental.requestStatus !== "completed") {
      return {
        canLeave: false,
        reason: "Reviews can only be left for completed rentals",
      };
    }

    // Check if damage is reported (dispute exists)
    if (rental.damageReported) {
      return {
        canLeave: false,
        reason: "Reviews cannot be left when damage is reported",
      };
    }

    // Check if review already exists
    const existingReview = await this.getReviewByRentalId(rentalId);
    if (existingReview) {
      return {
        canLeave: false,
        reason: "Review already exists for this rental",
      };
    }

    return { canLeave: true };
  }

  /**
   * Create a review for a completed rental
   * Accepts either rentalId (rentals.id) or requestId (rental_requests.id)
   */
  async createReview(data: {
    rentalId?: string;
    requestId?: string;
    rating: number;
    comment: string;
    accuracyRating?: number;
    listingConditionRating?: number;
    ownerCommunicationRating?: number;
  }) {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new UnauthorizedError("Authentication required");
    }

    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new ValidationError("Rating must be between 1 and 5");
    }

    // Validate optional ratings
    if (
      data.accuracyRating !== undefined &&
      (data.accuracyRating < 1 || data.accuracyRating > 5)
    ) {
      throw new ValidationError("Accuracy rating must be between 1 and 5");
    }

    if (
      data.listingConditionRating !== undefined &&
      (data.listingConditionRating < 1 || data.listingConditionRating > 5)
    ) {
      throw new ValidationError(
        "Listing condition rating must be between 1 and 5",
      );
    }

    if (
      data.ownerCommunicationRating !== undefined &&
      (data.ownerCommunicationRating < 1 || data.ownerCommunicationRating > 5)
    ) {
      throw new ValidationError(
        "Owner communication rating must be between 1 and 5",
      );
    }

    // Find the rental ID if requestId is provided
    let actualRentalId: string;
    if (data.requestId) {
      const rentalRecord = await this.db
        .select({ id: rentals.id })
        .from(rentals)
        .where(eq(rentals.requestId, data.requestId))
        .limit(1);

      if (!rentalRecord[0]) {
        throw new NotFoundError("Rental", data.requestId);
      }

      actualRentalId = rentalRecord[0].id;
    } else if (data.rentalId) {
      actualRentalId = data.rentalId;
    } else {
      throw new ValidationError("Either rentalId or requestId is required");
    }

    // Check if user can leave review
    const canLeave = await this.canLeaveReview(actualRentalId, userId);
    if (!canLeave.canLeave) {
      throw new ValidationError(canLeave.reason || "Cannot leave review");
    }

    // Get rental details
    const rentalData = await this.db
      .select({
        renterId: rentals.renterId,
        ownerId: rentals.ownerId,
        listingId: rentals.listingId,
      })
      .from(rentals)
      .where(eq(rentals.id, actualRentalId))
      .limit(1);

    if (!rentalData[0]) {
      throw new NotFoundError("Rental", actualRentalId);
    }

    const rental = rentalData[0];

    // Verify user is the renter
    if (rental.renterId !== userId) {
      throw new UnauthorizedError("Only the renter can leave a review");
    }

    // Check if review already exists
    const existingReview = await this.getReviewByRentalId(actualRentalId);
    if (existingReview) {
      throw new ConflictError("Review already exists for this rental");
    }

    // Create review
    const { data: review, error } = await tryCatch(
      this.db
        .insert(reviews)
        .values({
          rentalId: actualRentalId,
          reviewerId: userId,
          revieweeId: rental.ownerId,
          listingId: rental.listingId,
          rating: data.rating,
          comment: data.comment,
          isOwnerReview: false, // Renter reviewing owner/listing
          accuracyRating: data.accuracyRating || null,
          listingConditionRating: data.listingConditionRating || null,
          ownerCommunicationRating: data.ownerCommunicationRating || null,
        })
        .returning(),
    );

    if (error) {
      console.error("Error creating review:", error);
      throw error;
    }

    return review[0];
  }
}
