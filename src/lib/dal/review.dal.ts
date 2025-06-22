import { eq } from "drizzle-orm";
import { reviews } from "@/db/schemas/rentals.schema";
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
}
