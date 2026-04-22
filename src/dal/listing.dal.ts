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
  type PendingReviewListing,
  type ReviewedListing,
} from "./types";
import { schema } from "@/db/schemas";
import { NotFoundError, ValidationError } from "./errors";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";

const {
  listings,
  listingCategories,
  listingAvailability,
  userFavorites,
  listingImages,
  user,
  userAddresses,
  rentals,
  rentalRequests,
  reviewEvents,
} = schema;

function appendReviewScalar(
  existing: string | null | undefined,
  next: string,
  label: string,
): string {
  const trimmed = next.trim();
  if (!trimmed) return existing ?? "";

  const timestamp = new Date().toISOString();
  const nextChunk = `${label} (${timestamp}): ${trimmed}`;

  if (!existing || existing.trim().length === 0) return nextChunk;
  return `${existing}\n\n---\n${nextChunk}`;
}

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
  | "dailyRate"
  | "weeklyRate"
  | "monthlyRate"
  | "securityDeposit"
  | "deliveryFee"
  | "setupFee"
> & {
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  securityDeposit: number;
  deliveryFee: number;
  setupFee: number;
  averageRating: number;
  reviewCount: number;
  firstImageUrl: string | null;
  distanceMiles?: number;
  approvalStatus?: "pending_review" | "approved" | "rejected";
  rejectionReason?: string | null;
};

export interface GarageListingFilters {
  query?: string;
  categoryId?: string;
  sortBy?: "newest" | "name" | "lastRented";
  sortOrder?: "asc" | "desc";
  rentalStatus?: "available" | "rented"; // Only for active listings
}

export class ListingDAL extends BaseDAL {
  // Cache for user locations to avoid repeated queries
  private userLocationCache = new Map<
    string,
    typeof userAddresses.$inferSelect
  >();

  // Helper method for building conditional SELECT with distance calculation
  private buildSelectFields(
    includeDistance: boolean,
    userLocation?: typeof userAddresses.$inferSelect | null,
  ) {
    const baseFields = {
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
        reviewAggregateRating: user.reviewAggregateRating,
        reviewCount: user.reviewCount,
      },
      ownerAddress: {
        latitude: userAddresses.latitude,
        longitude: userAddresses.longitude,
      },
    };

    if (includeDistance && userLocation?.latitude && userLocation?.longitude) {
      return {
        ...baseFields,
        calculatedDistance: sql<number>`
              ST_Distance(
                ST_Point(${userLocation.longitude}::float, ${userLocation.latitude}::float)::geography,
                ST_Point(${userAddresses.longitude}::float, ${userAddresses.latitude}::float)::geography
              ) / 1609.34
            `.as("distance_miles"),
      };
    }

    return baseFields;
  }

  // Helper method for building ORDER BY clause
  private buildOrderByClause(
    filters: ListingSearchFilters,
    hasDistanceCalculation: boolean,
  ) {
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case "price":
          return [
            filters.sortOrder === "desc"
              ? desc(listings.dailyRate)
              : asc(listings.dailyRate),
          ];
        case "newest":
          return [desc(listings.createdAt)];
        case "rating":
          // Still handled in post-processing due to aggregation complexity
          return [desc(listings.favoriteCount)];
        case "distance":
          if (hasDistanceCalculation) {
            // Use the calculated distance field from SELECT
            return [
              filters.sortOrder === "desc"
                ? sql`distance_miles DESC NULLS LAST`
                : sql`distance_miles ASC NULLS LAST`,
            ];
          } else {
            // Fallback if no user location
            return [desc(listings.createdAt)];
          }
        default:
          return [desc(listings.createdAt)];
      }
    }
    return [desc(listings.createdAt)];
  }

  // Helper method to get user's primary address with caching
  private async getUserPrimaryAddress(userId: string) {
    if (this.userLocationCache.has(userId)) {
      return this.userLocationCache.get(userId)!;
    }

    // Try primary address first, fallback to any address
    let address = await this.db.query.userAddresses.findFirst({
      where: and(
        eq(userAddresses.userId, userId),
        eq(userAddresses.isPrimary, true),
      ),
    });

    // If no primary address, use any address
    if (!address) {
      address = await this.db.query.userAddresses.findFirst({
        where: eq(userAddresses.userId, userId),
      });
    }

    if (address) {
      this.userLocationCache.set(userId, address);
      // Clear cache after 5 minutes
      setTimeout(() => this.userLocationCache.delete(userId), 5 * 60 * 1000);
    }

    return address || null;
  }

  async createListing(
    listingData: CreateListingDTO,
    userId: string,
    communityId: string,
  ): Promise<typeof listings.$inferSelect> {
    try {
      // Sanitize text fields
      const sanitizedName = sanitizeTextWithMaxLength(listingData.name, 200);
      const sanitizedDescription = sanitizeTextWithMaxLength(
        listingData.description,
        2000,
      );
      const sanitizedBrand = listingData.brand
        ? sanitizeTextWithMaxLength(listingData.brand, 100)
        : undefined;
      const sanitizedModel = listingData.model
        ? sanitizeTextWithMaxLength(listingData.model, 100)
        : undefined;
      const sanitizedInstructions = listingData.instructions
        ? sanitizeTextWithMaxLength(listingData.instructions, 2000)
        : undefined;
      const sanitizedSafetyNotes = listingData.safetyNotes
        ? sanitizeTextWithMaxLength(listingData.safetyNotes, 2000)
        : undefined;

      const [listing] = await this.db
        .insert(listings)
        .values({
          ownerId: userId,
          communityId: communityId,
          categoryId: listingData.categoryId,
          name: sanitizedName,
          description: sanitizedDescription,
          brand: sanitizedBrand,
          model: sanitizedModel,
          condition: listingData.condition,
          dailyRate: listingData.dailyRate.toString(),
          weeklyRate: listingData.weeklyRate?.toString(),
          monthlyRate: listingData.monthlyRate?.toString(),
          securityDeposit: (listingData.securityDeposit || 0).toString(),
          specifications: listingData.specifications || {},
          instructions: sanitizedInstructions,
          safetyNotes: sanitizedSafetyNotes,
          minimumRentalPeriod: listingData.minimumRentalPeriod || 1,
          maximumRentalPeriod: listingData.maximumRentalPeriod || 30,
          deliveryMode: listingData.deliveryMode ?? "pickup_only",
          deliveryFee: (listingData.deliveryFee || 0).toString(),
          deliveryRadius: listingData.deliveryRadius || 0,
          setupAvailable: listingData.setupAvailable ?? false,
          setupFee: (listingData.setupFee || 0).toString(),
          status: "inactive", // New listings start as inactive until approved
          approvalStatus: "pending_review", // New listings require admin approval
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

      // Get owner's review aggregate from user table
      const ownerUser = await this.db.query.user.findFirst({
        where: eq(user.id, listing.ownerId),
        columns: {
          reviewAggregateRating: true,
          reviewCount: true,
        },
      });
      const ownerAverageRating = ownerUser?.reviewAggregateRating
        ? Number(ownerUser.reviewAggregateRating)
        : 0;
      const ownerReviewCount = ownerUser?.reviewCount ?? 0;

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

      // Get owner's primary address
      const ownerAddress = await this.getUserPrimaryAddress(listing.ownerId);

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
        deliveryMode: listing.deliveryMode,
        deliveryFee: Number(listing.deliveryFee),
        deliveryRadius: listing.deliveryRadius,
        setupAvailable: listing.setupAvailable,
        setupFee: Number(listing.setupFee),
        viewCount: listing.viewCount,
        favoriteCount: listing.favoriteCount,
        averageRating: Math.round(ownerAverageRating * 10) / 10,
        reviewCount: ownerReviewCount,
        isFavorited,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        owner: {
          id: listing.owner.id,
          firstName: listing.owner.firstName,
          lastName: listing.owner.lastName,
          profileImageUrl: listing.owner.profileImageUrl || undefined,
          averageRating: Math.round(ownerAverageRating * 10) / 10,
          reviewCount: ownerReviewCount,
          memberSince: listing.owner.createdAt,
          address: ownerAddress
            ? {
                city: ownerAddress.city,
                state: ownerAddress.state,
              }
            : undefined,
        },
        category: {
          id: listing.category.id,
          name: listing.category.name,
          icon: listing.category.icon || undefined,
        },
        reviews: [],
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
    userId: string,
  ): Promise<ListingDetails> {
    try {
      // Get current listing state
      const currentListing = await this.db.query.listings.findFirst({
        where: eq(listings.id, id),
        columns: {
          ownerId: true,
          communityId: true,
          approvalStatus: true,
          name: true,
          description: true,
          categoryId: true,
          condition: true,
          dailyRate: true,
          weeklyRate: true,
          monthlyRate: true,
        },
      });

      if (!currentListing) {
        throw new NotFoundError("Listing", id);
      }

      // Get current images for comparison
      const currentImagesData = await this.db
        .select({
          id: listingImages.id,
          imageUrl: listingImages.imageUrl,
          orderIndex: listingImages.orderIndex,
        })
        .from(listingImages)
        .where(eq(listingImages.listingId, id))
        .orderBy(listingImages.orderIndex);

      // Map to ensure orderIndex is always a number
      const currentImages = currentImagesData.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        orderIndex: img.orderIndex || 0,
      }));

      // Check if significant changes were made
      const hasSignificantChanges = this.hasSignificantChanges(
        {
          name: currentListing.name,
          description: currentListing.description,
          categoryId: currentListing.categoryId,
          condition: currentListing.condition,
          dailyRate: Number(currentListing.dailyRate),
          weeklyRate: currentListing.weeklyRate
            ? Number(currentListing.weeklyRate)
            : undefined,
          monthlyRate: currentListing.monthlyRate
            ? Number(currentListing.monthlyRate)
            : undefined,
        },
        updates,
        currentImages,
        // New images would need to be passed if available, but for now we'll check based on updates
        undefined,
      );

      // Sanitize text fields if provided
      if (updates.name !== undefined) {
        updates.name = sanitizeTextWithMaxLength(updates.name, 200);
      }
      if (updates.description !== undefined) {
        updates.description = sanitizeTextWithMaxLength(
          updates.description,
          2000,
        );
      }
      if (updates.brand !== undefined && updates.brand !== null) {
        updates.brand = sanitizeTextWithMaxLength(updates.brand, 100);
      }
      if (updates.model !== undefined && updates.model !== null) {
        updates.model = sanitizeTextWithMaxLength(updates.model, 100);
      }
      if (updates.instructions !== undefined && updates.instructions !== null) {
        updates.instructions = sanitizeTextWithMaxLength(
          updates.instructions,
          2000,
        );
      }
      if (updates.safetyNotes !== undefined && updates.safetyNotes !== null) {
        updates.safetyNotes = sanitizeTextWithMaxLength(
          updates.safetyNotes,
          2000,
        );
      }

      // Convert numeric fields to strings for database
      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date(),
      };

      // Handle approval status reset based on listing state:
      // - Approved listings: significant edits require re-review
      // - Rejected listings: ANY edit resubmits for review (owner is fixing issues)
      let didResubmit = false;
      if (currentListing.approvalStatus === "rejected") {
        // Rejected listings reset to pending_review on any edit
        // This allows owners to fix issues and resubmit
        updateData.approvalStatus = "pending_review";
        didResubmit = true;
      } else if (
        hasSignificantChanges &&
        currentListing.approvalStatus === "approved"
      ) {
        // Approved listings only reset on significant changes
        updateData.approvalStatus = "pending_review";
        didResubmit = true;
      }
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
      if (updates.setupFee !== undefined)
        updateData.setupFee = updates.setupFee.toString();

      const [updatedListing] = await this.db
        .update(listings)
        .set(updateData)
        .where(eq(listings.id, id))
        .returning();

      if (!updatedListing) {
        throw new NotFoundError("Listing", id);
      }

      if (didResubmit) {
        await this.db.insert(reviewEvents).values({
          entityKind: "tool_listing",
          entityId: id,
          eventType: "provider_resubmitted",
          actorUserId: userId,
          note: null,
        });
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
      // Fetch blob pathnames before cascade delete removes the image records
      const images = await this.db
        .select({ blobPathname: listingImages.blobPathname })
        .from(listingImages)
        .where(eq(listingImages.listingId, id));

      const result = await this.db
        .delete(listings)
        .where(eq(listings.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError("Listing", id);
      }

      // Clean up blob storage in the background (don't block the response)
      if (images.length > 0) {
        const { deleteFromBlob } = await import("@/services/vercel-blob");
        Promise.allSettled(
          images.map((img) => deleteFromBlob(img.blobPathname)),
        ).then((results) => {
          const failed = results.filter((r) => r.status === "rejected");
          if (failed.length > 0) {
            console.error(
              `Failed to delete ${failed.length} blob images for listing ${id}`,
            );
          }
        });
      }
    } catch (error) {
      this.handleError(error, "deleteListing");
    }
  }

  async searchListings(
    filters: ListingSearchFilters,
    pagination: PaginationOptions,
    userId: string,
    communityId: string,
    isAdmin: boolean,
    skipDistance = false, // Internal parameter to skip distance calculations
  ): Promise<PaginatedResult<UserListing>> {
    try {
      this.validatePagination(pagination.page, pagination.limit);

      const offset = (pagination.page - 1) * pagination.limit;

      // Get user location for distance calculations (unless skipped for fallback)
      const userLocation = skipDistance
        ? null
        : await this.getUserPrimaryAddress(userId);

      // Determine if we need distance calculation in SELECT and ORDER BY
      const needsDistanceSort = filters.sortBy === "distance" && !skipDistance;
      const hasUserLocation =
        !skipDistance && !!userLocation?.latitude && !!userLocation?.longitude;

      // Note: Distance calculation setup complete

      // Build the where conditions
      // Default: show both "available" and "rented" listings
      // When availableNow filter is enabled, show only "available"
      const statusFilter = filters.availableNow
        ? eq(listings.status, "available")
        : inArray(listings.status, ["available", "rented"]);

      const whereConditions = [
        statusFilter,
        eq(listings.isActive, true),
        eq(listings.communityId, communityId), // Only show listings from user's community
      ];

      // Filter by approval status based on user type
      // Only approved listings should appear in search results
      // Users can see their own pending listings in garage, but not in search
      // Admins can see all listings regardless of approval status
      // Only apply approval status filter if user is not admin
      if (!isAdmin) {
        // All non-admin users (including listing owners) only see approved listings in search
        whereConditions.push(eq(listings.approvalStatus, "approved"));
      }
      // Admins can see all listings, so no approval status filter needed

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
      if (filters.deliveryMode && filters.deliveryMode !== "pickup_only") {
        whereConditions.push(
          inArray(listings.deliveryMode, ["delivery_only", "both_available"]),
        );
      }

      // Setup filter
      if (filters.setupAvailable) {
        console.log(
          "************* APPLYING SETUP FILTER *************",
          filters.setupAvailable,
        );
        whereConditions.push(eq(listings.setupAvailable, true));
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

      // Build the order by clause using helper method
      const hasDistanceCalculation = needsDistanceSort && hasUserLocation;
      const orderByClause = this.buildOrderByClause(
        filters,
        hasDistanceCalculation,
      );

      // Always include distance in SELECT if user has location (for display on cards)
      const includeDistanceInSelect = hasUserLocation;
      const selectFields = this.buildSelectFields(
        includeDistanceInSelect,
        userLocation,
      );

      // Get the listings with relations using conditional SELECT with error handling
      let listingsWithRelations;
      const startTime = Date.now();
      try {
        listingsWithRelations = await this.db
          .select(selectFields)
          .from(listings)
          .innerJoin(
            listingCategories,
            eq(listings.categoryId, listingCategories.id),
          )
          .innerJoin(user, eq(listings.ownerId, user.id))
          .leftJoin(
            userAddresses,
            and(
              eq(userAddresses.userId, user.id),
              eq(userAddresses.isPrimary, true),
            ),
          )
          .where(and(...whereConditions))
          .orderBy(...orderByClause)
          .limit(pagination.limit)
          .offset(offset);
      } catch (error) {
        // Handle spatial query errors gracefully
        if (
          error instanceof Error &&
          (error.message.includes("ST_Distance") ||
            error.message.includes("st_distance") ||
            error.message.includes("st_point") ||
            error.message.includes("function st_point") ||
            error.message.includes("geography") ||
            error.message.includes("does not exist"))
        ) {
          console.warn(
            "PostGIS spatial query failed, falling back to non-distance mode:",
            error.message,
          );

          // Retry without distance calculation
          const fallbackFilters = { ...filters };
          if (filters.sortBy === "distance") {
            fallbackFilters.sortBy = "newest";
          }

          // Note: This recursive call needs the same parameters
          // We'll need to pass userId, communityId, and isAdmin from the caller
          // For now, we'll throw an error to indicate this needs to be handled at the caller level
          throw new Error(
            "Spatial query failed. Please retry without distance sorting.",
          );
        }

        throw error;
      }

      // Log slow queries for performance monitoring
      const queryTime = Date.now() - startTime;
      if (queryTime > 1000) {
        console.warn(`Slow listing query: ${queryTime}ms`, {
          sortBy: filters.sortBy,
          includeDistanceInSelect,
          resultCount: listingsWithRelations.length,
        });
      }

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

      // Transform to UserListing format — ratings come from user-level aggregates (blind review system).
      const transformedListings: UserListing[] = listingsWithRelations.map(
        (item) => {
          const ownerAvgRating = item.owner.reviewAggregateRating
            ? Number(item.owner.reviewAggregateRating)
            : 0;
          const ownerRevCount = item.owner.reviewCount ?? 0;

          // Use database-calculated distance if available, otherwise undefined
          const distanceMiles =
            "calculatedDistance" in item
              ? (item as typeof item & { calculatedDistance: number })
                  .calculatedDistance
              : undefined;

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
            setupFee: Number(item.listing.setupFee),
            averageRating: Math.round(ownerAvgRating * 10) / 10,
            reviewCount: ownerRevCount,
            firstImageUrl: listingImagesMap.get(item.listing.id) || null,
            distanceMiles,
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

      return this._enrichListingsWithRatingsAndImages(userListings);
    } catch (error) {
      this.handleError(error, "getUserListings");
    }
  }

  /**
   * Count total listings for a user
   */
  async countUserListings(userId: string): Promise<number> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(listings)
        .where(eq(listings.ownerId, userId));

      return result[0]?.count || 0;
    } catch (error) {
      this.handleError(error, "countUserListings");
    }
  }

  /**
   * Get inventory usage for dashboard Mini-Analytics.
   * activeCount = approved, isActive listings with status available or rented.
   * usagePercent = activeCount / totalCount (0–100), or 0 when total is 0.
   *
   * @param userId - Listing owner id
   * @returns { activeCount, totalCount, usagePercent }
   */
  async getInventoryUsage(userId: string): Promise<{
    activeCount: number;
    totalCount: number;
    usagePercent: number;
  }> {
    try {
      const [totalResult, activeResult] = await Promise.all([
        this.db
          .select({ count: count() })
          .from(listings)
          .where(eq(listings.ownerId, userId)),
        this.db
          .select({ count: count() })
          .from(listings)
          .where(
            and(
              eq(listings.ownerId, userId),
              eq(listings.isActive, true),
              eq(listings.approvalStatus, "approved"),
              or(
                eq(listings.status, "available"),
                eq(listings.status, "rented"),
              ),
            ),
          ),
      ]);

      const totalCount = totalResult[0]?.count ?? 0;
      const activeCount = activeResult[0]?.count ?? 0;
      const usagePercent =
        totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

      return { activeCount, totalCount, usagePercent };
    } catch (error) {
      this.handleError(error, "getInventoryUsage");
    }
  }

  /**
   * Get platform-wide count of active listings (approved, available or rented).
   */
  async getActiveListingsCount(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(listings)
        .where(
          and(
            eq(listings.isActive, true),
            eq(listings.approvalStatus, "approved"),
            or(eq(listings.status, "available"), eq(listings.status, "rented")),
          ),
        );
      return result[0]?.count ?? 0;
    } catch (error) {
      this.handleError(error, "getActiveListingsCount");
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
        eq(listings.approvalStatus, "approved"),
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
        eq(listings.approvalStatus, "approved"),
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
  /**
   * Batch-fetches per-owner listing counts + rental history for a set of
   * owner ids. Two GROUP BY queries regardless of owner count (previously
   * 2 per owner = N+1 in admin review flows).
   */
  private async _getOwnerStatsByIds(ownerIds: string[]): Promise<
    Map<
      string,
      {
        allListingsCount: number;
        totalRentals: number;
        averageRating: number;
      }
    >
  > {
    const stats = new Map<
      string,
      {
        allListingsCount: number;
        totalRentals: number;
        averageRating: number;
      }
    >();
    if (ownerIds.length === 0) return stats;

    for (const ownerId of ownerIds) {
      stats.set(ownerId, {
        allListingsCount: 0,
        totalRentals: 0,
        averageRating: 0,
      });
    }

    const [listingCountRows, rentalStatRows] = await Promise.all([
      this.db
        .select({
          ownerId: listings.ownerId,
          count: count(),
        })
        .from(listings)
        .where(inArray(listings.ownerId, ownerIds))
        .groupBy(listings.ownerId),
      this.db
        .select({
          ownerId: rentals.ownerId,
          totalRentals: count(rentals.id),
        })
        .from(rentals)
        .where(inArray(rentals.ownerId, ownerIds))
        .groupBy(rentals.ownerId),
    ]);

    for (const row of listingCountRows) {
      const entry = stats.get(row.ownerId);
      if (entry) entry.allListingsCount = Number(row.count ?? 0);
    }
    for (const row of rentalStatRows) {
      const entry = stats.get(row.ownerId);
      if (!entry) continue;
      entry.totalRentals = Number(row.totalRentals ?? 0);
    }

    return stats;
  }

  /**
   * Batch-fetches reviews and first images for a set of raw listings and
   * returns them enriched with computed averageRating, reviewCount,
   * firstImageUrl, and numeric rate fields. Two DB round trips regardless of
   * listing count (previously 2 per listing = N+1).
   */
  private async _enrichListingsWithRatingsAndImages(
    userListings: (typeof listings.$inferSelect)[],
  ): Promise<UserListing[]> {
    if (userListings.length === 0) return [];

    const listingIds = userListings.map((l) => l.id);

    const allFirstImages = await this.db
      .select({
        listingId: listingImages.listingId,
        imageUrl: listingImages.imageUrl,
      })
      .from(listingImages)
      .where(
        and(
          inArray(listingImages.listingId, listingIds),
          eq(listingImages.orderIndex, 0),
        ),
      );

    const firstImageByListing = new Map<string, string>();
    for (const img of allFirstImages) {
      if (img.listingId && !firstImageByListing.has(img.listingId)) {
        firstImageByListing.set(img.listingId, img.imageUrl);
      }
    }

    return userListings.map((listing) => {
      return {
        ...listing,
        dailyRate: Number(listing.dailyRate),
        weeklyRate: listing.weeklyRate ? Number(listing.weeklyRate) : undefined,
        monthlyRate: listing.monthlyRate
          ? Number(listing.monthlyRate)
          : undefined,
        securityDeposit: Number(listing.securityDeposit),
        deliveryFee: Number(listing.deliveryFee),
        setupFee: Number(listing.setupFee),
        averageRating: 0,
        reviewCount: 0,
        firstImageUrl: firstImageByListing.get(listing.id) || null,
      } as UserListing;
    });
  }

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

      return this._enrichListingsWithRatingsAndImages(userListings);
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

      return this._enrichListingsWithRatingsAndImages(userListings);
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

  /**
   * Get pending reviews for admin approval
   */
  async getPendingReviews(
    pagination: PaginationOptions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    adminUserId: string, // Parameter kept for API consistency, not used in this method
  ): Promise<PaginatedResult<PendingReviewListing>> {
    try {
      this.validatePagination(pagination.page, pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;

      // Get total count
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(listings)
        .where(eq(listings.approvalStatus, "pending_review"));

      // Get listings with owner context
      const pendingListings = await this.db
        .select({
          listing: listings,
          owner: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
            isVerified: user.emailVerified,
            createdAt: user.createdAt,
          },
          category: {
            id: listingCategories.id,
            name: listingCategories.name,
            icon: listingCategories.icon,
          },
        })
        .from(listings)
        .innerJoin(user, eq(listings.ownerId, user.id))
        .innerJoin(
          listingCategories,
          eq(listings.categoryId, listingCategories.id),
        )
        .where(eq(listings.approvalStatus, "pending_review"))
        .orderBy(asc(listings.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      // Get images for all listings
      const listingIds = pendingListings.map((item) => item.listing.id);
      const allImages =
        listingIds.length > 0
          ? await this.db
              .select({
                id: listingImages.id,
                listingId: listingImages.listingId,
                imageUrl: listingImages.imageUrl,
                orderIndex: listingImages.orderIndex,
              })
              .from(listingImages)
              .where(inArray(listingImages.listingId, listingIds))
              .orderBy(listingImages.orderIndex)
          : [];

      // Group images by listing ID (filter out any null listingIds)
      const imagesByListing = new Map<string, typeof allImages>();
      for (const image of allImages) {
        if (!image.listingId) continue; // Skip images with null listingId (shouldn't happen, but type safety)
        if (!imagesByListing.has(image.listingId)) {
          imagesByListing.set(image.listingId, []);
        }
        imagesByListing.get(image.listingId)!.push(image);
      }

      // Batch-fetch per-owner stats (2 queries regardless of owner count)
      const ownerIds = [
        ...new Set(pendingListings.map((item) => item.owner.id)),
      ];
      const ownerStatsMap = await this._getOwnerStatsByIds(ownerIds);

      const statsByOwner = new Map<
        string,
        {
          ownerId: string;
          otherListingsCount: number;
          rentalHistory: { totalRentals: number; averageRating: number };
        }
      >();
      for (const [ownerId, s] of ownerStatsMap) {
        // Subtract 1 if the current pending listing is included in the count
        const currentListingId = pendingListings.find(
          (p) => p.owner.id === ownerId,
        )?.listing.id;
        const otherListingsCount = currentListingId
          ? Math.max(0, s.allListingsCount - 1)
          : s.allListingsCount;

        statsByOwner.set(ownerId, {
          ownerId,
          otherListingsCount,
          rentalHistory: {
            totalRentals: s.totalRentals,
            averageRating: s.averageRating,
          },
        });
      }

      // Transform to PendingReviewListing format
      const transformed: PendingReviewListing[] = pendingListings.map(
        (item) => {
          const stats = statsByOwner.get(item.owner.id)!;
          const listingImages = imagesByListing.get(item.listing.id) || [];

          return {
            id: item.listing.id,
            name: item.listing.name,
            description: item.listing.description,
            brand: item.listing.brand || undefined,
            model: item.listing.model || undefined,
            condition: item.listing.condition,
            dailyRate: Number(item.listing.dailyRate),
            weeklyRate: item.listing.weeklyRate
              ? Number(item.listing.weeklyRate)
              : undefined,
            monthlyRate: item.listing.monthlyRate
              ? Number(item.listing.monthlyRate)
              : undefined,
            securityDeposit: Number(item.listing.securityDeposit),
            deliveryFee: Number(item.listing.deliveryFee),
            setupFee: Number(item.listing.setupFee),
            category: {
              id: item.category.id,
              name: item.category.name,
              icon: item.category.icon || undefined,
            },
            images: listingImages.map((img) => ({
              id: img.id,
              imageUrl: img.imageUrl,
              orderIndex: img.orderIndex || 0,
            })),
            createdAt: item.listing.createdAt,
            updatedAt: item.listing.updatedAt,
            owner: {
              id: item.owner.id,
              firstName: item.owner.firstName || "",
              lastName: item.owner.lastName || "",
              email: item.owner.email,
              profileImageUrl: item.owner.profileImageUrl || undefined,
              isVerified: item.owner.isVerified || false,
              createdAt: item.owner.createdAt,
              otherListingsCount: stats.otherListingsCount,
              rentalHistory: stats.rentalHistory,
            },
          };
        },
      );

      // Attach append-only review event timelines for each listing.
      const reviewEventListingIds = transformed.map((t) => t.id);
      const events =
        reviewEventListingIds.length > 0
          ? await this.db
              .select({
                id: reviewEvents.id,
                entityKind: reviewEvents.entityKind,
                entityId: reviewEvents.entityId,
                eventType: reviewEvents.eventType,
                actorUserId: reviewEvents.actorUserId,
                note: reviewEvents.note,
                createdAt: reviewEvents.createdAt,
              })
              .from(reviewEvents)
              .where(
                and(
                  eq(reviewEvents.entityKind, "tool_listing"),
                  inArray(reviewEvents.entityId, reviewEventListingIds),
                ),
              )
              .orderBy(asc(reviewEvents.createdAt))
          : [];

      const eventsByListingId = new Map<string, typeof events>();
      for (const event of events) {
        const key = event.entityId;
        if (!eventsByListingId.has(key)) eventsByListingId.set(key, []);
        eventsByListingId.get(key)!.push(event);
      }

      const transformedWithEvents: PendingReviewListing[] = transformed.map(
        (listing) => {
          const entityEvents = eventsByListingId.get(listing.id) ?? [];
          return {
            ...listing,
            reviewEvents: entityEvents.map((event) => ({
              id: event.id,
              entityKind: event.entityKind,
              entityId: event.entityId,
              eventType: event.eventType,
              actorUserId: event.actorUserId,
              note: event.note,
              createdAt: event.createdAt,
              actor: null,
            })),
          };
        },
      );

      return this.createPaginatedResult(
        transformedWithEvents,
        total,
        pagination.page,
        pagination.limit,
      );
    } catch (error) {
      this.handleError(error, "getPendingReviews");
    }
  }

  /**
   * Get review history (approved/rejected listings)
   */
  async getReviewHistory(
    status: "approved" | "rejected" | "all",
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<ReviewedListing>> {
    try {
      this.validatePagination(pagination.page, pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;

      // Build where conditions for approval status
      const statusConditions = [];
      if (status === "approved") {
        statusConditions.push(eq(listings.approvalStatus, "approved"));
      } else if (status === "rejected") {
        statusConditions.push(eq(listings.approvalStatus, "rejected"));
      }
      // "all" means no status filter

      // Get total count
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(listings)
        .where(
          statusConditions.length > 0
            ? and(...statusConditions)
            : inArray(listings.approvalStatus, ["approved", "rejected"]),
        );

      // Get listings with owner context (reviewer will be fetched separately)
      const reviewedListings = await this.db
        .select({
          listing: listings,
          owner: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
            isVerified: user.emailVerified,
            createdAt: user.createdAt,
          },
          category: {
            id: listingCategories.id,
            name: listingCategories.name,
            icon: listingCategories.icon,
          },
        })
        .from(listings)
        .innerJoin(user, eq(listings.ownerId, user.id))
        .innerJoin(
          listingCategories,
          eq(listings.categoryId, listingCategories.id),
        )
        .where(
          statusConditions.length > 0
            ? and(...statusConditions)
            : inArray(listings.approvalStatus, ["approved", "rejected"]),
        )
        .orderBy(
          // Use COALESCE to handle null reviewedAt values
          sql`COALESCE(${listings.reviewedAt}, ${listings.createdAt}) DESC`,
        )
        .limit(pagination.limit)
        .offset(offset);

      // Get images for all listings
      const listingIds = reviewedListings.map((item) => item.listing.id);
      const allImages =
        listingIds.length > 0
          ? await this.db
              .select({
                id: listingImages.id,
                listingId: listingImages.listingId,
                imageUrl: listingImages.imageUrl,
                orderIndex: listingImages.orderIndex,
              })
              .from(listingImages)
              .where(inArray(listingImages.listingId, listingIds))
              .orderBy(listingImages.orderIndex)
          : [];

      // Group images by listing ID (filter out any null listingIds)
      const imagesByListing = new Map<string, typeof allImages>();
      for (const image of allImages) {
        if (!image.listingId) continue; // Skip images with null listingId (shouldn't happen, but type safety)
        if (!imagesByListing.has(image.listingId)) {
          imagesByListing.set(image.listingId, []);
        }
        imagesByListing.get(image.listingId)!.push(image);
      }

      // Batch-fetch per-owner stats (2 queries regardless of owner count)
      const ownerIds = [
        ...new Set(reviewedListings.map((item) => item.owner.id)),
      ];
      const ownerStatsMap = await this._getOwnerStatsByIds(ownerIds);

      const statsByOwner = new Map<
        string,
        {
          ownerId: string;
          otherListingsCount: number;
          rentalHistory: { totalRentals: number; averageRating: number };
        }
      >();
      for (const [ownerId, s] of ownerStatsMap) {
        statsByOwner.set(ownerId, {
          ownerId,
          otherListingsCount: s.allListingsCount - 1,
          rentalHistory: {
            totalRentals: s.totalRentals,
            averageRating: s.averageRating,
          },
        });
      }

      // Get reviewer details separately (using query builder for JOIN)
      const reviewerIds = reviewedListings
        .map((item) => item.listing.reviewedBy)
        .filter((id): id is string => !!id);
      const reviewers =
        reviewerIds.length > 0
          ? await this.db
              .select({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImageUrl: user.profileImageUrl,
              })
              .from(user)
              .where(inArray(user.id, reviewerIds))
          : [];
      const reviewersMap = new Map(reviewers.map((r) => [r.id, r]));

      // Transform to ReviewedListing format
      const transformed: ReviewedListing[] = reviewedListings.map((item) => {
        const stats = statsByOwner.get(item.owner.id)!;
        const listingImages = imagesByListing.get(item.listing.id) || [];
        const reviewer = item.listing.reviewedBy
          ? reviewersMap.get(item.listing.reviewedBy) || null
          : null;

        return {
          id: item.listing.id,
          name: item.listing.name,
          description: item.listing.description,
          brand: item.listing.brand || undefined,
          model: item.listing.model || undefined,
          condition: item.listing.condition,
          dailyRate: Number(item.listing.dailyRate),
          weeklyRate: item.listing.weeklyRate
            ? Number(item.listing.weeklyRate)
            : undefined,
          monthlyRate: item.listing.monthlyRate
            ? Number(item.listing.monthlyRate)
            : undefined,
          securityDeposit: Number(item.listing.securityDeposit),
          deliveryFee: Number(item.listing.deliveryFee),
          setupFee: Number(item.listing.setupFee),
          category: {
            id: item.category.id,
            name: item.category.name,
            icon: item.category.icon || undefined,
          },
          images: listingImages.map((img) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            orderIndex: img.orderIndex || 0,
          })),
          createdAt: item.listing.createdAt,
          updatedAt: item.listing.updatedAt,
          owner: {
            id: item.owner.id,
            firstName: item.owner.firstName || "",
            lastName: item.owner.lastName || "",
            email: item.owner.email,
            profileImageUrl: item.owner.profileImageUrl || undefined,
            isVerified: item.owner.isVerified || false,
            createdAt: item.owner.createdAt,
            otherListingsCount: stats.otherListingsCount,
            rentalHistory: stats.rentalHistory,
          },
          approvalStatus: item.listing.approvalStatus as
            | "approved"
            | "rejected",
          rejectionReason: item.listing.rejectionReason || undefined,
          reviewedBy: reviewer
            ? {
                id: reviewer.id,
                firstName: reviewer.firstName || "",
                lastName: reviewer.lastName || "",
                profileImageUrl: reviewer.profileImageUrl || undefined,
              }
            : null,
          reviewedAt: item.listing.reviewedAt || null,
        };
      });

      // Attach append-only review event timelines for each reviewed listing.
      const reviewEventListingIds = transformed.map((t) => t.id);
      const events =
        reviewEventListingIds.length > 0
          ? await this.db
              .select({
                id: reviewEvents.id,
                entityKind: reviewEvents.entityKind,
                entityId: reviewEvents.entityId,
                eventType: reviewEvents.eventType,
                actorUserId: reviewEvents.actorUserId,
                note: reviewEvents.note,
                createdAt: reviewEvents.createdAt,
              })
              .from(reviewEvents)
              .where(
                and(
                  eq(reviewEvents.entityKind, "tool_listing"),
                  inArray(reviewEvents.entityId, reviewEventListingIds),
                ),
              )
              .orderBy(asc(reviewEvents.createdAt))
          : [];

      const eventsByListingId = new Map<string, typeof events>();
      for (const event of events) {
        if (!eventsByListingId.has(event.entityId)) {
          eventsByListingId.set(event.entityId, []);
        }
        eventsByListingId.get(event.entityId)!.push(event);
      }

      const transformedWithEvents: ReviewedListing[] = transformed.map(
        (listing) => {
          const entityEvents = eventsByListingId.get(listing.id) ?? [];
          return {
            ...listing,
            reviewEvents: entityEvents.map((event) => ({
              id: event.id,
              entityKind: event.entityKind,
              entityId: event.entityId,
              eventType: event.eventType,
              actorUserId: event.actorUserId,
              note: event.note,
              createdAt: event.createdAt,
              actor: null,
            })),
          };
        },
      );

      return this.createPaginatedResult(
        transformedWithEvents,
        total,
        pagination.page,
        pagination.limit,
      );
    } catch (error) {
      this.handleError(error, "getReviewHistory");
    }
  }

  /**
   * Update approval status for a listing
   * Uses optimistic locking to prevent concurrent reviews (WHERE clause check)
   * Returns { updated: true } when the listing was updated, or { updated: false }
   * when it was already in the requested state (idempotent no-op).
   */
  async updateApprovalStatus(
    listingId: string,
    status: "approved" | "rejected",
    adminUserId: string,
    rejectionReason?: string,
  ): Promise<{ updated: boolean }> {
    try {
      // First, check if listing exists and is still pending
      const [listing] = await this.db
        .select()
        .from(listings)
        .where(eq(listings.id, listingId));

      if (!listing) {
        throw new NotFoundError("Listing", listingId);
      }

      // Idempotency: if the listing is already in the requested state, treat as success.
      if (listing.approvalStatus === status) {
        return { updated: false };
      }

      // Check if already reviewed with a conflicting action
      if (listing.approvalStatus !== "pending_review") {
        throw new ValidationError("Listing has already been reviewed");
      }

      // Prepare update data
      const updateData: {
        approvalStatus: "approved" | "rejected";
        reviewedBy: string;
        reviewedAt: Date;
        rejectionReason?: string | null;
        status?: "available" | "inactive" | "maintenance" | "rented";
      } = {
        approvalStatus: status,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      };

      // Handle rejection reason
      if (status === "rejected") {
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          throw new ValidationError(
            "Rejection reason is required for rejections",
          );
        }
        updateData.rejectionReason = appendReviewScalar(
          listing.rejectionReason,
          rejectionReason,
          "Rejection reason",
        );
      } else {
        // When approving, set status to "available" if it's currently "inactive"
        if (listing.status === "inactive") {
          updateData.status = "available";
        }
      }

      // Update listing with optimistic locking: only update if still pending_review
      // This prevents concurrent reviews - if another admin already reviewed it,
      // the WHERE clause will match 0 rows and the update won't happen
      const result = await this.db
        .update(listings)
        .set(updateData)
        .where(
          and(
            eq(listings.id, listingId),
            eq(listings.approvalStatus, "pending_review"),
          ),
        )
        .returning();

      // Check if update actually happened (optimistic lock check)
      if (result.length === 0) {
        throw new ValidationError(
          "Listing has already been reviewed by another admin",
        );
      }

      // Append review event after a successful status update.
      await this.db.insert(reviewEvents).values({
        entityKind: "tool_listing",
        entityId: listingId,
        eventType: status,
        actorUserId: adminUserId,
        note: status === "rejected" ? (rejectionReason ?? null) : null,
      });

      return { updated: true };
    } catch (error) {
      this.handleError(error, "updateApprovalStatus");
      // handleError always throws, but TypeScript needs an explicit return
      return { updated: false };
    }
  }

  /**
   * Count pending reviews
   */
  async countPendingReviews(): Promise<number> {
    try {
      const [{ count: total }] = await this.db
        .select({ count: count() })
        .from(listings)
        .where(eq(listings.approvalStatus, "pending_review"));

      return Number(total || 0);
    } catch (error) {
      this.handleError(error, "countPendingReviews");
    }
  }

  /**
   * Get user listings by approval status
   * Used for Garage "Pending Review" tab
   */
  async getUserListingsByApprovalStatus(
    approvalStatus: "pending_review" | "rejected",
    userId: string,
  ): Promise<UserListing[]> {
    try {
      // Use the same helper method as other garage methods for consistency
      return this._getUserListingsWithConditions([
        eq(listings.ownerId, userId),
        eq(listings.approvalStatus, approvalStatus),
      ]);
    } catch (error) {
      this.handleError(error, "getUserListingsByApprovalStatus");
    }
  }

  /**
   * Get top performing listings for dashboard widget.
   * Orders by rental count (approved/active/completed) then by average rating.
   *
   * @param userId - Listing owner id
   * @param limit - Max number to return (e.g. 5)
   * @returns Array with listingId, name, metricText (e.g. "5 rentals" or "4.8 stars")
   */
  async getTopPerformingListings(
    userId: string,
    limit: number,
  ): Promise<Array<{ listingId: string; name: string; metricText: string }>> {
    try {
      const [userListings, countRows] = await Promise.all([
        this.db
          .select({ id: listings.id, name: listings.name })
          .from(listings)
          .where(
            and(
              eq(listings.ownerId, userId),
              eq(listings.approvalStatus, "approved"),
            ),
          ),
        this.db
          .select({
            listingId: rentalRequests.listingId,
            rentalCount: count(),
          })
          .from(rentalRequests)
          .where(
            inArray(rentalRequests.status, ["approved", "active", "completed"]),
          )
          .groupBy(rentalRequests.listingId),
      ]);

      const countByListing = new Map(
        countRows.map((r) => [r.listingId, Number(r.rentalCount)]),
      );

      const withMetrics = userListings.map((listing) => ({
        listingId: listing.id,
        name: listing.name,
        rentalCount: countByListing.get(listing.id) ?? 0,
        avgRating: null as number | null,
      }));

      withMetrics.sort((a, b) => b.rentalCount - a.rentalCount);

      return withMetrics.slice(0, limit).map((row) => {
        const metricText =
          row.rentalCount > 0
            ? row.rentalCount === 1
              ? "1 rental"
              : `${row.rentalCount} rentals`
            : row.avgRating != null
              ? `${row.avgRating} stars`
              : "No rentals yet";
        return {
          listingId: row.listingId,
          name: row.name,
          metricText,
        };
      });
    } catch (error) {
      this.handleError(error, "getTopPerformingListings");
    }
  }

  /**
   * Get recent listings near user for dashboard (or platform-wide if no location).
   * If user/listings have location: recent listings near user. Else: platform-wide recent.
   *
   * @param userId - Current user id (for distance from user's address)
   * @param limit - Max number to return (e.g. 5)
   * @returns Array with id, name, linkTo (listing detail URL)
   */
  async getRecentListingsNearUser(
    userId: string,
    limit: number,
  ): Promise<Array<{ id: string; name: string; linkTo: string }>> {
    try {
      const userAddress = await this.getUserPrimaryAddress(userId);
      const hasUserLocation =
        userAddress?.latitude != null && userAddress?.longitude != null;

      if (hasUserLocation) {
        try {
          const results = await this.db
            .select({
              id: listings.id,
              name: listings.name,
              distanceMiles: sql<number>`
                ST_Distance(
                  ST_Point(${userAddress.longitude}::float, ${userAddress.latitude}::float)::geography,
                  ST_Point(${userAddresses.longitude}::float, ${userAddresses.latitude}::float)::geography
                ) / 1609.34
              `.as("distance_miles"),
            })
            .from(listings)
            .innerJoin(
              userAddresses,
              eq(listings.ownerId, userAddresses.userId),
            )
            .where(
              and(
                eq(listings.approvalStatus, "approved"),
                eq(listings.isActive, true),
                sql`${userAddresses.latitude} IS NOT NULL AND ${userAddresses.longitude} IS NOT NULL`,
              ),
            )
            .orderBy(
              sql`distance_miles ASC NULLS LAST`,
              desc(listings.createdAt),
            )
            .limit(limit);

          return results.map((r) => ({
            id: r.id,
            name: r.name,
            linkTo: `/dashboard/listings/${r.id}`,
          }));
        } catch (spatialError) {
          const err = spatialError as Error & { code?: string; cause?: Error };
          const msg = err.message?.toLowerCase() ?? "";
          const causeMsg = err.cause?.message?.toLowerCase() ?? "";
          const hasMsg = (s: string) => msg.includes(s) || causeMsg.includes(s);
          const isPostGISUnavailable =
            err instanceof Error &&
            (err.code === "42704" ||
              hasMsg("geography") ||
              hasMsg("does not exist") ||
              hasMsg("st_distance") ||
              hasMsg("st_point"));

          if (isPostGISUnavailable) {
            console.warn(
              "PostGIS unavailable, falling back to recent listings:",
              err.message,
            );
            const fallbackResults = await this.db
              .select({
                id: listings.id,
                name: listings.name,
              })
              .from(listings)
              .where(
                and(
                  eq(listings.approvalStatus, "approved"),
                  eq(listings.isActive, true),
                ),
              )
              .orderBy(desc(listings.createdAt))
              .limit(limit);

            return fallbackResults.map((r) => ({
              id: r.id,
              name: r.name,
              linkTo: `/dashboard/listings/${r.id}`,
            }));
          }
          throw spatialError;
        }
      }

      const results = await this.db
        .select({
          id: listings.id,
          name: listings.name,
        })
        .from(listings)
        .where(
          and(
            eq(listings.approvalStatus, "approved"),
            eq(listings.isActive, true),
          ),
        )
        .orderBy(desc(listings.createdAt))
        .limit(limit);

      return results.map((r) => ({
        id: r.id,
        name: r.name,
        linkTo: `/dashboard/listings/${r.id}`,
      }));
    } catch (error) {
      this.handleError(error, "getRecentListingsNearUser");
    }
  }

  /**
   * Check if listing has significant changes
   * Compares old and new listing data
   */
  private hasSignificantChanges(
    oldListing: CreateListingDTO | UpdateListingDTO,
    newListing: CreateListingDTO | UpdateListingDTO,
    oldImages?: Array<{ id: string; imageUrl: string; orderIndex: number }>,
    newImages?: Array<{ id: string; imageUrl: string; orderIndex: number }>,
  ): boolean {
    // Check significant fields
    const significantFields: Array<keyof CreateListingDTO> = [
      "name",
      "description",
      "categoryId",
      "condition",
    ];

    for (const field of significantFields) {
      if (
        oldListing[field] !== undefined &&
        newListing[field] !== undefined &&
        oldListing[field] !== newListing[field]
      ) {
        return true;
      }
    }

    // Check pricing fields
    const pricingFields: Array<keyof CreateListingDTO> = [
      "dailyRate",
      "weeklyRate",
      "monthlyRate",
    ];

    for (const field of pricingFields) {
      if (
        oldListing[field] !== undefined &&
        newListing[field] !== undefined &&
        oldListing[field] !== newListing[field]
      ) {
        return true;
      }
    }

    // Check image changes (count or order)
    if (oldImages && newImages) {
      if (oldImages.length !== newImages.length) {
        return true;
      }

      // Check if order changed or any images differ
      for (let i = 0; i < oldImages.length; i++) {
        if (
          oldImages[i].orderIndex !== newImages[i]?.orderIndex ||
          oldImages[i].imageUrl !== newImages[i]?.imageUrl
        ) {
          return true;
        }
      }
    }

    return false;
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
