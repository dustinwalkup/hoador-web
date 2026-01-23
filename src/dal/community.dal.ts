import { eq, and, sql, count, desc, asc } from "drizzle-orm";
import { BaseDAL } from "./base";
import {
  communities,
  communityMemberships,
  Community,
  NewCommunity,
  UpdateCommunity,
  CommunityMembership,
  CommunityWithStats,
  CommunityMembershipWithDetails,
  UserCommunityInfo,
} from "@/db/schemas/communities.schema";
import { user } from "@/db/schemas/user.schema";
import { listings } from "@/db/schemas/listings.schema";
import { ValidationError, NotFoundError } from "./errors";
import type { PaginatedResult } from "./types";

export class CommunityDAL extends BaseDAL {
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
      // For now, no auth check since no one can create communities yet
      // In the future: await requireAuth() and check admin permissions

      if (!data.name?.trim()) {
        throw new ValidationError("Community name is required");
      }

      if (!data.joinCode?.trim()) {
        throw new ValidationError("Join code is required");
      }

      // Check if join code already exists
      const existingCommunity = await this.getCommunityByJoinCode(
        data.joinCode,
      );
      if (existingCommunity) {
        throw new ValidationError("Join code already exists");
      }

      const [community] = await this.db
        .insert(communities)
        .values({
          ...data,
          name: data.name.trim(),
          joinCode: data.joinCode.trim(),
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
        .returning({ id: communities.id });

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
        .returning({ id: communityMemberships.id });

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
   * Join community during signup (no existing membership check needed)
   * Used specifically for new user signup flow
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

      // Community exists and is valid for joining

      // Add user as member (no existing membership check since it's a new user)
      const membership = await this.addMember(userId, community.id, "member");

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
}
