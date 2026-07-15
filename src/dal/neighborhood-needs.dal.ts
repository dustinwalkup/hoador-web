import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { BaseDAL } from "./base";
import { ConflictError, NotFoundError } from "./errors";
import { type PaginatedResult, type PaginationOptions } from "./types";
import {
  neighborhoodNeedListings,
  neighborhoodNeeds,
  type NeighborhoodNeed,
  type NeighborhoodNeedListing,
  type NewNeighborhoodNeed,
} from "@/db/schemas/neighborhood-needs.schema";
import { schema } from "@/db/schemas";
import type { needCloseReasonEnum, needTypeEnum } from "@/db/schemas/_enums";
import { haversineMiles, type LatLng } from "@/lib/utils/geo.utils";

const { listings, serviceListings, communities, user, userAddresses } = schema;

export type NeedType = (typeof needTypeEnum.enumValues)[number];
export type NeedCloseReason = (typeof needCloseReasonEnum.enumValues)[number];

export interface NeedFeedFilters {
  type?: NeedType;
  categoryId?: string;
  openOnly?: boolean;
  /**
   * Restrict the feed to needs created by this user. Must be a
   * session-derived id set server-side — never accept a raw user id from the
   * client (see the `mine` param in the /api/needs route).
   */
  createdByUserId?: string;
}

/**
 * Enrichment shared by the feed and detail views:
 * - community name for the need
 * - the requester's aggregate rating (numeric string, or null if unrated)
 * - distance in miles from the viewer to the requester's home (null when either
 *   party has no saved address)
 */
export interface NeedEnrichment {
  communityName: string;
  requesterRating: string | null;
  requesterReviewCount: number;
  distanceMiles: number | null;
}

export interface NeedFeedRow extends NeighborhoodNeed, NeedEnrichment {
  linkedListingCount: number;
}

export interface LinkedListingSummary {
  id: string;
  listingType: NeedType;
  listingId: string;
  title: string | null;
  href: string;
  isLive: boolean;
  createdAt: Date;
}

export interface NeedDetail extends NeighborhoodNeed, NeedEnrichment {
  linkedListings: LinkedListingSummary[];
}

export class NeighborhoodNeedsDAL extends BaseDAL {
  // ============================
  // CRUD
  // ============================

  async createNeed(data: NewNeighborhoodNeed): Promise<NeighborhoodNeed> {
    try {
      const [need] = await this.db
        .insert(neighborhoodNeeds)
        .values(data)
        .returning();
      return need;
    } catch (error) {
      this.handleError(error, "createNeed");
    }
  }

  /** Excludes soft-deleted rows. */
  async getNeedById(id: string): Promise<NeighborhoodNeed | null> {
    try {
      const [need] = await this.db
        .select()
        .from(neighborhoodNeeds)
        .where(
          and(
            eq(neighborhoodNeeds.id, id),
            isNull(neighborhoodNeeds.deletedAt),
          ),
        )
        .limit(1);
      return need ?? null;
    } catch (error) {
      this.handleError(error, "getNeedById");
    }
  }

  /** Includes soft-deleted rows (admin use). */
  async getNeedByIdIncludingDeleted(
    id: string,
  ): Promise<NeighborhoodNeed | null> {
    try {
      const [need] = await this.db
        .select()
        .from(neighborhoodNeeds)
        .where(eq(neighborhoodNeeds.id, id))
        .limit(1);
      return need ?? null;
    } catch (error) {
      this.handleError(error, "getNeedByIdIncludingDeleted");
    }
  }

  async updateNeed(
    id: string,
    data: Partial<
      Pick<
        NeighborhoodNeed,
        | "title"
        | "description"
        | "categoryId"
        | "neededStartDate"
        | "neededEndDate"
      >
    >,
  ): Promise<NeighborhoodNeed> {
    try {
      const [updated] = await this.db
        .update(neighborhoodNeeds)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(neighborhoodNeeds.id, id),
            isNull(neighborhoodNeeds.deletedAt),
          ),
        )
        .returning();
      if (!updated) throw new NotFoundError("Need", id);
      return updated;
    } catch (error) {
      this.handleError(error, "updateNeed");
    }
  }

  /** Idempotent — calling again on an already-closed need is a no-op. */
  async closeNeed(
    id: string,
    reason: NeedCloseReason,
  ): Promise<NeighborhoodNeed> {
    try {
      const [updated] = await this.db
        .update(neighborhoodNeeds)
        .set({
          status: "closed",
          closeReason: reason,
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(neighborhoodNeeds.id, id),
            isNull(neighborhoodNeeds.deletedAt),
          ),
        )
        .returning();
      if (!updated) throw new NotFoundError("Need", id);
      return updated;
    } catch (error) {
      this.handleError(error, "closeNeed");
    }
  }

  async softDeleteNeed(id: string): Promise<void> {
    try {
      const [updated] = await this.db
        .update(neighborhoodNeeds)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(neighborhoodNeeds.id, id))
        .returning({ id: neighborhoodNeeds.id });
      if (!updated) throw new NotFoundError("Need", id);
    } catch (error) {
      this.handleError(error, "softDeleteNeed");
    }
  }

  // ============================
  // Feed / detail
  // ============================

  /**
   * Symmetric visibility feed mirroring searchListings:
   * - Viewer side: need.community_id IN (visibleCommunityIds)
   * - Creator side: JOIN community_visibility on (creator, community_id) requiring is_visible = true
   * Empty visibleCommunityIds → empty result without hitting the DB.
   */
  async listFeed(
    visibleCommunityIds: string[],
    filters: NeedFeedFilters,
    pagination: PaginationOptions,
    viewerLocation: LatLng | null = null,
  ): Promise<PaginatedResult<NeedFeedRow>> {
    if (visibleCommunityIds.length === 0) {
      return this.createPaginatedResult<NeedFeedRow>(
        [],
        0,
        pagination.page,
        pagination.limit,
      );
    }

    try {
      this.validatePagination(pagination.page, pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;

      const communityIdList = visibleCommunityIds
        .map((id) => `'${id}'`)
        .join(",");

      const typeClause = filters.type ? `AND n.type = '${filters.type}'` : "";
      const categoryClause = filters.categoryId
        ? `AND n.category_id = '${filters.categoryId}'`
        : "";
      const openOnlyClause =
        filters.openOnly !== false ? `AND n.status = 'open'` : "";
      // Session-derived id (see NeedFeedFilters.createdByUserId), not client input.
      const createdByClause = filters.createdByUserId
        ? `AND n.created_by_user_id = '${filters.createdByUserId}'`
        : "";

      const baseWhere = `
        n.community_id IN (${communityIdList})
        AND n.deleted_at IS NULL
        ${openOnlyClause}
        ${typeClause}
        ${categoryClause}
        ${createdByClause}
      `;

      type FeedRawRow = Record<string, unknown> & {
        communityName?: string;
        requesterRating?: string | null;
        requesterReviewCount?: number | string;
        requesterLat?: string | null;
        requesterLng?: string | null;
        linkedListingCount?: number;
      };

      const [rows, countRows] = await Promise.all([
        this.db.execute<FeedRawRow>(
          sql.raw(`
            SELECT n.id,
                   n.created_by_user_id AS "createdByUserId",
                   n.community_id AS "communityId",
                   n.type,
                   n.category_id AS "categoryId",
                   n.title,
                   n.description,
                   n.needed_start_date AS "neededStartDate",
                   n.needed_end_date AS "neededEndDate",
                   n.status,
                   n.close_reason AS "closeReason",
                   -- created_at/updated_at/etc. are "timestamp without time
                   -- zone" (stored as UTC wall-clock). The neon driver parses a
                   -- naive timestamp as LOCAL time, shifting recent rows into
                   -- the future. AT TIME ZONE 'UTC' reinterprets them as UTC so
                   -- the driver returns the correct instant. Drizzle's query
                   -- builder does this implicitly; raw SQL must do it here.
                   n.closed_at AT TIME ZONE 'UTC' AS "closedAt",
                   n.deleted_at AT TIME ZONE 'UTC' AS "deletedAt",
                   n.created_at AT TIME ZONE 'UTC' AS "createdAt",
                   n.updated_at AT TIME ZONE 'UTC' AS "updatedAt",
                   c.name AS "communityName",
                   u.review_aggregate_rating AS "requesterRating",
                   u.review_count AS "requesterReviewCount",
                   addr.latitude AS "requesterLat",
                   addr.longitude AS "requesterLng",
                   COALESCE(l.cnt, 0)::int AS "linkedListingCount"
            FROM neighborhood_needs n
            JOIN community_visibility cv
              ON cv.user_id = n.created_by_user_id
             AND cv.community_id = n.community_id
             AND cv.is_visible = true
            JOIN communities c ON c.id = n.community_id
            JOIN "user" u ON u.id = n.created_by_user_id
            LEFT JOIN LATERAL (
              SELECT ua.latitude, ua.longitude
              FROM user_addresses ua
              WHERE ua.user_id = n.created_by_user_id
              ORDER BY ua.is_primary DESC
              LIMIT 1
            ) addr ON true
            LEFT JOIN LATERAL (
              SELECT count(*) AS cnt
              FROM neighborhood_need_listings nl
              WHERE nl.neighborhood_need_id = n.id
            ) l ON true
            WHERE ${baseWhere}
            ORDER BY n.created_at DESC
            LIMIT ${pagination.limit} OFFSET ${offset}
          `),
        ),
        this.db.execute<Record<string, unknown> & { total?: string }>(
          sql.raw(`
            SELECT count(*)::int AS total
            FROM neighborhood_needs n
            JOIN community_visibility cv
              ON cv.user_id = n.created_by_user_id
             AND cv.community_id = n.community_id
             AND cv.is_visible = true
            WHERE ${baseWhere}
          `),
        ),
      ]);

      const data = rows.rows.map((raw) => {
        const {
          requesterLat,
          requesterLng,
          requesterRating,
          requesterReviewCount,
          communityName,
          ...rest
        } = raw as FeedRawRow;

        const distanceMiles =
          viewerLocation && requesterLat != null && requesterLng != null
            ? haversineMiles(viewerLocation, {
                latitude: Number(requesterLat),
                longitude: Number(requesterLng),
              })
            : null;

        return {
          ...rest,
          communityName: String(communityName ?? ""),
          requesterRating:
            requesterRating != null ? String(requesterRating) : null,
          requesterReviewCount: Number(requesterReviewCount ?? 0),
          distanceMiles,
          linkedListingCount: Number(rest.linkedListingCount ?? 0),
        };
      }) as NeedFeedRow[];

      const total = Number(
        (countRows.rows[0] as Record<string, unknown>)?.["total"] ?? 0,
      );
      return this.createPaginatedResult(
        data,
        total,
        pagination.page,
        pagination.limit,
      );
    } catch (error) {
      this.handleError(error, "listFeed");
    }
  }

  /** Need with linked listings, polymorphically resolved to title + href + isLive. */
  async getNeedDetail(
    id: string,
    viewerLocation: LatLng | null = null,
  ): Promise<NeedDetail | null> {
    try {
      const need = await this.getNeedById(id);
      if (!need) return null;

      const linkRows = await this.db
        .select()
        .from(neighborhoodNeedListings)
        .where(eq(neighborhoodNeedListings.neighborhoodNeedId, id))
        .orderBy(desc(neighborhoodNeedListings.createdAt));

      const linkedListings: LinkedListingSummary[] = await Promise.all(
        linkRows.map(async (link) => {
          if (link.listingType === "rental") {
            const [listing] = await this.db
              .select({
                name: listings.name,
                approvalStatus: listings.approvalStatus,
              })
              .from(listings)
              .where(eq(listings.id, link.listingId))
              .limit(1);
            return {
              id: link.id,
              listingType: link.listingType as NeedType,
              listingId: link.listingId,
              title: listing?.name ?? null,
              href: `/dashboard/listings/${link.listingId}`,
              isLive: listing?.approvalStatus === "approved",
              createdAt: link.createdAt,
            };
          } else {
            const [listing] = await this.db
              .select({
                title: serviceListings.title,
                status: serviceListings.status,
              })
              .from(serviceListings)
              .where(eq(serviceListings.id, link.listingId))
              .limit(1);
            return {
              id: link.id,
              listingType: link.listingType as NeedType,
              listingId: link.listingId,
              title: listing?.title ?? null,
              href: `/dashboard/services/listings/${link.listingId}`,
              isLive: listing?.status === "active",
              createdAt: link.createdAt,
            };
          }
        }),
      );

      const enrichment = await this.getNeedEnrichment(need, viewerLocation);

      return { ...need, ...enrichment, linkedListings };
    } catch (error) {
      this.handleError(error, "getNeedDetail");
    }
  }

  /**
   * Resolve the community name, requester rating, and viewer→requester distance
   * for a single need. Distance is null when either party has no saved address.
   */
  private async getNeedEnrichment(
    need: NeighborhoodNeed,
    viewerLocation: LatLng | null,
  ): Promise<NeedEnrichment> {
    const [community] = await this.db
      .select({ name: communities.name })
      .from(communities)
      .where(eq(communities.id, need.communityId))
      .limit(1);

    const [requester] = await this.db
      .select({
        rating: user.reviewAggregateRating,
        reviewCount: user.reviewCount,
      })
      .from(user)
      .where(eq(user.id, need.createdByUserId))
      .limit(1);

    const requesterLocation = await this.getUserPrimaryLocation(
      need.createdByUserId,
    );

    const distanceMiles =
      viewerLocation && requesterLocation
        ? haversineMiles(viewerLocation, requesterLocation)
        : null;

    return {
      communityName: community?.name ?? "",
      requesterRating: requester?.rating ?? null,
      requesterReviewCount: requester?.reviewCount ?? 0,
      distanceMiles,
    };
  }

  /**
   * The user's primary address as lat/lng, falling back to any saved address.
   * Returns null when the user has no address or it lacks coordinates.
   */
  async getUserPrimaryLocation(userId: string): Promise<LatLng | null> {
    try {
      const [addr] = await this.db
        .select({
          latitude: userAddresses.latitude,
          longitude: userAddresses.longitude,
        })
        .from(userAddresses)
        .where(eq(userAddresses.userId, userId))
        .orderBy(desc(userAddresses.isPrimary))
        .limit(1);

      if (!addr?.latitude || !addr?.longitude) return null;
      return {
        latitude: Number(addr.latitude),
        longitude: Number(addr.longitude),
      };
    } catch (error) {
      this.handleError(error, "getUserPrimaryLocation");
    }
  }

  async listNeedsByUser(
    userId: string,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<NeighborhoodNeed>> {
    try {
      this.validatePagination(pagination.page, pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;

      const condition = and(
        eq(neighborhoodNeeds.createdByUserId, userId),
        isNull(neighborhoodNeeds.deletedAt),
      );

      const [data, totalResult] = await Promise.all([
        this.db
          .select()
          .from(neighborhoodNeeds)
          .where(condition)
          .orderBy(desc(neighborhoodNeeds.createdAt))
          .limit(pagination.limit)
          .offset(offset),
        this.db
          .select({ total: count() })
          .from(neighborhoodNeeds)
          .where(condition),
      ]);

      const total = Number(totalResult[0]?.total ?? 0);
      return this.createPaginatedResult(
        data,
        total,
        pagination.page,
        pagination.limit,
      );
    } catch (error) {
      this.handleError(error, "listNeedsByUser");
    }
  }

  /** Open needs visible in the given communities — for Dashboard Pulse. */
  async countOpenVisibleNeeds(visibleCommunityIds: string[]): Promise<number> {
    if (visibleCommunityIds.length === 0) return 0;

    try {
      const [result] = await this.db
        .select({ total: count() })
        .from(neighborhoodNeeds)
        .where(
          and(
            eq(neighborhoodNeeds.status, "open"),
            isNull(neighborhoodNeeds.deletedAt),
            // Drizzle doesn't have inArray for uuid[] parameter natively here,
            // but the array is already validated above so we can use sql tag.
            sql`${neighborhoodNeeds.communityId} = ANY(ARRAY[${sql.raw(visibleCommunityIds.map((id) => `'${id}'`).join(","))}]::uuid[])`,
          ),
        );
      return Number(result?.total ?? 0);
    } catch (error) {
      this.handleError(error, "countOpenVisibleNeeds");
    }
  }

  // ============================
  // Linking
  // ============================

  async linkListing(args: {
    neighborhoodNeedId: string;
    listingType: NeedType;
    listingId: string;
  }): Promise<NeighborhoodNeedListing> {
    try {
      const [row] = await this.db
        .insert(neighborhoodNeedListings)
        .values(args)
        .returning();
      return row;
    } catch (error) {
      // Rethrow unique-constraint as ConflictError so callers can swallow it cleanly
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictError(
          "This listing is already linked to a neighborhood need",
        );
      }
      this.handleError(error, "linkListing");
    }
  }

  async getLinkByListing(
    listingType: NeedType,
    listingId: string,
  ): Promise<NeighborhoodNeedListing | null> {
    try {
      const [row] = await this.db
        .select()
        .from(neighborhoodNeedListings)
        .where(
          and(
            eq(neighborhoodNeedListings.listingType, listingType),
            eq(neighborhoodNeedListings.listingId, listingId),
          ),
        )
        .limit(1);
      return row ?? null;
    } catch (error) {
      this.handleError(error, "getLinkByListing");
    }
  }

  async findOpenNeedsLinkedToListing(
    listingType: NeedType,
    listingId: string,
  ): Promise<NeighborhoodNeed[]> {
    try {
      const rows = await this.db
        .select({ need: neighborhoodNeeds })
        .from(neighborhoodNeedListings)
        .innerJoin(
          neighborhoodNeeds,
          eq(neighborhoodNeedListings.neighborhoodNeedId, neighborhoodNeeds.id),
        )
        .where(
          and(
            eq(neighborhoodNeedListings.listingType, listingType),
            eq(neighborhoodNeedListings.listingId, listingId),
            eq(neighborhoodNeeds.status, "open"),
            isNull(neighborhoodNeeds.deletedAt),
          ),
        );
      return rows.map((r) => r.need);
    } catch (error) {
      this.handleError(error, "findOpenNeedsLinkedToListing");
    }
  }

  async listLinkedListings(needId: string): Promise<LinkedListingSummary[]> {
    try {
      const linkRows = await this.db
        .select()
        .from(neighborhoodNeedListings)
        .where(eq(neighborhoodNeedListings.neighborhoodNeedId, needId))
        .orderBy(desc(neighborhoodNeedListings.createdAt));

      return Promise.all(
        linkRows.map(async (link) => {
          if (link.listingType === "rental") {
            const [listing] = await this.db
              .select({
                name: listings.name,
                approvalStatus: listings.approvalStatus,
              })
              .from(listings)
              .where(eq(listings.id, link.listingId))
              .limit(1);
            return {
              id: link.id,
              listingType: link.listingType as NeedType,
              listingId: link.listingId,
              title: listing?.name ?? null,
              href: `/dashboard/listings/${link.listingId}`,
              isLive: listing?.approvalStatus === "approved",
              createdAt: link.createdAt,
            };
          } else {
            const [listing] = await this.db
              .select({
                title: serviceListings.title,
                status: serviceListings.status,
              })
              .from(serviceListings)
              .where(eq(serviceListings.id, link.listingId))
              .limit(1);
            return {
              id: link.id,
              listingType: link.listingType as NeedType,
              listingId: link.listingId,
              title: listing?.title ?? null,
              href: `/dashboard/services/listings/${link.listingId}`,
              isLive: listing?.status === "active",
              createdAt: link.createdAt,
            };
          }
        }),
      );
    } catch (error) {
      this.handleError(error, "listLinkedListings");
    }
  }
}
