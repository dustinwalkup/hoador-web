import { eq, desc, count, inArray } from "drizzle-orm";
import { reviews } from "@/db/schemas/rentals.schema";
import { users } from "@/db/schemas/users.schema";
import { tools } from "@/db/schemas/tools.schema";
import { getCurrentUserId } from "@/features/authentication/auth.utils";
import { BaseDAL } from "./base";

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
        toolId: reviews.toolId,
      })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get reviewer and tool details separately
    const reviewerIds = [...new Set(userReviews.map((r) => r.reviewerId))];
    const toolIds = [...new Set(userReviews.map((r) => r.toolId))];

    // Handle empty arrays to avoid SQL errors
    const [reviewers, toolDetails] = await Promise.all([
      reviewerIds.length > 0
        ? this.db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              profileImageUrl: users.profileImageUrl,
            })
            .from(users)
            .where(inArray(users.id, reviewerIds))
        : [],
      toolIds.length > 0
        ? this.db
            .select({
              id: tools.id,
              name: tools.name,
            })
            .from(tools)
            .where(inArray(tools.id, toolIds))
        : [],
    ]);

    return userReviews.map((review) => {
      const reviewer = reviewers.find((r) => r.id === review.reviewerId);
      const tool = toolDetails.find((t) => t.id === review.toolId);

      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        title: review.title,
        createdAt: review.createdAt,
        reviewer: reviewer
          ? {
              id: reviewer.id,
              name: `${reviewer.firstName} ${reviewer.lastName}`,
              avatarUrl: reviewer.profileImageUrl,
            }
          : null,
        tool: tool
          ? {
              id: tool.id,
              name: tool.name,
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
}
