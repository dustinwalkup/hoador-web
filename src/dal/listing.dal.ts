import {
  eq,
  asc,
  and,
  desc,
  isNull,
  gte,
  lte,
  inArray,
  ilike,
  or,
  count,
} from "drizzle-orm";
import { sql } from "drizzle-orm";

import { BaseDAL } from "./base";
import {
  type CreateListingDTO,
  type ListingDetails,
  type UpdateListingDTO,
  type ListingSearchFilters,
  type PaginationOptions,
  type PaginatedResult,
} from "./types";
import { schema } from "@/db/schemas";
import { getCurrentUserId } from "@/features/auth/utils/session";
import {
  getCurrentUserCommunityId,
  requireCommunityMembership,
} from "@/features/community/utils/membership";
import { NotFoundError, UnauthorizedError } from "./errors";

const {
  listings,
  listingCategories,
  reviews,
  listingAvailability,
  userFavorites,
  listingImages,
  user,
} = schema;

type ListingDb = typeof listings.$inferSelect;
type OwnerDb = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  createdAt: Date;
};
type CategoryDb = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
};
type ReviewerDb = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
};
type ReviewDb = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date;
  reviewer: ReviewerDb;
};
type AvailabilityDb = {
  id: string;
  startDate: Date;
  endDate: Date;
  isBlocked: boolean;
  reason: string | null;
};

interface ListingWithRelations extends ListingDb {
  owner: OwnerDb;
  category: CategoryDb;
  reviews: ReviewDb[];
  availability: AvailabilityDb[];
  images: Array<{
    id: string;
    imageUrl: string;
    orderIndex: number;
  }>;
}

// Type for the transformed listing data returned by getUserlistings
export type UserListing = Omit<
  typeof listings.$inferSelect,
  "dailyRate" | "weeklyRate" | "monthlyRate" | "securityDeposit" | "deliveryFee"
> & {
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  securityDeposit: number;
  deliveryFee: number;
  averageRating: number;
  reviewCount: number;
  firstImageUrl: string | null;
};

export interface GarageListingFilters {
  query?: string;
  categoryId?: string;
  sortBy?: "newest" | "name" | "lastRented";
  sortOrder?: "asc" | "desc";
  rentalStatus?: "available" | "rented"; // Only for active listings
}

export class ListingDAL extends BaseDAL {
  async createListing(
    listingData: CreateListingDTO,
  ): Promise<typeof listings.$inferSelect> {
    try {
      // Get current user and their community membership
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      const userCommunityInfo = await requireCommunityMembership();

      const [listing] = await this.db
        .insert(listings)
        .values({
          ownerId: userId,
          communityId: userCommunityInfo.community.id,
          categoryId: listingData.categoryId,
          name: listingData.name,
          description: listingData.description,
          brand: listingData.brand,
          model: listingData.model,
          condition: listingData.condition,
          dailyRate: listingData.dailyRate.toString(),
          weeklyRate: listingData.weeklyRate?.toString(),
          monthlyRate: listingData.monthlyRate?.toString(),
          securityDeposit: (listingData.securityDeposit || 0).toString(),
          specifications: listingData.specifications || {},
          instructions: listingData.instructions,
          safetyNotes: listingData.safetyNotes,
          minimumRentalPeriod: listingData.minimumRentalPeriod || 1,
          maximumRentalPeriod: listingData.maximumRentalPeriod || 30,
          requiresPickup: listingData.requiresPickup ?? true,
          deliveryAvailable: listingData.deliveryAvailable ?? false,
          deliveryFee: (listingData.deliveryFee || 0).toString(),
          deliveryRadius: listingData.deliveryRadius || 0,
        })
        .returning();
      return listing;
    } catch (error) {
      this.handleError(error, "createListing");
    }
  }

  async getListingById(id: string, userId?: string): Promise<ListingDetails> {
    try {
      const listing = (await this.db.query.listings.findFirst({
        where: eq(listings.id, id),
        with: {
          owner: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              createdAt: true,
            },
          },
          category: {
            columns: {
              id: true,
              name: true,
              description: true,
              icon: true,
            },
          },
          reviews: {
            columns: {
              id: true,
              rating: true,
              title: true,
              comment: true,
              createdAt: true,
            },
            with: {
              reviewer: {
                columns: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profileImageUrl: true,
                },
              },
            },
            orderBy: [desc(reviews.createdAt)],
            limit: 10,
          },
          availability: {
            columns: {
              id: true,
              startDate: true,
              endDate: true,
              isBlocked: true,
              reason: true,
            },
            orderBy: [asc(listingAvailability.startDate)],
          },
        },
      })) as ListingWithRelations | undefined;

      // Get images separately since they're not in the main query
      const images = await this.db
        .select({
          id: listingImages.id,
          imageUrl: listingImages.imageUrl,
          orderIndex: listingImages.orderIndex,
        })
        .from(listingImages)
        .where(eq(listingImages.listingId, id))
        .orderBy(listingImages.orderIndex);

      if (!listing) {
        throw new NotFoundError("listing", id);
      }

      // Get owner reviews separately to calculate rating
      const ownerReviews: Array<{ rating: number }> =
        await this.db.query.reviews.findMany({
          where: eq(reviews.revieweeId, listing.ownerId),
          columns: {
            rating: true,
          },
        });

      // Calculate average rating for listing
      const listingRatings = listing.reviews.map((r: ReviewDb) => r.rating);
      const averageRating =
        listingRatings.length > 0
          ? listingRatings.reduce((a: number, b: number) => a + b, 0) /
            listingRatings.length
          : 0;

      // Calculate owner rating
      const ownerRatings = ownerReviews.map((r) => r.rating);
      const ownerAverageRating =
        ownerRatings.length > 0
          ? ownerRatings.reduce((a: number, b: number) => a + b, 0) /
            ownerRatings.length
          : 0;

      // Check if user has favorited this listing
      let isFavorited = false;
      if (userId) {
        const favorite = await this.db.query.userFavorites.findFirst({
          where: and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.listingId, id),
          ),
        });
        isFavorited = !!favorite;
      }

      // Increment view count (only if not the owner)
      if (userId && userId !== listing.ownerId) {
        await this.db
          .update(listings)
          .set({ viewCount: sql`${listings.viewCount} + 1` })
          .where(eq(listings.id, id));
      }

      return {
        id: listing.id,
        name: listing.name,
        description: listing.description,
        brand: listing.brand || undefined,
        model: listing.model || undefined,
        condition: listing.condition,
        dailyRate: Number(listing.dailyRate),
        weeklyRate: listing.weeklyRate ? Number(listing.weeklyRate) : undefined,
        monthlyRate: listing.monthlyRate
          ? Number(listing.monthlyRate)
          : undefined,
        securityDeposit: Number(listing.securityDeposit),
        status: listing.status,
        specifications: listing.specifications,
        instructions: listing.instructions || undefined,
        safetyNotes: listing.safetyNotes || undefined,
        minimumRentalPeriod: listing.minimumRentalPeriod,
        maximumRentalPeriod: listing.maximumRentalPeriod,
        requiresPickup: listing.requiresPickup,
        deliveryAvailable: listing.deliveryAvailable,
        deliveryFee: Number(listing.deliveryFee),
        deliveryRadius: listing.deliveryRadius,
        viewCount: listing.viewCount,
        favoriteCount: listing.favoriteCount,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount: listingRatings.length,
        isFavorited,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        owner: {
          id: listing.owner.id,
          firstName: listing.owner.firstName,
          lastName: listing.owner.lastName,
          profileImageUrl: listing.owner.profileImageUrl || undefined,
          averageRating: Math.round(ownerAverageRating * 10) / 10,
          reviewCount: ownerRatings.length,
          memberSince: listing.owner.createdAt,
        },
        category: {
          id: listing.category.id,
          name: listing.category.name,
          icon: listing.category.icon || undefined,
        },
        reviews: listing.reviews.map((review: ReviewDb) => ({
          id: review.id,
          rating: review.rating,
          title: review.title || undefined,
          comment: review.comment || undefined,
          createdAt: review.createdAt,
          reviewer: {
            id: review.reviewer.id,
            firstName: review.reviewer.firstName,
            lastName: review.reviewer.lastName,
            profileImageUrl: review.reviewer.profileImageUrl || undefined,
          },
        })),
        images: images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          orderIndex: img.orderIndex || 0,
        })),
        availability: listing.availability.map((avail: AvailabilityDb) => ({
          id: avail.id,
          startDate: avail.startDate,
          endDate: avail.endDate,
          isBlocked: avail.isBlocked,
          reason: avail.reason || undefined,
        })),
      };
    } catch (error) {
      this.handleError(error, "getListingById");
    }
  }

  async updateListing(
    id: string,
    updates: UpdateListingDTO,
  ): Promise<ListingDetails> {
    try {
      // Get current user and their community
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Verify ownership and community membership
      const listing = await this.db.query.listings.findFirst({
        where: and(eq(listings.id, id), eq(listings.ownerId, userId)),
        columns: { ownerId: true, communityId: true },
      });

      if (!listing) {
        throw new NotFoundError("Listing not found or access denied");
      }

      // Convert numeric fields to strings for database
      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date(),
      };
      if (updates.dailyRate !== undefined)
        updateData.dailyRate = updates.dailyRate.toString();
      if (updates.weeklyRate !== undefined)
        updateData.weeklyRate = updates.weeklyRate.toString();
      if (updates.monthlyRate !== undefined)
        updateData.monthlyRate = updates.monthlyRate.toString();
      if (updates.securityDeposit !== undefined)
        updateData.securityDeposit = updates.securityDeposit.toString();
      if (updates.deliveryFee !== undefined)
        updateData.deliveryFee = updates.deliveryFee.toString();

      const [updatedListing] = await this.db
        .update(listings)
        .set(updateData)
        .where(eq(listings.id, id))
        .returning();

      if (!updatedListing) {
        throw new NotFoundError("Listing", id);
      }

      return this.getListingById(id, userId);
    } catch (error) {
      this.handleError(error, "updateListing");
    }
  }

  async updateListingStatus(
    id: string,
    status: "available" | "rented" | "maintenance" | "inactive",
  ): Promise<typeof listings.$inferSelect> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Verify ownership
      const listing = await this.db.query.listings.findFirst({
        where: eq(listings.id, id),
        columns: { ownerId: true },
      });

      if (!listing) {
        throw new NotFoundError("Listing", id);
      }

      if (listing.ownerId !== userId) {
        throw new UnauthorizedError("You can only update your own listings");
      }

      const [updatedListing] = await this.db
        .update(listings)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, id))
        .returning();

      if (!updatedListing) {
        throw new NotFoundError("listing", id);
      }

      return updatedListing;
    } catch (error) {
      this.handleError(error, "updateListingStatus");
    }
  }

  async deleteListing(id: string): Promise<void> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Verify ownership
      const listing = await this.db.query.listings.findFirst({
        where: eq(listings.id, id),
        columns: { ownerId: true },
      });

      if (!listing) {
        throw new NotFoundError("Listing not found or access denied");
      }

      const result = await this.db
        .delete(listings)
        .where(eq(listings.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError("Listing", id);
      }
    } catch (error) {
      this.handleError(error, "deleteListing");
    }
  }

  async searchListings(
    filters: ListingSearchFilters,
    pagination: PaginationOptions,
    currentUserId?: string,
  ): Promise<PaginatedResult<UserListing>> {
    try {
      this.validatePagination(pagination.page, pagination.limit);

      const offset = (pagination.page - 1) * pagination.limit;

      // Get current user's community - required for community scoping
      const userId = currentUserId || (await getCurrentUserId());
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      const userCommunityId = await getCurrentUserCommunityId();
      if (!userCommunityId) {
        throw new UnauthorizedError("User must be a member of a community");
      }

      // Build the where conditions
      const whereConditions = [
        eq(listings.status, "available"),
        eq(listings.isActive, true),
        eq(listings.communityId, userCommunityId), // Only show listings from user's community
      ];

      // Text search
      if (filters.query) {
        whereConditions.push(
          or(
            ilike(listings.name, `%${filters.query}%`),
            ilike(listings.description, `%${filters.query}%`),
            ilike(listings.brand, `%${filters.query}%`),
            ilike(listings.model, `%${filters.query}%`),
          )!,
        );
      }

      // Category filter
      if (filters.categoryId) {
        whereConditions.push(eq(listings.categoryId, filters.categoryId));
      }

      // Price filters
      if (filters.minPrice !== undefined) {
        whereConditions.push(
          gte(listings.dailyRate, filters.minPrice.toString()),
        );
      }
      if (filters.maxPrice !== undefined) {
        whereConditions.push(
          lte(listings.dailyRate, filters.maxPrice.toString()),
        );
      }

      // Condition filter
      if (filters.condition && filters.condition.length > 0) {
        whereConditions.push(inArray(listings.condition, filters.condition));
      }

      // Delivery filter
      if (filters.deliveryAvailable) {
        whereConditions.push(eq(listings.deliveryAvailable, true));
      }

      // Exclude current user's listings
      whereConditions.push(sql`${listings.ownerId} != ${userId}`);

      // Get total count
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(listings)
        .innerJoin(
          listingCategories,
          eq(listings.categoryId, listingCategories.id),
        )
        .innerJoin(user, eq(listings.ownerId, user.id))
        .where(and(...whereConditions));

      // Build the order by clause
      let orderByClause = [];

      if (filters.sortBy) {
        switch (filters.sortBy) {
          case "price":
            orderByClause = [
              filters.sortOrder === "desc"
                ? desc(listings.dailyRate)
                : asc(listings.dailyRate),
            ];
            break;
          case "newest":
            orderByClause = [desc(listings.createdAt)];
            break;
          case "rating":
            // We'll handle rating sorting in the post-processing since it requires aggregation
            orderByClause = [desc(listings.favoriteCount)];
            break;
          default:
            orderByClause = [desc(listings.createdAt)];
        }
      } else {
        orderByClause = [desc(listings.createdAt)];
      }

      // Get the listings with relations
      const listingsWithRelations = await this.db
        .select({
          listing: listings,
          category: {
            id: listingCategories.id,
            name: listingCategories.name,
            icon: listingCategories.icon,
          },
          owner: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          },
        })
        .from(listings)
        .innerJoin(
          listingCategories,
          eq(listings.categoryId, listingCategories.id),
        )
        .innerJoin(user, eq(listings.ownerId, user.id))
        .where(and(...whereConditions))
        .orderBy(...orderByClause)
        .limit(pagination.limit)
        .offset(offset);

      // Get first image for each listing (matching getUserlistings pattern)
      const listingIds = listingsWithRelations.map((t) => t.listing.id);
      const listingImagesMap = new Map<string, string>();

      if (listingIds.length > 0) {
        // Get first image for each listing individually to match getUserlistings behavior
        for (const listingId of listingIds) {
          const firstImage = await this.db
            .select({ imageUrl: listingImages.imageUrl })
            .from(listingImages)
            .where(
              and(
                eq(listingImages.listingId, listingId),
                eq(listingImages.orderIndex, 0),
              ),
            )
            .limit(1);

          if (firstImage[0]?.imageUrl) {
            listingImagesMap.set(listingId, firstImage[0].imageUrl);
          }
        }
      }

      // Get reviews for rating calculation
      const reviewsData = await this.db
        .select({
          listingId: reviews.listingId,
          rating: reviews.rating,
        })
        .from(reviews)
        .where(inArray(reviews.listingId, listingIds));

      // Calculate ratings per listing
      const ratingsMap = new Map<
        string,
        { averageRating: number; reviewCount: number }
      >();

      for (const review of reviewsData) {
        if (!ratingsMap.has(review.listingId)) {
          ratingsMap.set(review.listingId, {
            averageRating: 0,
            reviewCount: 0,
          });
        }
        const current = ratingsMap.get(review.listingId)!;
        current.averageRating =
          (current.averageRating * current.reviewCount + review.rating) /
          (current.reviewCount + 1);
        current.reviewCount++;
      }

      // Transform to Userlisting format
      const transformedListings: UserListing[] = listingsWithRelations.map(
        (item) => {
          const listingRating = ratingsMap.get(item.listing.id) || {
            averageRating: 0,
            reviewCount: 0,
          };

          return {
            ...item.listing,
            dailyRate: Number(item.listing.dailyRate),
            weeklyRate: item.listing.weeklyRate
              ? Number(item.listing.weeklyRate)
              : undefined,
            monthlyRate: item.listing.monthlyRate
              ? Number(item.listing.monthlyRate)
              : undefined,
            securityDeposit: Number(item.listing.securityDeposit),
            deliveryFee: Number(item.listing.deliveryFee),
            averageRating: Math.round(listingRating.averageRating * 10) / 10,
            reviewCount: listingRating.reviewCount,
            firstImageUrl: listingImagesMap.get(item.listing.id) || null,
          };
        },
      );

      // Handle rating sorting post-processing
      if (filters.sortBy === "rating") {
        transformedListings.sort((a, b) => {
          const aRating = a.averageRating;
          const bRating = b.averageRating;
          return filters.sortOrder === "desc"
            ? bRating - aRating
            : aRating - bRating;
        });
      }

      return this.createPaginatedResult(
        transformedListings,
        total,
        pagination.page,
        pagination.limit,
      );
    } catch (error) {
      this.handleError(error, "searchListings");
    }
  }

  /**
   * Get listings owned by a user
   * @param userId - The user ID
   * @param status - Optional status filter
   * @returns Array of listings with computed averageRating and reviewCount
   */
  async getUserListings(
    userId: string,
    status?: string,
  ): Promise<UserListing[]> {
    try {
      const whereConditions = [eq(listings.ownerId, userId)];

      if (status) {
        whereConditions.push(
          eq(
            listings.status,
            status as "available" | "rented" | "maintenance" | "inactive",
          ),
        );
      }

      // Get listings without any relations to avoid circular reference issues
      const userListings = await this.db
        .select()
        .from(listings)
        .where(and(...whereConditions))
        .orderBy(desc(listings.createdAt));

      // Get reviews separately to calculate ratings
      const listingsWithRating = await Promise.all(
        userListings.map(async (listing) => {
          const listingReviews = await this.db.query.reviews.findMany({
            where: eq(reviews.listingId, listing.id),
            columns: {
              rating: true,
            },
          });

          // Get the first image for this listing
          const firstImage = await this.db
            .select({ imageUrl: listingImages.imageUrl })
            .from(listingImages)
            .where(
              and(
                eq(listingImages.listingId, listing.id),
                eq(listingImages.orderIndex, 0),
              ),
            )
            .limit(1);

          const ratings = listingReviews.map((r) => r.rating);
          const averageRating =
            ratings.length > 0
              ? ratings.reduce((a: number, b: number) => a + b, 0) /
                ratings.length
              : 0;

          return {
            ...listing,
            dailyRate: Number(listing.dailyRate),
            weeklyRate: listing.weeklyRate
              ? Number(listing.weeklyRate)
              : undefined,
            monthlyRate: listing.monthlyRate
              ? Number(listing.monthlyRate)
              : undefined,
            securityDeposit: Number(listing.securityDeposit),
            deliveryFee: Number(listing.deliveryFee),
            averageRating: Math.round(averageRating * 10) / 10,
            reviewCount: ratings.length,
            firstImageUrl: firstImage[0]?.imageUrl || null,
          } as UserListing;
        }),
      );

      return listingsWithRating;
    } catch (error) {
      this.handleError(error, "getUserListings");
    }
  }

  /**
   * Get active listings owned by a user with search, sort, and filter options
   * @param userId - The user ID
   * @param filters - Optional filters for search, sort, and filtering
   * @returns Array of active listings with computed averageRating and reviewCount
   */
  async getUserActiveListingsWithFilters(
    userId: string,
    filters: GarageListingFilters = {},
  ): Promise<UserListing[]> {
    try {
      const baseConditions = [
        eq(listings.ownerId, userId),
        eq(listings.isActive, true),
        or(eq(listings.status, "available"), eq(listings.status, "rented")),
      ];

      return this._getUserListingsWithFilters(baseConditions, filters);
    } catch (error) {
      this.handleError(error, "getUserActiveListingsWithFilters");
    }
  }

  /**
   * Get active listings owned by a user (available or rented status, and isActive = true)
   * @param userId - The user ID
   * @returns Array of active listings with computed averageRating and reviewCount
   */
  async getUserActiveListings(userId: string): Promise<UserListing[]> {
    try {
      const whereConditions = [
        eq(listings.ownerId, userId),
        eq(listings.isActive, true),
        or(eq(listings.status, "available"), eq(listings.status, "rented")),
      ];

      return this._getUserListingsWithConditions(whereConditions);
    } catch (error) {
      this.handleError(error, "getUserActiveListings");
    }
  }

  /**
   * Get inactive listings owned by a user with search, sort, and filter options
   * @param userId - The user ID
   * @param filters - Optional filters for search, sort, and filtering
   * @returns Array of inactive listings with computed averageRating and reviewCount
   */
  async getUserInactiveListingsWithFilters(
    userId: string,
    filters: GarageListingFilters = {},
  ): Promise<UserListing[]> {
    try {
      const baseConditions = [
        eq(listings.ownerId, userId),
        eq(listings.isActive, true),
        or(eq(listings.status, "maintenance"), eq(listings.status, "inactive")),
      ];

      return this._getUserListingsWithFilters(baseConditions, filters);
    } catch (error) {
      this.handleError(error, "getUserInactiveListingsWithFilters");
    }
  }

  /**
   * Get inactive listings owned by a user (maintenance or inactive status, and isActive = true)
   * @param userId - The user ID
   * @returns Array of inactive listings with computed averageRating and reviewCount
   */
  async getUserInactiveListings(userId: string): Promise<UserListing[]> {
    try {
      const whereConditions = [
        eq(listings.ownerId, userId),
        eq(listings.isActive, true),
        or(eq(listings.status, "maintenance"), eq(listings.status, "inactive")),
      ];

      return this._getUserListingsWithConditions(whereConditions);
    } catch (error) {
      this.handleError(error, "getUserInactiveListings");
    }
  }

  /**
   * Get archived listings owned by a user with search, sort, and filter options
   * @param userId - The user ID
   * @param filters - Optional filters for search, sort, and filtering
   * @returns Array of archived listings with computed averageRating and reviewCount
   */
  async getUserArchivedListingsWithFilters(
    userId: string,
    filters: GarageListingFilters = {},
  ): Promise<UserListing[]> {
    try {
      const baseConditions = [
        eq(listings.ownerId, userId),
        eq(listings.isActive, false),
      ];

      return this._getUserListingsWithFilters(baseConditions, filters);
    } catch (error) {
      this.handleError(error, "getUserArchivedListingsWithFilters");
    }
  }

  /**
   * Private helper method to get user listings with specific conditions and filters
   * @param baseConditions - Base where conditions
   * @param filters - Search, sort, and filter options
   * @returns Array of listings with computed averageRating and reviewCount
   */
  private async _getUserListingsWithFilters(
    baseConditions: Parameters<typeof and>,
    filters: GarageListingFilters = {},
  ): Promise<UserListing[]> {
    try {
      const whereConditions = [...baseConditions];

      // Add search filter
      if (filters.query) {
        whereConditions.push(
          or(
            ilike(listings.name, `%${filters.query}%`),
            ilike(listings.description, `%${filters.query}%`),
            ilike(listings.brand, `%${filters.query}%`),
            ilike(listings.model, `%${filters.query}%`),
          )!,
        );
      }

      // Add category filter
      if (filters.categoryId) {
        whereConditions.push(eq(listings.categoryId, filters.categoryId));
      }

      // Add rental status filter (only applicable for active listings)
      if (filters.rentalStatus) {
        if (filters.rentalStatus === "available") {
          whereConditions.push(eq(listings.status, "available"));
        } else if (filters.rentalStatus === "rented") {
          whereConditions.push(eq(listings.status, "rented"));
        }
      }

      // Build sort order
      let orderByClause: (ReturnType<typeof asc> | ReturnType<typeof desc>)[] =
        [];
      const sortBy = filters.sortBy || "newest";
      const sortOrder = filters.sortOrder || "desc";

      switch (sortBy) {
        case "name":
          orderByClause = [
            sortOrder === "asc" ? asc(listings.name) : desc(listings.name),
          ];
          break;
        case "lastRented":
          // For now, sort by updatedAt as a proxy for last rental activity
          // TODO: Add actual lastRentedAt field to schema
          orderByClause = [
            sortOrder === "asc"
              ? asc(listings.updatedAt)
              : desc(listings.updatedAt),
          ];
          break;
        case "newest":
        default:
          orderByClause = [
            sortOrder === "asc"
              ? asc(listings.createdAt)
              : desc(listings.createdAt),
          ];
          break;
      }

      // Get listings without any relations to avoid circular reference issues
      const userListings = await this.db
        .select()
        .from(listings)
        .where(and(...whereConditions))
        .orderBy(...orderByClause);

      // Get reviews separately to calculate ratings
      const listingsWithRating = await Promise.all(
        userListings.map(async (listing) => {
          const listingReviews = await this.db.query.reviews.findMany({
            where: eq(reviews.listingId, listing.id),
            columns: {
              rating: true,
            },
          });

          // Get the first image for this listing
          const firstImage = await this.db
            .select({ imageUrl: listingImages.imageUrl })
            .from(listingImages)
            .where(
              and(
                eq(listingImages.listingId, listing.id),
                eq(listingImages.orderIndex, 0),
              ),
            )
            .limit(1);

          const ratings = listingReviews.map((r) => r.rating);
          const averageRating =
            ratings.length > 0
              ? ratings.reduce((a: number, b: number) => a + b, 0) /
                ratings.length
              : 0;

          return {
            ...listing,
            dailyRate: Number(listing.dailyRate),
            weeklyRate: listing.weeklyRate
              ? Number(listing.weeklyRate)
              : undefined,
            monthlyRate: listing.monthlyRate
              ? Number(listing.monthlyRate)
              : undefined,
            securityDeposit: Number(listing.securityDeposit),
            deliveryFee: Number(listing.deliveryFee),
            averageRating: Math.round(averageRating * 10) / 10,
            reviewCount: ratings.length,
            firstImageUrl: firstImage[0]?.imageUrl || null,
          } as UserListing;
        }),
      );

      return listingsWithRating;
    } catch (error) {
      this.handleError(error, "_getUserListingsWithFilters");
    }
  }

  /**
   * Private helper method to get user listings with specific conditions
   * @param whereConditions - Array of where conditions
   * @returns Array of listings with computed averageRating and reviewCount
   */
  private async _getUserListingsWithConditions(
    whereConditions: Parameters<typeof and>,
  ): Promise<UserListing[]> {
    try {
      // Get listings without any relations to avoid circular reference issues
      const userListings = await this.db
        .select()
        .from(listings)
        .where(and(...whereConditions))
        .orderBy(desc(listings.createdAt));

      // Get reviews separately to calculate ratings
      const listingsWithRating = await Promise.all(
        userListings.map(async (listing) => {
          const listingReviews = await this.db.query.reviews.findMany({
            where: eq(reviews.listingId, listing.id),
            columns: {
              rating: true,
            },
          });

          // Get the first image for this listing
          const firstImage = await this.db
            .select({ imageUrl: listingImages.imageUrl })
            .from(listingImages)
            .where(
              and(
                eq(listingImages.listingId, listing.id),
                eq(listingImages.orderIndex, 0),
              ),
            )
            .limit(1);

          const ratings = listingReviews.map((r) => r.rating);
          const averageRating =
            ratings.length > 0
              ? ratings.reduce((a: number, b: number) => a + b, 0) /
                ratings.length
              : 0;

          return {
            ...listing,
            dailyRate: Number(listing.dailyRate),
            weeklyRate: listing.weeklyRate
              ? Number(listing.weeklyRate)
              : undefined,
            monthlyRate: listing.monthlyRate
              ? Number(listing.monthlyRate)
              : undefined,
            securityDeposit: Number(listing.securityDeposit),
            deliveryFee: Number(listing.deliveryFee),
            averageRating: Math.round(averageRating * 10) / 10,
            reviewCount: ratings.length,
            firstImageUrl: firstImage[0]?.imageUrl || null,
          } as UserListing;
        }),
      );

      return listingsWithRating;
    } catch (error) {
      this.handleError(error, "_getUserListingsWithConditions");
    }
  }

  /**
   * Get archived listings owned by a user (isActive = false)
   * @param userId - The user ID
   * @returns Array of archived listings with computed averageRating and reviewCount
   */
  async getUserArchivedListings(userId: string): Promise<UserListing[]> {
    try {
      const whereConditions = [
        eq(listings.ownerId, userId),
        eq(listings.isActive, false),
      ];

      return this._getUserListingsWithConditions(whereConditions);
    } catch (error) {
      this.handleError(error, "getUserArchivedListings");
    }
  }

  async getListingCategories(): Promise<
    (typeof listingCategories.$inferSelect)[]
  > {
    try {
      const categories = await this.db.query.listingCategories.findMany({
        where: and(
          eq(listingCategories.isActive, true),
          isNull(listingCategories.parentId),
        ),
        orderBy: [
          asc(listingCategories.sortOrder),
          asc(listingCategories.name),
        ],
      });

      return categories;
    } catch (error) {
      this.handleError(error, "getListingCategories");
    }
  }

  // async toggleListingFavorite(userId: string, listingId: string): Promise<boolean> {
  //   try {
  //     const existing = await this.db.query.userFavorites.findFirst({
  //       where: and(
  //         eq(userFavorites.userId, userId),
  //         eq(userFavorites.listingId, listingId),
  //       ),
  //     });

  //     if (existing) {
  //       // Remove favorite
  //       await this.db
  //         .delete(userFavorites)
  //         .where(eq(userFavorites.id, existing.id));

  //       // Decrement favorite count
  //       await this.db
  //         .update(listings)
  //         .set({ favoriteCount: sql`${listings.favoriteCount} - 1` })
  //         .where(eq(listings.id, listingId));

  //       return false;
  //     } else {
  //       // Add favorite
  //       await this.db.insert(userFavorites).values({ userId, listingId });

  //       // Increment favorite count
  //       await this.db
  //         .update(listings)
  //         .set({ favoriteCount: sql`${listings.favoriteCount} + 1` })
  //         .where(eq(listings.id, listingId));

  //       return true;
  //     }
  //   } catch (error) {
  //     this.handleError(error, "toggleListingFavorite");
  //   }
  // }

  // async getUserFavorites(
  //   userId: string,
  //   options: PaginationOptions,
  // ): Promise<PaginatedResult<any>> {
  //   try {
  //     this.validatePagination(options.page, options.limit);

  //     const offset = (options.page - 1) * options.limit;

  //     // Get total count
  //     const [{ total }] = await this.db
  //       .select({ total: count() })
  //       .from(userFavorites)
  //       .where(eq(userFavorites.userId, userId));

  //     // Get favorites
  //     const favorites = await this.db.query.userFavorites.findMany({
  //       where: eq(userFavorites.userId, userId),
  //       with: {
  //         listing: {
  //           with: {
  //             owner: {
  //               columns: {
  //                 id: true,
  //                 firstName: true,
  //                 lastName: true,
  //                 profileImageUrl: true,
  //               },
  //             },
  //             category: {
  //               columns: {
  //                 id: true,
  //                 name: true,
  //                 icon: true,
  //               },
  //             },
  //             reviews: {
  //               columns: {
  //                 rating: true,
  //               },
  //             },
  //           },
  //         },
  //       },
  //       orderBy: [desc(userFavorites.createdAt)],
  //       limit: options.limit,
  //       offset,
  //     });

  //     const favoritesWithRating = favorites.map((favorite) => {
  //       const ratings = favorite.listing.reviews.map((r: any) => r.rating);
  //       const averageRating =
  //         ratings.length > 0
  //           ? ratings.reduce((a: number, b: number) => a + b, 0) /
  //             ratings.length
  //           : 0;

  //       return {
  //         ...favorite,
  //         listing: {
  //           ...favorite.listing,
  //           dailyRate: Number(favorite.listing.dailyRate),
  //           weeklyRate: favorite.listing.weeklyRate
  //             ? Number(favorite.listing.weeklyRate)
  //             : undefined,
  //           monthlyRate: favorite.listing.monthlyRate
  //             ? Number(favorite.listing.monthlyRate)
  //             : undefined,
  //           securityDeposit: Number(favorite.listing.securityDeposit),
  //           deliveryFee: Number(favorite.listing.deliveryFee),
  //           averageRating: Math.round(averageRating * 10) / 10,
  //           reviewCount: ratings.length,
  //         },
  //       };
  //     });

  //     return this.createPaginatedResult(
  //       favoritesWithRating,
  //       total,
  //       options.page,
  //       options.limit,
  //     );
  //   } catch (error) {
  //     this.handleError(error, "getUserFavorites");
  //   }
  // }
}
