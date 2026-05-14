import { eq, and, sql, count, desc, asc } from "drizzle-orm";
import { BaseDAL } from "./base";
import {
  communities,
  communityMemberships,
  communityNetworks,
  communityVisibility,
  Community,
  NewCommunity,
  UpdateCommunity,
  CommunityMembership,
  CommunityNetwork,
  CommunityVisibility,
  CommunityVisibilityWithCommunity,
  CommunityWithStats,
  CommunityMembershipWithDetails,
  MembershipWithUserAndAddress,
  UserCommunityInfo,
} from "@/db/schemas/communities.schema";
import { user, userAddresses } from "@/db/schemas/user.schema";
import { listings } from "@/db/schemas/listings.schema";
import { AuditLogDAL } from "./audit-log.dal";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { MembershipByCommunityRow, PaginatedResult } from "./types";

export class CommunityDAL extends BaseDAL {
  private readonly auditLogDAL: AuditLogDAL;

  constructor(deps?: { auditLogDAL?: AuditLogDAL }) {
    super();
    this.auditLogDAL = deps?.auditLogDAL ?? new AuditLogDAL();
  }

  // ============================
  // Community CRUD Operations
  // ============================

  /**
   * Get community by ID
   */
  async getCommunityById(id: string): Promise<Community | null> {
    try {
      const [community] = await this.db
        .select()
        .from(communities)
        .where(eq(communities.id, id))
        .limit(1);

      return community || null;
    } catch (error) {
      this.handleError(error, "getCommunityById");
    }
  }

  /**
   * Get community name by user id
   */
  async getCommunityNameByUserId(userId: string): Promise<string | null> {
    try {
      const [result] = await this.db
        .select({
          name: communities.name,
        })
        .from(communities)
        .innerJoin(
          communityMemberships,
          eq(communities.id, communityMemberships.communityId),
        )
        .where(eq(communityMemberships.userId, userId))
        .limit(1);
      return result?.name || null;
    } catch (error) {
      this.handleError(error, "getCommunityNameByUserId");
    }
  }

  /**
   * Get community by join code
   */
  async getCommunityByJoinCode(joinCode: string): Promise<Community | null> {
    try {
      if (!joinCode?.trim()) {
        throw new ValidationError("Join code is required");
      }

      const [community] = await this.db
        .select()
        .from(communities)
        .where(eq(communities.joinCode, joinCode.trim()))
        .limit(1);

      return community || null;
    } catch (error) {
      this.handleError(error, "getCommunityByJoinCode");
    }
  }

  /**
   * Validate join code for signup (no auth required)
   * Returns community info if valid
   */
  async validateJoinCodeForSignup(joinCode: string): Promise<Community | null> {
    try {
      if (!joinCode?.trim()) {
        throw new ValidationError("Join code is required");
      }

      const [community] = await this.db
        .select()
        .from(communities)
        .where(eq(communities.joinCode, joinCode.trim()))
        .limit(1);

      return community || null;
    } catch (error) {
      this.handleError(error, "validateJoinCodeForSignup");
    }
  }

  /**
   * Get community with stats (member count, listing count)
   */
  async getCommunityWithStats(id: string): Promise<CommunityWithStats | null> {
    try {
      const result = await this.db
        .select({
          id: communities.id,
          name: communities.name,
          imageUrl: communities.imageUrl,
          joinCode: communities.joinCode,
          address: communities.address,
          city: communities.city,
          state: communities.state,
          zip: communities.zip,
          networkId: communities.networkId,
          latitude: communities.latitude,
          longitude: communities.longitude,
          isActive: communities.isActive,
          createdAt: communities.createdAt,
          updatedAt: communities.updatedAt,
          memberCount: sql<number>`COALESCE(${count(communityMemberships.id)}, 0)`,
          listingCount: sql<number>`COALESCE(${count(listings.id)}, 0)`,
        })
        .from(communities)
        .leftJoin(
          communityMemberships,
          eq(communities.id, communityMemberships.communityId),
        )
        .leftJoin(listings, eq(communities.id, listings.communityId))
        .where(eq(communities.id, id))
        .groupBy(communities.id)
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, "getCommunityWithStats");
    }
  }

  /**
   * List communities with pagination and optional stats
   */
  async listCommunities(options: {
    page: number;
    limit: number;
    includeStats?: boolean;
    sortBy?: "name" | "memberCount" | "createdAt";
    sortOrder?: "asc" | "desc";
  }): Promise<PaginatedResult<Community | CommunityWithStats>> {
    try {
      const {
        page,
        limit,
        includeStats = false,
        sortBy = "name",
        sortOrder = "asc",
      } = options;

      this.validatePagination(page, limit);

      const offset = (page - 1) * limit;

      if (includeStats) {
        // Query with stats
        const [data, totalResult] = await Promise.all([
          this.db
            .select({
              id: communities.id,
              name: communities.name,
              imageUrl: communities.imageUrl,
              joinCode: communities.joinCode,
              address: communities.address,
              city: communities.city,
              state: communities.state,
              zip: communities.zip,
              networkId: communities.networkId,
              latitude: communities.latitude,
              longitude: communities.longitude,
              isActive: communities.isActive,
              createdAt: communities.createdAt,
              updatedAt: communities.updatedAt,
              memberCount: sql<number>`COALESCE(COUNT(DISTINCT ${communityMemberships.id}), 0)`,
              listingCount: sql<number>`COALESCE(COUNT(DISTINCT ${listings.id}), 0)`,
            })
            .from(communities)
            .leftJoin(
              communityMemberships,
              eq(communities.id, communityMemberships.communityId),
            )
            .leftJoin(listings, eq(communities.id, listings.communityId))
            .groupBy(communities.id)
            .orderBy(
              sortOrder === "desc"
                ? desc(
                    sortBy === "memberCount"
                      ? sql`COUNT(DISTINCT ${communityMemberships.id})`
                      : sortBy === "createdAt"
                        ? communities.createdAt
                        : communities.name,
                  )
                : asc(
                    sortBy === "memberCount"
                      ? sql`COUNT(DISTINCT ${communityMemberships.id})`
                      : sortBy === "createdAt"
                        ? communities.createdAt
                        : communities.name,
                  ),
            )
            .limit(limit)
            .offset(offset),
          this.db.select({ count: count() }).from(communities),
        ]);

        const total = totalResult[0]?.count || 0;
        return this.createPaginatedResult(
          data as CommunityWithStats[],
          total,
          page,
          limit,
        );
      } else {
        // Simple query without stats
        const [data, totalResult] = await Promise.all([
          this.db
            .select()
            .from(communities)
            .orderBy(
              sortOrder === "desc"
                ? desc(
                    sortBy === "createdAt"
                      ? communities.createdAt
                      : communities.name,
                  )
                : asc(
                    sortBy === "createdAt"
                      ? communities.createdAt
                      : communities.name,
                  ),
            )
            .limit(limit)
            .offset(offset),
          this.db.select({ count: count() }).from(communities),
        ]);

        const total = totalResult[0]?.count || 0;
        return this.createPaginatedResult(data, total, page, limit);
      }
    } catch (error) {
      this.handleError(error, "listCommunities");
    }
  }

  /**
   * Create a new community (admin only in the future)
   */
  async createCommunity(
    data: Omit<NewCommunity, "id" | "createdAt" | "updatedAt">,
  ): Promise<Community> {
    try {
      if (!data.name?.trim()) {
        throw new ValidationError("Community name is required");
      }

      // joinCode is optional under the multi-community model — communities
      // created via the admin UI use the dropdown flow, not a code. When a
      // code IS supplied it must still be unique.
      const joinCode = data.joinCode?.trim() || null;
      if (joinCode) {
        const existingCommunity = await this.getCommunityByJoinCode(joinCode);
        if (existingCommunity) {
          throw new ValidationError("Join code already exists");
        }
      }

      const [community] = await this.db
        .insert(communities)
        .values({
          ...data,
          name: data.name.trim(),
          joinCode,
        })
        .returning();

      return community;
    } catch (error) {
      this.handleError(error, "createCommunity");
    }
  }

  /**
   * Update community (admin only)
   */
  async updateCommunity(id: string, data: UpdateCommunity): Promise<Community> {
    try {
      // For now, no auth check
      // In the future: check if user is admin of this community

      if (data.joinCode) {
        // Check if new join code conflicts with existing ones
        const existingCommunity = await this.getCommunityByJoinCode(
          data.joinCode,
        );
        if (existingCommunity && existingCommunity.id !== id) {
          throw new ValidationError("Join code already exists");
        }
      }

      const [community] = await this.db
        .update(communities)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(communities.id, id))
        .returning();

      if (!community) {
        throw new NotFoundError("Community not found");
      }

      return community;
    } catch (error) {
      this.handleError(error, "updateCommunity");
    }
  }

  /**
   * Delete community (admin only)
   */
  async deleteCommunity(id: string): Promise<void> {
    try {
      // For now, no auth check
      // In the future: check if user is admin of this community

      const result = await this.db
        .delete(communities)
        .where(eq(communities.id, id))
        .returning();

      if (!result.length) {
        throw new NotFoundError("Community not found");
      }
    } catch (error) {
      this.handleError(error, "deleteCommunity");
    }
  }

  // ============================
  // Membership Operations
  // ============================

  /**
   * Add a member to a community
   */
  async addMember(
    userId: string,
    communityId: string,
    role: "admin" | "member" = "member",
  ): Promise<CommunityMembership> {
    try {
      // Verify community exists
      const community = await this.getCommunityById(communityId);
      if (!community) {
        throw new NotFoundError("Community not found");
      }

      // Check if user is already a member
      const existingMembership = await this.db
        .select()
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.communityId, communityId),
          ),
        )
        .limit(1);

      if (existingMembership.length > 0) {
        throw new ValidationError("User is already a member of this community");
      }

      const [membership] = await this.db
        .insert(communityMemberships)
        .values({
          userId,
          communityId,
          role,
        })
        .returning();

      return membership;
    } catch (error) {
      this.handleError(error, "addMember");
    }
  }

  /**
   * Remove a member from a community
   */
  async removeMember(userId: string, communityId: string): Promise<void> {
    try {
      const result = await this.db
        .delete(communityMemberships)
        .where(
          and(
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.communityId, communityId),
          ),
        )
        .returning();

      if (!result.length) {
        throw new NotFoundError("Membership not found");
      }
    } catch (error) {
      this.handleError(error, "removeMember");
    }
  }

  /**
   * Get membership for a specific user
   */
  async getMembershipForUser(
    userId: string,
  ): Promise<UserCommunityInfo | null> {
    try {
      const [result] = await this.db
        .select({
          membership: communityMemberships,
          community: communities,
        })
        .from(communityMemberships)
        .innerJoin(
          communities,
          eq(communityMemberships.communityId, communities.id),
        )
        .where(eq(communityMemberships.userId, userId))
        .limit(1);

      return result || null;
    } catch (error) {
      this.handleError(error, "getMembershipForUser");
    }
  }

  /**
   * Get the user's primary (home) community membership, if any.
   *
   * Distinct from {@link getMembershipForUser}, which returns whatever
   * membership row turns up first. Callers that need the verification status
   * of the home community (e.g. the "verification pending" profile badge)
   * must use this.
   */
  async getPrimaryMembershipForUser(
    userId: string,
  ): Promise<UserCommunityInfo | null> {
    try {
      const [result] = await this.db
        .select({
          membership: communityMemberships,
          community: communities,
        })
        .from(communityMemberships)
        .innerJoin(
          communities,
          eq(communityMemberships.communityId, communities.id),
        )
        .where(
          and(
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.isPrimary, true),
          ),
        )
        .limit(1);

      return result || null;
    } catch (error) {
      this.handleError(error, "getPrimaryMembershipForUser");
    }
  }

  /**
   * List members of a community with pagination
   */
  async listMembers(
    communityId: string,
    options: { page: number; limit: number; role?: "admin" | "member" },
  ): Promise<PaginatedResult<CommunityMembershipWithDetails>> {
    try {
      const { page, limit, role } = options;
      this.validatePagination(page, limit);

      const offset = (page - 1) * limit;

      const whereConditions = [
        eq(communityMemberships.communityId, communityId),
      ];
      if (role) {
        whereConditions.push(eq(communityMemberships.role, role));
      }

      const [data, totalResult] = await Promise.all([
        this.db
          .select({
            id: communityMemberships.id,
            userId: communityMemberships.userId,
            communityId: communityMemberships.communityId,
            role: communityMemberships.role,
            isPrimary: communityMemberships.isPrimary,
            verificationStatus: communityMemberships.verificationStatus,
            verifiedAt: communityMemberships.verifiedAt,
            verifiedBy: communityMemberships.verifiedBy,
            adminNotes: communityMemberships.adminNotes,
            createdAt: communityMemberships.createdAt,
            community: communities,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              avatarUrl: user.profileImageUrl,
            },
          })
          .from(communityMemberships)
          .innerJoin(
            communities,
            eq(communityMemberships.communityId, communities.id),
          )
          .innerJoin(user, eq(communityMemberships.userId, user.id))
          .where(and(...whereConditions))
          .orderBy(desc(communityMemberships.createdAt))
          .limit(limit)
          .offset(offset),
        this.db
          .select({ count: count() })
          .from(communityMemberships)
          .where(and(...whereConditions)),
      ]);

      const total = totalResult[0]?.count || 0;
      return this.createPaginatedResult(data, total, page, limit);
    } catch (error) {
      this.handleError(error, "listMembers");
    }
  }

  /**
   * Update member role (admin only)
   */
  async updateMemberRole(
    userId: string,
    communityId: string,
    newRole: "admin" | "member",
  ): Promise<CommunityMembership> {
    try {
      // For now, no auth check
      // In the future: check if current user is admin of this community

      const [membership] = await this.db
        .update(communityMemberships)
        .set({ role: newRole })
        .where(
          and(
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.communityId, communityId),
          ),
        )
        .returning();

      if (!membership) {
        throw new NotFoundError("Membership not found");
      }

      return membership;
    } catch (error) {
      this.handleError(error, "updateMemberRole");
    }
  }

  /**
   * Join community by join code
   */
  async joinCommunityByCode(
    joinCode: string,
    userId: string,
  ): Promise<UserCommunityInfo> {
    try {
      // Find community by join code
      const community = await this.getCommunityByJoinCode(joinCode);
      if (!community) {
        throw new NotFoundError("Invalid join code");
      }

      // Check if user is already a member of any community
      const existingMembership = await this.getMembershipForUser(userId);
      if (existingMembership) {
        throw new ValidationError("User is already a member of a community");
      }

      // Add user as member
      const membership = await this.addMember(userId, community.id, "member");

      return {
        membership,
        community,
      };
    } catch (error) {
      this.handleError(error, "joinCommunityByCode");
    }
  }

  /**
   * Join community during signup via a join code (legacy `/join-code` flow).
   *
   * A valid join code is itself proof of residency, so the membership is
   * created as the user's primary and already `verified` — it does not
   * pass through the admin verification queue.
   */
  async joinCommunityForNewUser(
    userId: string,
    communityId: string,
  ): Promise<UserCommunityInfo> {
    try {
      // Get the community (should be valid since we validated the join code)
      const community = await this.getCommunityById(communityId);
      if (!community) {
        throw new NotFoundError("Community not found");
      }

      const [membership] = await this.db
        .insert(communityMemberships)
        .values({
          userId,
          communityId: community.id,
          role: "member",
          isPrimary: true,
          verificationStatus: "verified",
          verifiedAt: new Date(),
        })
        .returning();

      if (!membership) {
        throw new NotFoundError("Membership not found");
      }

      return {
        membership,
        community,
      };
    } catch (error) {
      this.handleError(error, "joinCommunityForNewUser");
    }
  }

  /**
   * Leave current community
   */
  async leaveCommunity(userId: string): Promise<void> {
    try {
      const membership = await this.getMembershipForUser(userId);
      if (!membership) {
        throw new NotFoundError("User is not a member of any community");
      }

      await this.removeMember(userId, membership.membership.communityId);
    } catch (error) {
      this.handleError(error, "leaveCommunity");
    }
  }

  // ============================
  // Utility Methods
  // ============================

  /**
   * Check if user is member of a specific community
   */
  async isUserMemberOfCommunity(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    try {
      const [membership] = await this.db
        .select({ id: communityMemberships.id })
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.communityId, communityId),
          ),
        )
        .limit(1);

      return !!membership;
    } catch (error) {
      this.handleError(error, "isUserMemberOfCommunity");
    }
  }

  /**
   * Returns membership counts per community (sum across communities = total memberships).
   */
  async getMembershipCountsByCommunity(): Promise<MembershipByCommunityRow[]> {
    try {
      const rows = await this.db
        .select({
          communityId: communities.id,
          communityName: communities.name,
          membershipCount: count(communityMemberships.id),
        })
        .from(communityMemberships)
        .innerJoin(
          communities,
          eq(communityMemberships.communityId, communities.id),
        )
        .groupBy(communities.id, communities.name)
        .orderBy(desc(count(communityMemberships.id)));

      return rows.map((r) => ({
        communityId: r.communityId,
        communityName: r.communityName,
        membershipCount: Number(r.membershipCount),
      }));
    } catch (error) {
      this.handleError(error, "getMembershipCountsByCommunity");
    }
  }

  /**
   * Lists communities for a user (earliest membership first).
   */
  async listCommunitiesForUser(
    userId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    try {
      return await this.db
        .select({
          id: communities.id,
          name: communities.name,
        })
        .from(communityMemberships)
        .innerJoin(
          communities,
          eq(communityMemberships.communityId, communities.id),
        )
        .where(eq(communityMemberships.userId, userId))
        .orderBy(asc(communityMemberships.createdAt));
    } catch (error) {
      this.handleError(error, "listCommunitiesForUser");
    }
  }

  /**
   * Get user's community ID (helper for other DALs)
   */
  async getUserCommunityId(userId: string): Promise<string | null> {
    try {
      const membership = await this.getMembershipForUser(userId);
      return membership?.community.id || null;
    } catch (error) {
      this.handleError(error, "getUserCommunityId");
    }
  }

  /**
   * Require user to be member of a community (throws if not)
   */
  async requireUserCommunityMembership(
    userId: string,
  ): Promise<UserCommunityInfo> {
    try {
      const membership = await this.getMembershipForUser(userId);
      if (!membership) {
        throw new ValidationError("User must be a member of a community");
      }

      return membership;
    } catch (error) {
      this.handleError(error, "requireUserCommunityMembership");
    }
  }

  // ============================
  // Network Operations (R6)
  // ============================

  async getNetworkById(id: string): Promise<CommunityNetwork | null> {
    try {
      const [network] = await this.db
        .select()
        .from(communityNetworks)
        .where(eq(communityNetworks.id, id))
        .limit(1);
      return network ?? null;
    } catch (error) {
      this.handleError(error, "getNetworkById");
    }
  }

  async getNetworkBySlug(slug: string): Promise<CommunityNetwork | null> {
    try {
      if (!slug?.trim()) {
        throw new ValidationError("Network slug is required");
      }
      const [network] = await this.db
        .select()
        .from(communityNetworks)
        .where(eq(communityNetworks.slug, slug.trim()))
        .limit(1);
      return network ?? null;
    } catch (error) {
      this.handleError(error, "getNetworkBySlug");
    }
  }

  async listNetworks(): Promise<CommunityNetwork[]> {
    try {
      return await this.db
        .select()
        .from(communityNetworks)
        .orderBy(asc(communityNetworks.name));
    } catch (error) {
      this.handleError(error, "listNetworks");
    }
  }

  async listCommunitiesByNetwork(
    networkId: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<Community[]> {
    try {
      const { activeOnly = false } = opts;
      const conditions = [eq(communities.networkId, networkId)];
      if (activeOnly) {
        conditions.push(eq(communities.isActive, true));
      }
      return await this.db
        .select()
        .from(communities)
        .where(and(...conditions))
        .orderBy(asc(communities.name));
    } catch (error) {
      this.handleError(error, "listCommunitiesByNetwork");
    }
  }

  // ============================
  // Primary Community Selection (R1, R3)
  // ============================

  /**
   * Sets a community as the user's primary (post-signup community-select flow).
   * Throws ConflictError if user already has a primary, ValidationError if
   * community is inactive, NotFoundError if community doesn't exist.
   */
  async selectPrimaryCommunity(
    userId: string,
    communityId: string,
  ): Promise<UserCommunityInfo> {
    try {
      const community = await this.getCommunityById(communityId);
      if (!community) {
        throw new NotFoundError("Community", communityId);
      }
      if (!community.isActive) {
        throw new ValidationError("Community is not active");
      }

      const [existingPrimary] = await this.db
        .select({ id: communityMemberships.id })
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.isPrimary, true),
          ),
        )
        .limit(1);

      if (existingPrimary) {
        throw new ConflictError(
          "User already has a primary community. Contact support to change it.",
        );
      }

      const [membership] = await this.db
        .insert(communityMemberships)
        .values({
          userId,
          communityId,
          role: "member",
          isPrimary: true,
          verificationStatus: "pending",
        })
        .returning();

      return { membership, community };
    } catch (error) {
      this.handleError(error, "selectPrimaryCommunity");
    }
  }

  // ============================
  // Visibility (R4)
  // ============================

  /**
   * Insert one community_visibility row per active community in the network
   * for this user. Idempotent via the (user_id, community_id) unique index.
   */
  async initializeUserVisibility(
    userId: string,
    networkId: string,
  ): Promise<void> {
    try {
      const networkCommunities = await this.listCommunitiesByNetwork(
        networkId,
        { activeOnly: true },
      );
      if (networkCommunities.length === 0) return;

      const rows = networkCommunities.map((c) => ({
        userId,
        communityId: c.id,
        isVisible: true,
      }));

      await this.db
        .insert(communityVisibility)
        .values(rows)
        .onConflictDoNothing({
          target: [communityVisibility.userId, communityVisibility.communityId],
        });
    } catch (error) {
      this.handleError(error, "initializeUserVisibility");
    }
  }

  /**
   * Hot path: returns the IDs of communities this user is currently visible
   * in. Consumed by the listing search.
   */
  async getVisibleCommunityIds(userId: string): Promise<string[]> {
    try {
      const rows = await this.db
        .select({ communityId: communityVisibility.communityId })
        .from(communityVisibility)
        .where(
          and(
            eq(communityVisibility.userId, userId),
            eq(communityVisibility.isVisible, true),
          ),
        );
      return rows.map((r) => r.communityId);
    } catch (error) {
      this.handleError(error, "getVisibleCommunityIds");
    }
  }

  /**
   * Whether `userId` is currently visible in `communityId` — a single point
   * lookup on the `(user_id, community_id)` unique index. A missing row counts
   * as not visible (fail-closed). Used by listing-detail authorization, where
   * a listing is viewable iff both the viewer and the owner are visible in the
   * listing's `community_id` (the same symmetric rule the search applies).
   */
  async isVisibleInCommunity(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    try {
      const [row] = await this.db
        .select({ isVisible: communityVisibility.isVisible })
        .from(communityVisibility)
        .where(
          and(
            eq(communityVisibility.userId, userId),
            eq(communityVisibility.communityId, communityId),
          ),
        )
        .limit(1);
      return row?.isVisible === true;
    } catch (error) {
      this.handleError(error, "isVisibleInCommunity");
    }
  }

  /**
   * Returns the user's full visibility list joined with each community —
   * used by the visibility-settings UI (every row, visible or hidden).
   * `isPrimary` is true for the user's home community (the one membership row
   * flagged primary); the UI renders that toggle as locked-visible.
   */
  async getVisibilityForUser(
    userId: string,
  ): Promise<CommunityVisibilityWithCommunity[]> {
    try {
      return await this.db
        .select({
          visibility: communityVisibility,
          community: communities,
          isPrimary: sql<boolean>`COALESCE(${communityMemberships.isPrimary}, false)`,
        })
        .from(communityVisibility)
        .innerJoin(
          communities,
          eq(communityVisibility.communityId, communities.id),
        )
        .leftJoin(
          communityMemberships,
          and(
            eq(
              communityMemberships.communityId,
              communityVisibility.communityId,
            ),
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.isPrimary, true),
          ),
        )
        .where(eq(communityVisibility.userId, userId))
        .orderBy(asc(communities.name));
    } catch (error) {
      this.handleError(error, "getVisibilityForUser");
    }
  }

  /**
   * Bulk upsert visibility flags for a user. Rejects toggling the user's
   * primary community to false (R4.5).
   */
  async bulkSetVisibility(
    userId: string,
    updates: Array<{ communityId: string; isVisible: boolean }>,
  ): Promise<CommunityVisibility[]> {
    try {
      if (updates.length === 0) return [];

      const [primary] = await this.db
        .select({ communityId: communityMemberships.communityId })
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.isPrimary, true),
          ),
        )
        .limit(1);

      if (primary) {
        const hidingPrimary = updates.find(
          (u) => u.communityId === primary.communityId && u.isVisible === false,
        );
        if (hidingPrimary) {
          throw new ValidationError("Cannot hide your home community");
        }
      }

      const results: CommunityVisibility[] = [];
      for (const u of updates) {
        const [row] = await this.db
          .insert(communityVisibility)
          .values({
            userId,
            communityId: u.communityId,
            isVisible: u.isVisible,
          })
          .onConflictDoUpdate({
            target: [
              communityVisibility.userId,
              communityVisibility.communityId,
            ],
            set: {
              isVisible: u.isVisible,
              updatedAt: new Date(),
            },
          })
          .returning();
        if (row) results.push(row);
      }

      return results;
    } catch (error) {
      this.handleError(error, "bulkSetVisibility");
    }
  }

  // ============================
  // Admin Verification Queue (R2, R9)
  // ============================

  /**
   * Paginated queue of pending memberships for the admin UI. Joins the user's
   * primary address so admins can review the submitted address inline.
   */
  async listPendingVerifications(opts: {
    page: number;
    limit: number;
    communityId?: string;
  }): Promise<PaginatedResult<MembershipWithUserAndAddress>> {
    try {
      const { page, limit, communityId } = opts;
      this.validatePagination(page, limit);
      const offset = (page - 1) * limit;

      const conditions = [
        eq(communityMemberships.verificationStatus, "pending"),
      ];
      if (communityId) {
        conditions.push(eq(communityMemberships.communityId, communityId));
      }

      const [data, totalResult] = await Promise.all([
        this.db
          .select({
            membership: communityMemberships,
            community: communities,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              avatarUrl: user.profileImageUrl,
            },
            address: {
              id: userAddresses.id,
              street: userAddresses.street,
              city: userAddresses.city,
              state: userAddresses.state,
              zipCode: userAddresses.zipCode,
              country: userAddresses.country,
            },
          })
          .from(communityMemberships)
          .innerJoin(
            communities,
            eq(communityMemberships.communityId, communities.id),
          )
          .innerJoin(user, eq(communityMemberships.userId, user.id))
          .leftJoin(
            userAddresses,
            and(
              eq(userAddresses.userId, communityMemberships.userId),
              eq(userAddresses.isPrimary, true),
            ),
          )
          .where(and(...conditions))
          .orderBy(asc(communityMemberships.createdAt))
          .limit(limit)
          .offset(offset),
        this.db
          .select({ count: count() })
          .from(communityMemberships)
          .where(and(...conditions)),
      ]);

      const total = totalResult[0]?.count || 0;
      return this.createPaginatedResult(
        data as MembershipWithUserAndAddress[],
        total,
        page,
        limit,
      );
    } catch (error) {
      this.handleError(error, "listPendingVerifications");
    }
  }

  /**
   * Admin sets a membership to verified. Records verifiedAt/verifiedBy and
   * appends an audit_logs row.
   */
  async verifyMembership(
    membershipId: string,
    adminUserId: string,
    adminNotes?: string,
  ): Promise<CommunityMembership> {
    try {
      const [updated] = await this.db
        .update(communityMemberships)
        .set({
          verificationStatus: "verified",
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
          adminNotes: adminNotes ?? null,
        })
        .where(eq(communityMemberships.id, membershipId))
        .returning();
      if (!updated) {
        throw new NotFoundError("Membership", membershipId);
      }

      await this.auditLogDAL.create({
        entityType: "community_membership",
        entityId: membershipId,
        action: "verification_verified",
        userId: adminUserId,
        metadata: adminNotes ? { adminNotes } : null,
      });

      return updated;
    } catch (error) {
      this.handleError(error, "verifyMembership");
    }
  }

  /**
   * Admin denies a membership. adminNotes is required (R2 admin runbook).
   * Appends an audit_logs row.
   */
  async denyMembership(
    membershipId: string,
    adminUserId: string,
    adminNotes: string,
  ): Promise<CommunityMembership> {
    try {
      if (!adminNotes?.trim()) {
        throw new ValidationError("admin_notes required when denying");
      }

      const [updated] = await this.db
        .update(communityMemberships)
        .set({
          verificationStatus: "denied",
          verifiedBy: adminUserId,
          adminNotes: adminNotes.trim(),
        })
        .where(eq(communityMemberships.id, membershipId))
        .returning();
      if (!updated) {
        throw new NotFoundError("Membership", membershipId);
      }

      await this.auditLogDAL.create({
        entityType: "community_membership",
        entityId: membershipId,
        action: "verification_denied",
        userId: adminUserId,
        metadata: { adminNotes: adminNotes.trim() },
      });

      return updated;
    } catch (error) {
      this.handleError(error, "denyMembership");
    }
  }
}
