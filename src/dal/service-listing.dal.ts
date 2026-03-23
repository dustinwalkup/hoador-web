import { and, asc, desc, eq } from "drizzle-orm";

import {
  serviceListingCategories,
  serviceListings,
  serviceProviderProfiles,
  type NewServiceListing,
  type ServiceListing,
} from "@/db/schemas/services.schema";
import { user } from "@/db/schemas/user.schema";

import { BaseDAL } from "./base";
import { NotFoundError } from "./errors";

/** Fields required to insert a new service listing (server-generated columns omitted). */
export type CreateListingData = Omit<
  NewServiceListing,
  "id" | "createdAt" | "updatedAt"
>;

/** Provider summary joined for listing queries. */
export type ServiceListingProviderInfo = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  email: string;
};

/** Category summary joined for listing detail. */
export type ServiceListingCategoryInfo = {
  id: string;
  name: string;
  description: string | null;
};

/**
 * Listing row with category and provider relations (e.g. detail / admin queue).
 */
export type ServiceListingWithCategoryAndProvider = ServiceListing & {
  category: ServiceListingCategoryInfo;
  provider: ServiceListingProviderInfo;
};

/** Active listing row for marketplace browse (provider + aggregate rating). */
export type ServiceListingBrowseItem = ServiceListing & {
  providerFirstName: string | null;
  providerLastName: string | null;
  providerProfileImageUrl: string | null;
  aggregateRating: string | null;
  reviewCount: number;
};

/**
 * Data access for HOA service listings.
 */
export class ServiceListingDAL extends BaseDAL {
  /**
   * Inserts a new service listing row.
   *
   * @param data - Insert payload (no id / timestamps)
   * @returns The created listing
   */
  async create(data: CreateListingData): Promise<ServiceListing> {
    try {
      const [row] = await this.db
        .insert(serviceListings)
        .values(data)
        .returning();

      if (!row) {
        throw new NotFoundError("Service listing");
      }

      return row;
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.create");
    }
  }

  /**
   * Updates a listing and returns the updated row.
   *
   * @param listingId - Listing id
   * @param updates - Partial row (id / createdAt should not be supplied)
   * @returns Updated listing
   */
  async update(
    listingId: string,
    updates: Partial<Omit<ServiceListing, "id" | "createdAt">>,
  ): Promise<ServiceListing> {
    try {
      const [row] = await this.db
        .update(serviceListings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(serviceListings.id, listingId))
        .returning();

      if (!row) {
        throw new NotFoundError("Service listing", listingId);
      }

      return row;
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.update");
    }
  }

  /**
   * Loads one listing with category and provider user fields.
   *
   * @param listingId - Listing id
   * @returns Listing with relations, or null
   */
  async getById(
    listingId: string,
  ): Promise<ServiceListingWithCategoryAndProvider | null> {
    try {
      const [row] = await this.db
        .select({
          listing: serviceListings,
          category: {
            id: serviceListingCategories.id,
            name: serviceListingCategories.name,
            description: serviceListingCategories.description,
          },
          provider: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            email: user.email,
          },
        })
        .from(serviceListings)
        .innerJoin(
          serviceListingCategories,
          eq(serviceListings.categoryId, serviceListingCategories.id),
        )
        .innerJoin(user, eq(serviceListings.providerId, user.id))
        .where(eq(serviceListings.id, listingId))
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        ...row.listing,
        category: row.category,
        provider: row.provider,
      };
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.getById");
    }
  }

  /**
   * Active listings for a community, optional category filter and pagination.
   *
   * @param communityId - HOA community id
   * @param filters - Optional category id
   * @param pagination - limit / offset (defaults: 50 / 0)
   */
  async findByCommunity(
    communityId: string,
    filters?: { categoryId?: string },
    pagination?: { limit: number; offset: number },
  ): Promise<ServiceListing[]> {
    try {
      const limit = pagination?.limit ?? 50;
      const offset = pagination?.offset ?? 0;

      const conditions = [
        eq(serviceListings.communityId, communityId),
        eq(serviceListings.status, "active"),
      ];

      if (filters?.categoryId) {
        conditions.push(eq(serviceListings.categoryId, filters.categoryId));
      }

      return await this.db
        .select()
        .from(serviceListings)
        .where(and(...conditions))
        .orderBy(desc(serviceListings.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.findByCommunity");
    }
  }

  /**
   * All service listing categories (for filters and forms).
   */
  async listCategories(): Promise<ServiceListingCategoryInfo[]> {
    try {
      return await this.db
        .select({
          id: serviceListingCategories.id,
          name: serviceListingCategories.name,
          description: serviceListingCategories.description,
        })
        .from(serviceListingCategories)
        .orderBy(asc(serviceListingCategories.name));
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.listCategories");
    }
  }

  /**
   * Active listings for a community with provider display fields and optional aggregate rating.
   */
  async findByCommunityForBrowse(
    communityId: string,
    filters?: { categoryId?: string },
    pagination?: { limit: number; offset: number },
  ): Promise<ServiceListingBrowseItem[]> {
    try {
      const limit = pagination?.limit ?? 50;
      const offset = pagination?.offset ?? 0;

      const conditions = [
        eq(serviceListings.communityId, communityId),
        eq(serviceListings.status, "active"),
      ];

      if (filters?.categoryId) {
        conditions.push(eq(serviceListings.categoryId, filters.categoryId));
      }

      const rows = await this.db
        .select({
          listing: serviceListings,
          providerFirstName: user.firstName,
          providerLastName: user.lastName,
          providerProfileImageUrl: user.profileImageUrl,
          aggregateRating: serviceProviderProfiles.aggregateRating,
          reviewCount: serviceProviderProfiles.reviewCount,
        })
        .from(serviceListings)
        .innerJoin(user, eq(serviceListings.providerId, user.id))
        .leftJoin(
          serviceProviderProfiles,
          eq(serviceListings.providerId, serviceProviderProfiles.userId),
        )
        .where(and(...conditions))
        .orderBy(desc(serviceListings.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((row) => ({
        ...row.listing,
        providerFirstName: row.providerFirstName,
        providerLastName: row.providerLastName,
        providerProfileImageUrl: row.providerProfileImageUrl,
        aggregateRating: row.aggregateRating,
        reviewCount: row.reviewCount ?? 0,
      }));
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.findByCommunityForBrowse");
    }
  }

  /**
   * Listings awaiting admin approval, oldest first, with provider info.
   */
  async findPendingApproval(): Promise<
    ServiceListingWithCategoryAndProvider[]
  > {
    try {
      const rows = await this.db
        .select({
          listing: serviceListings,
          category: {
            id: serviceListingCategories.id,
            name: serviceListingCategories.name,
            description: serviceListingCategories.description,
          },
          provider: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            email: user.email,
          },
        })
        .from(serviceListings)
        .innerJoin(
          serviceListingCategories,
          eq(serviceListings.categoryId, serviceListingCategories.id),
        )
        .innerJoin(user, eq(serviceListings.providerId, user.id))
        .where(eq(serviceListings.status, "pending_approval"))
        .orderBy(asc(serviceListings.createdAt));

      return rows.map((row) => ({
        ...row.listing,
        category: row.category,
        provider: row.provider,
      }));
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.findPendingApproval");
    }
  }

  /**
   * All listings owned by a provider (any status).
   */
  async findByProvider(providerId: string): Promise<ServiceListing[]> {
    try {
      return await this.db
        .select()
        .from(serviceListings)
        .where(eq(serviceListings.providerId, providerId))
        .orderBy(desc(serviceListings.updatedAt));
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.findByProvider");
    }
  }
}
