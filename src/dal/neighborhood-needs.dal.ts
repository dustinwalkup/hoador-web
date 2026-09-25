import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
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
import {
  bucketDistanceMiles,
  snapCoordinatesForPrivacy,
} from "@/lib/utils/geo-privacy";

const {
  listings,
  serviceListings,
  communities,
  user,
  userAddresses,
  listingCategories,
  serviceListingCategories,
} = schema;

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
 * - **who posted it** — display name and avatar (P-E13-6)
 * - the requester's aggregate rating (numeric string, or null if unrated)
 * - **the category's name** (P-E13-6)
 * - distance in miles from the viewer to the requester's home (null when either
 *   party has no saved address)
 *
 * `requesterName` and `categoryName` were added because a need card could not
 * say who posted it or what it was about: the row carried `createdByUserId` and
 * a bare `categoryId` and nothing else. Every other card in the product names a
 * person, and `category_id` has **no foreign key** — it points at
 * `listing_categories` or `service_listing_categories` depending on `type`
 * (validated in the service layer), so a client cannot resolve it without
 * knowing that rule and holding both lists.
 */
export interface NeedEnrichment {
  communityName: string;
  /**
   * Composed server-side from two nullable columns. Null — never the string
   * `"null null"` — when the creator has filled in neither: the trap Epic 11's
   * F5 found live on the messaging endpoints.
   */
  requesterName: string | null;
  requesterAvatarUrl: string | null;
  requesterRating: string | null;
  requesterReviewCount: number;
  /** Resolved against the type-appropriate table; null if the category is gone. */
  categoryName: string | null;
  distanceMiles: number | null;
}

/** Join two nullable name columns without ever emitting "null null" (Epic 11 F5). */
function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const composed = [firstName, lastName].filter(Boolean).join(" ").trim();
  return composed.length > 0 ? composed : null;
}

/**
 * Viewer→requester distance with the requester's point snapped to a grid cell
 * first, then bucketed. An exact distance let any member trilaterate a
 * need-poster's home by moving their own address (PRIV-02).
 */
function coarseDistanceMiles(
  viewer: LatLng,
  requester: LatLng,
  requesterUserId: string,
): number {
  const snapped = snapCoordinatesForPrivacy(
    requester.latitude,
    requester.longitude,
    requesterUserId,
  );
  return bucketDistanceMiles(haversineMiles(viewer, snapped));
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

      // ⚠️ EVERY value below is BOUND, never interpolated. This block used to
      // build the predicate by string concatenation, and `categoryId` reaches it
      // straight off the query string (`/api/needs` reads `sp.get("categoryId")`)
      // — a bare `AND n.category_id = '<client text>'` inside `sql.raw` is a SQL
      // injection, and it was one. `sql` (tagged) parameterizes; `sql.raw` does
      // not. The route now also rejects a non-uuid `categoryId` with a 400, but
      // THIS is the fix: a second caller must not be able to reopen the hole by
      // forgetting to validate.
      const communityFilter = sql.join(
        visibleCommunityIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );

      const typeClause = filters.type
        ? sql` AND n.type = ${filters.type}`
        : sql``;
      // Cast explicitly: `category_id` is `uuid`, and an unparameterized-looking
      // comparison against a text parameter is what tempted the concatenation.
      const categoryClause = filters.categoryId
        ? sql` AND n.category_id = ${filters.categoryId}::uuid`
        : sql``;
      const openOnlyClause =
        filters.openOnly !== false ? sql` AND n.status = 'open'` : sql``;
      // Session-derived id (see NeedFeedFilters.createdByUserId), not client input
      // — bound anyway, because "this caller is trusted" is how the other one got
      // written.
      const createdByClause = filters.createdByUserId
        ? sql` AND n.created_by_user_id = ${filters.createdByUserId}`
        : sql``;

      const baseWhere = sql`
        n.community_id IN (${communityFilter})
        AND n.deleted_at IS NULL${openOnlyClause}${typeClause}${categoryClause}${createdByClause}
      `;

      type FeedRawRow = Record<string, unknown> & {
        communityName?: string;
        requesterFirstName?: string | null;
        requesterLastName?: string | null;
        requesterAvatarUrl?: string | null;
        requesterRating?: string | null;
        requesterReviewCount?: number | string;
        categoryName?: string | null;
        requesterLat?: string | null;
        requesterLng?: string | null;
        linkedListingCount?: number;
      };

      const [rows, countRows] = await Promise.all([
        this.db.execute<FeedRawRow>(
          sql`
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
                   u.first_name AS "requesterFirstName",
                   u.last_name AS "requesterLastName",
                   u.profile_image_url AS "requesterAvatarUrl",
                   u.review_aggregate_rating AS "requesterRating",
                   u.review_count AS "requesterReviewCount",
                   -- category_id has no FK: it means listing_categories for a
                   -- rental need and service_listing_categories for a service
                   -- one (D4, validated in the service layer). Both joins are
                   -- guarded on n.type, so exactly one can match.
                   COALESCE(lc.name, slc.name) AS "categoryName",
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
            LEFT JOIN listing_categories lc
              ON n.type = 'rental' AND lc.id = n.category_id
            LEFT JOIN service_listing_categories slc
              ON n.type = 'service' AND slc.id = n.category_id
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
          `,
        ),
        this.db.execute<Record<string, unknown> & { total?: string }>(
          sql`
            SELECT count(*)::int AS total
            FROM neighborhood_needs n
            JOIN community_visibility cv
              ON cv.user_id = n.created_by_user_id
             AND cv.community_id = n.community_id
             AND cv.is_visible = true
            WHERE ${baseWhere}
          `,
        ),
      ]);

      const data = rows.rows.map((raw) => {
        const {
          requesterLat,
          requesterLng,
          requesterFirstName,
          requesterLastName,
          requesterAvatarUrl,
          requesterRating,
          requesterReviewCount,
          categoryName,
          communityName,
          ...rest
        } = raw as FeedRawRow;

        const distanceMiles =
          viewerLocation && requesterLat != null && requesterLng != null
            ? coarseDistanceMiles(
                viewerLocation,
                {
                  latitude: Number(requesterLat),
                  longitude: Number(requesterLng),
                },
                String(rest.createdByUserId),
              )
            : null;

        return {
          ...rest,
          communityName: String(communityName ?? ""),
          requesterName: displayName(requesterFirstName, requesterLastName),
          requesterAvatarUrl: requesterAvatarUrl ?? null,
          requesterRating:
            requesterRating != null ? String(requesterRating) : null,
          requesterReviewCount: Number(requesterReviewCount ?? 0),
          categoryName: categoryName ?? null,
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
   * Resolve the community name, the requester's identity and rating, the
   * category name, and the viewer→requester distance for a single need.
   * Distance is null when either party has no saved address.
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
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.profileImageUrl,
        rating: user.reviewAggregateRating,
        reviewCount: user.reviewCount,
      })
      .from(user)
      .where(eq(user.id, need.createdByUserId))
      .limit(1);

    const categoryName = await this.getCategoryName(need.type, need.categoryId);

    const requesterLocation = await this.getUserPrimaryLocation(
      need.createdByUserId,
    );

    const distanceMiles =
      viewerLocation && requesterLocation
        ? coarseDistanceMiles(
            viewerLocation,
            requesterLocation,
            need.createdByUserId,
          )
        : null;

    return {
      communityName: community?.name ?? "",
      requesterName: displayName(requester?.firstName, requester?.lastName),
      requesterAvatarUrl: requester?.avatarUrl ?? null,
      requesterRating: requester?.rating ?? null,
      requesterReviewCount: requester?.reviewCount ?? 0,
      categoryName,
      distanceMiles,
    };
  }

  /**
   * Resolve a need's category name from the table its `type` points at.
   *
   * `neighborhood_needs.category_id` carries **no foreign key** — it references
   * `listing_categories` for a rental need and `service_listing_categories` for
   * a service one, enforced in the service layer (D4). That rule lives here so
   * a client does not have to know it, or hold both category lists to apply it.
   */
  private async getCategoryName(
    type: NeedType,
    categoryId: string,
  ): Promise<string | null> {
    if (type === "rental") {
      const [row] = await this.db
        .select({ name: listingCategories.name })
        .from(listingCategories)
        .where(eq(listingCategories.id, categoryId))
        .limit(1);
      return row?.name ?? null;
    }

    const [row] = await this.db
      .select({ name: serviceListingCategories.name })
      .from(serviceListingCategories)
      .where(eq(serviceListingCategories.id, categoryId))
      .limit(1);
    return row?.name ?? null;
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

  /**
   * How many needs a user has open now, and how many they created since
   * `since` in any state, deleted ones included (a deleted post still fanned
   * out). One query, for the posting throttle in `createNeed` (SEC-15).
   */
  async getPostingCounts(
    userId: string,
    since: Date,
  ): Promise<{ open: number; recent: number }> {
    try {
      const [result] = await this.db
        .select({
          open: sql<number>`count(*) FILTER (WHERE ${neighborhoodNeeds.status} = 'open' AND ${neighborhoodNeeds.deletedAt} IS NULL)`,
          recent: sql<number>`count(*) FILTER (WHERE ${gte(neighborhoodNeeds.createdAt, since)})`,
        })
        .from(neighborhoodNeeds)
        .where(eq(neighborhoodNeeds.createdByUserId, userId));
      return {
        open: Number(result?.open ?? 0),
        recent: Number(result?.recent ?? 0),
      };
    } catch (error) {
      this.handleError(error, "getPostingCounts");
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
            // Was a hand-built `ANY(ARRAY['<id>',…])` through `sql.raw`. These
            // ids come from the session's visibility set rather than the client,
            // so it was not the injection `listFeed` was — but it is the same
            // pattern one refactor away from taking client input, and `inArray`
            // binds them. Leave no interpolated identifier lists in this file.
            inArray(neighborhoodNeeds.communityId, visibleCommunityIds),
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
      // Rethrow unique-constraint as ConflictError so callers can swallow it
      // cleanly. drizzle wraps the pg error; its code is on `.cause` (SEC-16).
      const pgError = (error as { cause?: { code?: string } }).cause ?? error;
      if ((pgError as { code?: string }).code === "23505") {
        throw new ConflictError("This listing is already linked to a need");
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
