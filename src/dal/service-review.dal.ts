import { count, desc, eq, sql } from "drizzle-orm";

import {
  serviceReviews,
  type NewServiceReview,
  type ServiceReview,
} from "@/db/schemas/service-reviews.schema";
import {
  serviceProviderProfiles,
  type ServiceProviderProfile,
} from "@/db/schemas/services.schema";
import { user } from "@/db/schemas/user.schema";

import { BaseDAL } from "./base";
import { ConflictError } from "./errors";

/** Insert payload for a service review (id / createdAt omitted). */
export type CreateReviewData = Omit<NewServiceReview, "id" | "createdAt">;

/** Review row with reviewer profile fields. */
export type ServiceReviewWithReviewer = ServiceReview & {
  reviewer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    email: string;
  };
};

/**
 * Data access for HOA service reviews and provider aggregate ratings.
 */
export class ServiceReviewDAL extends BaseDAL {
  /**
   * Inserts a review; unique (bookingId, reviewerId) surfaces as {@link ConflictError}.
   */
  async create(data: CreateReviewData): Promise<ServiceReview> {
    try {
      const [row] = await this.db
        .insert(serviceReviews)
        .values(data)
        .returning();

      if (!row) {
        throw new ConflictError("Failed to create service review");
      }

      return row;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "23505") {
        throw new ConflictError("A review for this booking already exists");
      }
      this.handleError(error, "ServiceReviewDAL.create");
    }
  }

  /**
   * All reviews for a listing with reviewer info.
   */
  async findByListing(listingId: string): Promise<ServiceReviewWithReviewer[]> {
    try {
      const rows = await this.db
        .select({
          review: serviceReviews,
          reviewer: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            email: user.email,
          },
        })
        .from(serviceReviews)
        .innerJoin(user, eq(serviceReviews.reviewerId, user.id))
        .where(eq(serviceReviews.listingId, listingId))
        .orderBy(desc(serviceReviews.createdAt));

      return rows.map((row) => ({
        ...row.review,
        reviewer: row.reviewer,
      }));
    } catch (error) {
      this.handleError(error, "ServiceReviewDAL.findByListing");
    }
  }

  /**
   * Up to two reviews for a booking (requester + provider), with reviewer info.
   */
  async findByBooking(bookingId: string): Promise<ServiceReviewWithReviewer[]> {
    try {
      const rows = await this.db
        .select({
          review: serviceReviews,
          reviewer: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            email: user.email,
          },
        })
        .from(serviceReviews)
        .innerJoin(user, eq(serviceReviews.reviewerId, user.id))
        .where(eq(serviceReviews.bookingId, bookingId))
        .orderBy(desc(serviceReviews.createdAt));

      return rows.map((row) => ({
        ...row.review,
        reviewer: row.reviewer,
      }));
    } catch (error) {
      this.handleError(error, "ServiceReviewDAL.findByBooking");
    }
  }

  /**
   * Reviews received by a provider (or other reviewee), newest first.
   *
   * @param revieweeId - User id of the reviewee
   * @param options - Optional result limit (default 50)
   */
  async findByReviewee(
    revieweeId: string,
    options?: { limit?: number },
  ): Promise<ServiceReviewWithReviewer[]> {
    try {
      const limit = options?.limit ?? 50;
      const rows = await this.db
        .select({
          review: serviceReviews,
          reviewer: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            email: user.email,
          },
        })
        .from(serviceReviews)
        .innerJoin(user, eq(serviceReviews.reviewerId, user.id))
        .where(eq(serviceReviews.revieweeId, revieweeId))
        .orderBy(desc(serviceReviews.createdAt))
        .limit(limit);

      return rows.map((row) => ({
        ...row.review,
        reviewer: row.reviewer,
      }));
    } catch (error) {
      this.handleError(error, "ServiceReviewDAL.findByReviewee");
    }
  }

  /**
   * Loads the HOA services provider profile row for a user, if present.
   *
   * @param userId - User id
   */
  async getProviderProfileByUserId(
    userId: string,
  ): Promise<ServiceProviderProfile | null> {
    try {
      const [row] = await this.db
        .select()
        .from(serviceProviderProfiles)
        .where(eq(serviceProviderProfiles.userId, userId))
        .limit(1);

      return row ?? null;
    } catch (error) {
      this.handleError(error, "ServiceReviewDAL.getProviderProfileByUserId");
    }
  }

  /**
   * Inserts or updates the provider bio for HOA services marketplace.
   *
   * @param userId - Provider user id
   * @param bio - Sanitized bio text or null to clear
   */
  async upsertProviderBio(
    userId: string,
    bio: string | null,
  ): Promise<ServiceProviderProfile> {
    try {
      const [row] = await this.db
        .insert(serviceProviderProfiles)
        .values({
          userId,
          bio,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: serviceProviderProfiles.userId,
          set: {
            bio,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!row) {
        throw new Error("Failed to upsert service provider profile");
      }

      return row;
    } catch (error) {
      this.handleError(error, "ServiceReviewDAL.upsertProviderBio");
    }
  }

  /**
   * Average rating and count for all service reviews where the user is the reviewee.
   */
  async calculateProviderAggregateRating(
    providerId: string,
  ): Promise<{ average: number; count: number }> {
    try {
      const [row] = await this.db
        .select({
          avg: sql<string | null>`avg(${serviceReviews.rating})`,
          cnt: count(),
        })
        .from(serviceReviews)
        .where(eq(serviceReviews.revieweeId, providerId));

      const total = Number(row?.cnt ?? 0);
      const average =
        total > 0 && row?.avg != null ? Number.parseFloat(row.avg) : 0;

      return {
        average: Number.isFinite(average) ? average : 0,
        count: total,
      };
    } catch (error) {
      this.handleError(
        error,
        "ServiceReviewDAL.calculateProviderAggregateRating",
      );
    }
  }

  /**
   * Recomputes aggregate rating from reviews and upserts {@link serviceProviderProfiles}.
   */
  async updateProviderAggregateRating(providerId: string): Promise<void> {
    try {
      const { average, count: reviewCount } =
        await this.calculateProviderAggregateRating(providerId);

      const aggregateRating = reviewCount > 0 ? average.toFixed(2) : null;

      await this.db
        .insert(serviceProviderProfiles)
        .values({
          userId: providerId,
          aggregateRating,
          reviewCount,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: serviceProviderProfiles.userId,
          set: {
            aggregateRating,
            reviewCount,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      this.handleError(error, "ServiceReviewDAL.updateProviderAggregateRating");
    }
  }
}
