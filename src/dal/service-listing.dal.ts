import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";

import {
  serviceListingCategories,
  serviceListings,
  serviceProviderProfiles,
  type NewServiceListing,
  type ServiceListing,
} from "@/db/schemas/services.schema";
import { auditLogs } from "@/db/schemas/audit-logs.schema";
import { communityVisibility } from "@/db/schemas/communities.schema";
import { user } from "@/db/schemas/user.schema";
import { reviewEvents } from "@/db/schemas/review-events.schema";

import { BaseDAL } from "./base";
import { NotFoundError } from "./errors";
import type { PaginatedResult, PaginationOptions } from "./types";
import type { ReviewEvent } from "./review-events.dal";

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

export type ServiceListingReviewProviderInfo = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  email: string;
  isVerified: boolean;
  createdAt: Date;
  otherListingsCount: number;
  averageRating: number;
  totalReviews: number;
};

export type ServiceListingReviewerInfo = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
};

export type ServiceListingReviewWithCategoryAndProvider = ServiceListing & {
  category: ServiceListingCategoryInfo;
  provider: ServiceListingReviewProviderInfo;
  reviewedAt: Date | null;
  reviewedBy: ServiceListingReviewerInfo | null;
  reviewEvents?: ReviewEvent[];
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
   * Deletes one listing row.
   */
  async delete(listingId: string): Promise<void> {
    try {
      const [row] = await this.db
        .delete(serviceListings)
        .where(eq(serviceListings.id, listingId))
        .returning({ id: serviceListings.id });

      if (!row) {
        throw new NotFoundError("Service listing", listingId);
      }
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.delete");
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
   * Active listings visible to a viewer with provider display fields and optional aggregate rating.
   *
   * Visibility model (R5, symmetric per-community): a listing surfaces only
   * through its own community (`serviceListings.communityId`). It is returned
   * when (a) that community is in the viewer's visible set AND (b) the
   * provider has `community_visibility.is_visible = true` for that exact
   * community. A missing provider row = not visible (fail-closed).
   *
   * @param visibleCommunityIds - The viewer's visible community IDs. Empty
   *   array short-circuits to an empty result with no DB hit (fail-closed).
   * @param filters.categoryId - Optional category filter.
   * @param filters.excludeProviderId - When set, omits listings owned by this user (browse parity with tool explore).
   */
  async findByCommunityForBrowse(
    visibleCommunityIds: string[],
    filters?: { categoryId?: string; excludeProviderId?: string },
    pagination?: { limit: number; offset: number },
  ): Promise<ServiceListingBrowseItem[]> {
    try {
      // Fail-closed: viewer with no visible communities sees nothing.
      if (visibleCommunityIds.length === 0) {
        return [];
      }

      const limit = pagination?.limit ?? 50;
      const offset = pagination?.offset ?? 0;

      const conditions = [
        eq(serviceListings.status, "active"),
        inArray(serviceListings.communityId, visibleCommunityIds),
        eq(communityVisibility.isVisible, true),
      ];

      if (filters?.categoryId) {
        conditions.push(eq(serviceListings.categoryId, filters.categoryId));
      }

      if (filters?.excludeProviderId) {
        conditions.push(
          ne(serviceListings.providerId, filters.excludeProviderId),
        );
      }

      // The community_visibility join is 1:1 with the listing (pinned to the
      // provider AND the listing's community); selectDistinct is retained as a
      // cheap guard only.
      const rows = await this.db
        .selectDistinct({
          listing: serviceListings,
          providerFirstName: user.firstName,
          providerLastName: user.lastName,
          providerProfileImageUrl: user.profileImageUrl,
          aggregateRating: user.reviewAggregateRating,
          reviewCount: user.reviewCount,
        })
        .from(serviceListings)
        .innerJoin(user, eq(serviceListings.providerId, user.id))
        .innerJoin(
          communityVisibility,
          and(
            eq(communityVisibility.userId, serviceListings.providerId),
            eq(communityVisibility.communityId, serviceListings.communityId),
          ),
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
    ServiceListingReviewWithCategoryAndProvider[]
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
            createdAt: user.createdAt,
            isVerified: user.emailVerified,
            averageRating: serviceProviderProfiles.aggregateRating,
            totalReviews: serviceProviderProfiles.reviewCount,
          },
        })
        .from(serviceListings)
        .innerJoin(
          serviceListingCategories,
          eq(serviceListings.categoryId, serviceListingCategories.id),
        )
        .innerJoin(user, eq(serviceListings.providerId, user.id))
        .leftJoin(
          serviceProviderProfiles,
          eq(serviceListings.providerId, serviceProviderProfiles.userId),
        )
        .where(eq(serviceListings.status, "pending_approval"))
        .orderBy(asc(serviceListings.createdAt));

      const providerIds = [
        ...new Set(rows.map((row) => row.provider.id)),
      ] as string[];

      const providerCounts = providerIds.length
        ? await this.db
            .select({
              providerId: serviceListings.providerId,
              total: count(),
            })
            .from(serviceListings)
            .where(inArray(serviceListings.providerId, providerIds))
            .groupBy(serviceListings.providerId)
        : [];

      const countsByProviderId = new Map<string, number>(
        providerCounts.map((row) => [row.providerId, Number(row.total ?? 0)]),
      );

      const transformed: ServiceListingReviewWithCategoryAndProvider[] =
        rows.map((row) => {
          const totalListingsForProvider =
            countsByProviderId.get(row.provider.id) ?? 0;
          const otherListingsCount = Math.max(0, totalListingsForProvider - 1);

          return {
            ...row.listing,
            category: row.category,
            provider: {
              id: row.provider.id,
              firstName: row.provider.firstName ?? "",
              lastName: row.provider.lastName ?? "",
              profileImageUrl: row.provider.profileImageUrl,
              email: row.provider.email,
              isVerified: row.provider.isVerified,
              createdAt: row.provider.createdAt,
              otherListingsCount,
              averageRating: Number(row.provider.averageRating ?? 0),
              totalReviews: Number(row.provider.totalReviews ?? 0),
            },
            reviewedAt: null,
            reviewedBy: null,
          };
        });

      const listingIds = transformed.map((t) => t.id);
      const events =
        listingIds.length > 0
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
                  eq(reviewEvents.entityKind, "service_listing"),
                  inArray(reviewEvents.entityId, listingIds),
                ),
              )
              .orderBy(asc(reviewEvents.createdAt))
          : [];

      const actorUserIds = [
        ...new Set(
          events
            .map((e) => e.actorUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const actorRows =
        actorUserIds.length > 0
          ? await this.db
              .select({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImageUrl: user.profileImageUrl,
              })
              .from(user)
              .where(inArray(user.id, actorUserIds))
          : [];

      const actorById = new Map<
        string,
        {
          id: string;
          firstName: string;
          lastName: string;
          profileImageUrl: string | null;
        }
      >(
        actorRows.map((a) => [
          a.id,
          {
            id: a.id,
            firstName: a.firstName ?? "",
            lastName: a.lastName ?? "",
            profileImageUrl: a.profileImageUrl ?? null,
          },
        ]),
      );

      const eventsByListingId = new Map<string, typeof events>();
      for (const event of events) {
        if (!eventsByListingId.has(event.entityId)) {
          eventsByListingId.set(event.entityId, []);
        }
        eventsByListingId.get(event.entityId)!.push(event);
      }

      return transformed.map((listing) => {
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
            actor: event.actorUserId
              ? (actorById.get(event.actorUserId) ?? null)
              : null,
          })),
        };
      });
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.findPendingApproval");
    }
  }

  /**
   * Count service listings awaiting admin approval.
   *
   * Used for fast admin sidebar badge rendering.
   */
  async countPendingApprovals(): Promise<number> {
    try {
      const [{ count: total }] = await this.db
        .select({ count: count() })
        .from(serviceListings)
        .where(eq(serviceListings.status, "pending_approval"));

      return Number(total || 0);
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.countPendingApprovals");
    }
  }

  /**
   * Paginated review history for service listings.
   *
   * Status mapping:
   * - approved: `active` + `inactive`
   * - rejected: `denied`
   * - all: `active` + `inactive` + `denied`
   */
  async findReviewHistory(
    status: "approved" | "rejected" | "all",
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<ServiceListingReviewWithCategoryAndProvider>> {
    try {
      this.validatePagination(pagination.page, pagination.limit);

      const offset = (pagination.page - 1) * pagination.limit;

      const statuses: Array<"active" | "inactive" | "denied"> =
        status === "approved"
          ? ["active", "inactive"]
          : status === "rejected"
            ? ["denied"]
            : ["active", "inactive", "denied"];

      const [{ total }] = await this.db
        .select({ total: count() })
        .from(serviceListings)
        .where(inArray(serviceListings.status, statuses));

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
            createdAt: user.createdAt,
            isVerified: user.emailVerified,
            averageRating: serviceProviderProfiles.aggregateRating,
            totalReviews: serviceProviderProfiles.reviewCount,
          },
        })
        .from(serviceListings)
        .innerJoin(
          serviceListingCategories,
          eq(serviceListings.categoryId, serviceListingCategories.id),
        )
        .innerJoin(user, eq(serviceListings.providerId, user.id))
        .leftJoin(
          serviceProviderProfiles,
          eq(serviceListings.providerId, serviceProviderProfiles.userId),
        )
        .where(inArray(serviceListings.status, statuses))
        .orderBy(desc(serviceListings.updatedAt))
        .limit(pagination.limit)
        .offset(offset);

      const providerIds = [
        ...new Set(rows.map((row) => row.provider.id)),
      ] as string[];

      const providerCounts = providerIds.length
        ? await this.db
            .select({
              providerId: serviceListings.providerId,
              total: count(),
            })
            .from(serviceListings)
            .where(inArray(serviceListings.providerId, providerIds))
            .groupBy(serviceListings.providerId)
        : [];

      const countsByProviderId = new Map<string, number>(
        providerCounts.map((row) => [row.providerId, Number(row.total ?? 0)]),
      );

      const listingIds = [...new Set(rows.map((row) => row.listing.id))];

      const events =
        listingIds.length > 0
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
                  eq(reviewEvents.entityKind, "service_listing"),
                  inArray(reviewEvents.entityId, listingIds),
                ),
              )
              .orderBy(asc(reviewEvents.createdAt))
          : [];

      const actorUserIds = [
        ...new Set(
          events
            .map((e) => e.actorUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const actorRows =
        actorUserIds.length > 0
          ? await this.db
              .select({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImageUrl: user.profileImageUrl,
              })
              .from(user)
              .where(inArray(user.id, actorUserIds))
          : [];

      const actorById = new Map<
        string,
        {
          id: string;
          firstName: string;
          lastName: string;
          profileImageUrl: string | null;
        }
      >(
        actorRows.map((a) => [
          a.id,
          {
            id: a.id,
            firstName: a.firstName ?? "",
            lastName: a.lastName ?? "",
            profileImageUrl: a.profileImageUrl ?? null,
          },
        ]),
      );

      const eventsByListingId = new Map<string, typeof events>();
      for (const event of events) {
        if (!eventsByListingId.has(event.entityId)) {
          eventsByListingId.set(event.entityId, []);
        }
        eventsByListingId.get(event.entityId)!.push(event);
      }

      const auditActions: string[] =
        status === "approved"
          ? ["service_listing.approved"]
          : status === "rejected"
            ? ["service_listing.rejected"]
            : ["service_listing.approved", "service_listing.rejected"];

      const auditRows = listingIds.length
        ? await this.db
            .select({
              entityId: auditLogs.entityId,
              reviewerUserId: auditLogs.userId,
              reviewedAt: auditLogs.createdAt,
            })
            .from(auditLogs)
            .where(
              and(
                eq(auditLogs.entityType, "service_listing"),
                inArray(auditLogs.entityId, listingIds),
                inArray(auditLogs.action, auditActions),
              ),
            )
            .orderBy(desc(auditLogs.createdAt))
        : [];

      const latestAuditByListingId = new Map<
        string,
        { reviewedAt: Date; reviewerUserId: string | null }
      >();

      for (const auditRow of auditRows) {
        if (!latestAuditByListingId.has(auditRow.entityId)) {
          latestAuditByListingId.set(auditRow.entityId, {
            reviewedAt: auditRow.reviewedAt,
            reviewerUserId: auditRow.reviewerUserId,
          });
        }
      }

      const reviewerIds = [...latestAuditByListingId.values()]
        .map((v) => v.reviewerUserId)
        .filter((id): id is string => !!id);

      const reviewers = reviewerIds.length
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

      const reviewersMap = new Map<string, ServiceListingReviewerInfo>(
        reviewers.map((r) => [
          r.id,
          {
            id: r.id,
            firstName: r.firstName ?? "",
            lastName: r.lastName ?? "",
            profileImageUrl: r.profileImageUrl,
          },
        ]),
      );

      const listings = rows.map((row) => {
        const totalListingsForProvider =
          countsByProviderId.get(row.provider.id) ?? 0;
        const otherListingsCount = Math.max(0, totalListingsForProvider - 1);

        const latestAudit = latestAuditByListingId.get(row.listing.id);

        return {
          ...row.listing,
          category: row.category,
          provider: {
            id: row.provider.id,
            firstName: row.provider.firstName ?? "",
            lastName: row.provider.lastName ?? "",
            profileImageUrl: row.provider.profileImageUrl,
            email: row.provider.email,
            isVerified: row.provider.isVerified,
            createdAt: row.provider.createdAt,
            otherListingsCount,
            averageRating: Number(row.provider.averageRating ?? 0),
            totalReviews: Number(row.provider.totalReviews ?? 0),
          },
          reviewedAt: latestAudit?.reviewedAt ?? null,
          reviewedBy: latestAudit?.reviewerUserId
            ? (reviewersMap.get(latestAudit.reviewerUserId) ?? null)
            : null,
          reviewEvents: (eventsByListingId.get(row.listing.id) ?? []).map(
            (event) => ({
              id: event.id,
              entityKind: event.entityKind,
              entityId: event.entityId,
              eventType: event.eventType,
              actorUserId: event.actorUserId,
              note: event.note,
              createdAt: event.createdAt,
              actor: event.actorUserId
                ? (actorById.get(event.actorUserId) ?? null)
                : null,
            }),
          ),
        };
      });

      return this.createPaginatedResult(
        listings,
        Number(total || 0),
        pagination.page,
        pagination.limit,
      );
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.findReviewHistory");
    }
  }

  /**
   * Whether the provider owns at least one published (status='active') service listing.
   * Uses LIMIT 1 — cheaper than a full count when the caller only needs a boolean.
   */
  async hasPublishedListings(providerId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: serviceListings.id })
        .from(serviceListings)
        .where(
          and(
            eq(serviceListings.providerId, providerId),
            eq(serviceListings.status, "active"),
          ),
        )
        .limit(1);
      return result.length > 0;
    } catch (error) {
      this.handleError(error, "ServiceListingDAL.hasPublishedListings");
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
