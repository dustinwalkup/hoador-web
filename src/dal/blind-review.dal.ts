import {
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  sql,
  lte,
  inArray,
  count,
  avg,
} from "drizzle-orm";
import {
  blindReviews,
  type BlindReview,
} from "@/db/schemas/blind-reviews.schema";
import { user } from "@/db/schemas/user.schema";
import { BaseDAL } from "./base";
import { ConflictError } from "./errors";
import type { PaginatedResult } from "./types";

/** Shape returned when review includes reviewer display info. */
export interface BlindReviewWithReviewer {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: Date;
  releasedAt: Date;
  reviewer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export class BlindReviewDAL extends BaseDAL {
  /**
   * Insert a new blind review with releasedAt = null.
   * Throws ConflictError on duplicate (unique index violation).
   */
  async create(data: {
    rentalId?: string;
    serviceBookingId?: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment?: string | null;
    reviewWindowEndAt: Date;
  }): Promise<BlindReview> {
    try {
      const [review] = await this.db
        .insert(blindReviews)
        .values({
          rentalId: data.rentalId ?? null,
          serviceBookingId: data.serviceBookingId ?? null,
          reviewerId: data.reviewerId,
          revieweeId: data.revieweeId,
          rating: data.rating,
          comment: data.comment ?? null,
          reviewWindowEndAt: data.reviewWindowEndAt,
        })
        .returning();

      return review;
    } catch (error) {
      // Provide a more specific message for the unique constraint violation
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ConflictError(
          "You have already submitted a review for this booking",
        );
      }
      this.handleError(error, "BlindReviewDAL.create");
    }
  }

  /**
   * All reviews for a booking (regardless of release status).
   * Used internally by the service layer for release checks.
   */
  async findByBooking(params: {
    rentalId?: string;
    serviceBookingId?: string;
  }): Promise<BlindReview[]> {
    try {
      const condition = params.rentalId
        ? eq(blindReviews.rentalId, params.rentalId)
        : eq(blindReviews.serviceBookingId, params.serviceBookingId!);

      return await this.db.select().from(blindReviews).where(condition);
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.findByBooking");
    }
  }

  /**
   * Released reviews with reviewer display info (name, avatar).
   * WHERE releasedAt IS NOT NULL AND releasedAt <= now()
   */
  async findReleasedByBooking(params: {
    rentalId?: string;
    serviceBookingId?: string;
  }): Promise<BlindReviewWithReviewer[]> {
    try {
      const bookingCondition = params.rentalId
        ? eq(blindReviews.rentalId, params.rentalId)
        : eq(blindReviews.serviceBookingId, params.serviceBookingId!);

      const rows = await this.db
        .select({
          id: blindReviews.id,
          rating: blindReviews.rating,
          comment: blindReviews.comment,
          submittedAt: blindReviews.submittedAt,
          releasedAt: blindReviews.releasedAt,
          reviewerId: blindReviews.reviewerId,
        })
        .from(blindReviews)
        .where(
          and(
            bookingCondition,
            isNotNull(blindReviews.releasedAt),
            lte(blindReviews.releasedAt, sql`now()`),
          ),
        );

      if (rows.length === 0) return [];

      // Fetch reviewer display info
      const reviewerIds = [...new Set(rows.map((r) => r.reviewerId))];
      const reviewers = await this.db
        .select({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        })
        .from(user)
        .where(inArray(user.id, reviewerIds));

      const reviewerMap = new Map(reviewers.map((r) => [r.id, r]));

      return rows.map((row) => {
        const reviewer = reviewerMap.get(row.reviewerId);
        return {
          id: row.id,
          rating: row.rating,
          comment: row.comment,
          submittedAt: row.submittedAt,
          releasedAt: row.releasedAt!,
          reviewer: {
            id: row.reviewerId,
            name: reviewer
              ? `${reviewer.firstName ?? ""} ${reviewer.lastName ?? ""}`.trim()
              : "Unknown",
            avatarUrl: reviewer?.profileImageUrl ?? null,
          },
        };
      });
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.findReleasedByBooking");
    }
  }

  /**
   * Single review lookup for duplicate/status checks.
   */
  async findByReviewerAndBooking(
    reviewerId: string,
    params: { rentalId?: string; serviceBookingId?: string },
  ): Promise<BlindReview | null> {
    try {
      const bookingCondition = params.rentalId
        ? eq(blindReviews.rentalId, params.rentalId)
        : eq(blindReviews.serviceBookingId, params.serviceBookingId!);

      const [review] = await this.db
        .select()
        .from(blindReviews)
        .where(and(eq(blindReviews.reviewerId, reviewerId), bookingCondition))
        .limit(1);

      return review ?? null;
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.findByReviewerAndBooking");
    }
  }

  /**
   * Paginated released reviews for a user — for profile display.
   * Only released reviews, newest first.
   * Optional context filter: "rental" or "service" to scope by booking type.
   */
  async findReleasedByReviewee(
    revieweeId: string,
    options: {
      limit: number;
      offset: number;
      context?: "rental" | "service";
    },
  ): Promise<PaginatedResult<BlindReviewWithReviewer>> {
    try {
      const page = Math.floor(options.offset / options.limit) + 1;
      this.validatePagination(page, options.limit);

      const contextCondition =
        options.context === "rental"
          ? isNotNull(blindReviews.rentalId)
          : options.context === "service"
            ? isNotNull(blindReviews.serviceBookingId)
            : undefined;

      const whereCondition = and(
        eq(blindReviews.revieweeId, revieweeId),
        isNotNull(blindReviews.releasedAt),
        lte(blindReviews.releasedAt, sql`now()`),
        contextCondition,
      );

      // Get total count
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(blindReviews)
        .where(whereCondition);

      // Get paginated rows
      const rows = await this.db
        .select({
          id: blindReviews.id,
          rating: blindReviews.rating,
          comment: blindReviews.comment,
          submittedAt: blindReviews.submittedAt,
          releasedAt: blindReviews.releasedAt,
          reviewerId: blindReviews.reviewerId,
        })
        .from(blindReviews)
        .where(whereCondition)
        .orderBy(desc(blindReviews.releasedAt))
        .limit(options.limit)
        .offset(options.offset);

      // Fetch reviewer display info
      let reviews: BlindReviewWithReviewer[] = [];
      if (rows.length > 0) {
        const reviewerIds = [...new Set(rows.map((r) => r.reviewerId))];
        const reviewers = await this.db
          .select({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          })
          .from(user)
          .where(inArray(user.id, reviewerIds));

        const reviewerMap = new Map(reviewers.map((r) => [r.id, r]));

        reviews = rows.map((row) => {
          const reviewer = reviewerMap.get(row.reviewerId);
          return {
            id: row.id,
            rating: row.rating,
            comment: row.comment,
            submittedAt: row.submittedAt,
            releasedAt: row.releasedAt!,
            reviewer: {
              id: row.reviewerId,
              name: reviewer
                ? `${reviewer.firstName ?? ""} ${reviewer.lastName ?? ""}`.trim()
                : "Unknown",
              avatarUrl: reviewer?.profileImageUrl ?? null,
            },
          };
        });
      }

      return this.createPaginatedResult(reviews, total, page, options.limit);
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.findReleasedByReviewee");
    }
  }

  /**
   * AVG(rating) and COUNT(*) WHERE revieweeId AND releasedAt IS NOT NULL.
   * Optional context filter: "rental" or "service" to scope by booking type.
   */
  async getAggregate(
    revieweeId: string,
    context?: "rental" | "service",
  ): Promise<{ averageRating: number; totalReviews: number }> {
    try {
      const contextCondition =
        context === "rental"
          ? isNotNull(blindReviews.rentalId)
          : context === "service"
            ? isNotNull(blindReviews.serviceBookingId)
            : undefined;

      const [result] = await this.db
        .select({
          averageRating: avg(blindReviews.rating),
          totalReviews: count(),
        })
        .from(blindReviews)
        .where(
          and(
            eq(blindReviews.revieweeId, revieweeId),
            isNotNull(blindReviews.releasedAt),
            contextCondition,
          ),
        );

      return {
        averageRating: result.averageRating
          ? Number(Number(result.averageRating).toFixed(2))
          : 0,
        totalReviews: result.totalReviews,
      };
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.getAggregate");
    }
  }

  /**
   * SET releasedAt = now() WHERE id IN (reviewIds) AND releasedAt IS NULL.
   * Used for immediate release when both parties submit.
   */
  async releaseReviews(reviewIds: string[]): Promise<void> {
    try {
      if (reviewIds.length === 0) return;

      await this.db
        .update(blindReviews)
        .set({ releasedAt: sql`now()` })
        .where(
          and(
            inArray(blindReviews.id, reviewIds),
            isNull(blindReviews.releasedAt),
          ),
        );
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.releaseReviews");
    }
  }

  /**
   * WHERE releasedAt IS NULL AND reviewWindowEndAt <= now().
   * Uses partial index for efficient lookup. LIMIT for batch processing.
   */
  async findUnreleasedExpired(limit: number): Promise<BlindReview[]> {
    try {
      return await this.db
        .select()
        .from(blindReviews)
        .where(
          and(
            isNull(blindReviews.releasedAt),
            lte(blindReviews.reviewWindowEndAt, sql`now()`),
          ),
        )
        .limit(limit);
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.findUnreleasedExpired");
    }
  }

  /**
   * SET releasedAt = reviewWindowEndAt for given IDs.
   * Used by cron — sets releasedAt to the window end time, not now().
   */
  async releaseExpired(reviewIds: string[]): Promise<void> {
    try {
      if (reviewIds.length === 0) return;

      await this.db
        .update(blindReviews)
        .set({ releasedAt: blindReviews.reviewWindowEndAt })
        .where(inArray(blindReviews.id, reviewIds));
    } catch (error) {
      this.handleError(error, "BlindReviewDAL.releaseExpired");
    }
  }
}
