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
  type CreateToolDTO,
  type ToolDetails,
  type UpdateToolDTO,
  type ToolSearchFilters,
  type PaginationOptions,
  type PaginatedResult,
} from "./types";
import { schema } from "@/db/schemas";
import { getCurrentUserId } from "@/lib/auth/auth.utils";
import { NotFoundError, UnauthorizedError } from "./errors";

const {
  tools,
  toolCategories,
  reviews,
  toolAvailability,
  userFavorites,
  toolImages,
  users,
} = schema;

type ToolDb = typeof tools.$inferSelect;
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

interface ToolWithRelations extends ToolDb {
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

// Type for the transformed tool data returned by getUserTools
export type UserTool = Omit<
  typeof tools.$inferSelect,
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

export interface GarageToolFilters {
  query?: string;
  categoryId?: string;
  sortBy?: "newest" | "name" | "lastRented";
  sortOrder?: "asc" | "desc";
  rentalStatus?: "available" | "rented"; // Only for active tools
}

export class ToolDAL extends BaseDAL {
  async createTool(
    ownerId: string,
    toolData: CreateToolDTO,
  ): Promise<typeof tools.$inferSelect> {
    try {
      const [tool] = await this.db
        .insert(tools)
        .values({
          ownerId,
          categoryId: toolData.categoryId,
          name: toolData.name,
          description: toolData.description,
          brand: toolData.brand,
          model: toolData.model,
          condition: toolData.condition,
          dailyRate: toolData.dailyRate.toString(),
          weeklyRate: toolData.weeklyRate?.toString(),
          monthlyRate: toolData.monthlyRate?.toString(),
          securityDeposit: (toolData.securityDeposit || 0).toString(),
          specifications: toolData.specifications || {},
          instructions: toolData.instructions,
          safetyNotes: toolData.safetyNotes,
          minimumRentalPeriod: toolData.minimumRentalPeriod || 1,
          maximumRentalPeriod: toolData.maximumRentalPeriod || 30,
          requiresPickup: toolData.requiresPickup ?? true,
          deliveryAvailable: toolData.deliveryAvailable ?? false,
          deliveryFee: (toolData.deliveryFee || 0).toString(),
          deliveryRadius: toolData.deliveryRadius || 0,
        })
        .returning();
      return tool;
    } catch (error) {
      this.handleError(error, "createTool");
    }
  }

  async getToolById(id: string, userId?: string): Promise<ToolDetails> {
    try {
      const tool = (await this.db.query.tools.findFirst({
        where: eq(tools.id, id),
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
            orderBy: [asc(toolAvailability.startDate)],
          },
        },
      })) as ToolWithRelations | undefined;

      // Get images separately since they're not in the main query
      const images = await this.db
        .select({
          id: toolImages.id,
          imageUrl: toolImages.imageUrl,
          orderIndex: toolImages.orderIndex,
        })
        .from(toolImages)
        .where(eq(toolImages.toolId, id))
        .orderBy(toolImages.orderIndex);

      if (!tool) {
        throw new NotFoundError("Tool", id);
      }

      // Get owner reviews separately to calculate rating
      const ownerReviews: Array<{ rating: number }> =
        await this.db.query.reviews.findMany({
          where: eq(reviews.revieweeId, tool.ownerId),
          columns: {
            rating: true,
          },
        });

      // Calculate average rating for tool
      const toolRatings = tool.reviews.map((r: ReviewDb) => r.rating);
      const averageRating =
        toolRatings.length > 0
          ? toolRatings.reduce((a: number, b: number) => a + b, 0) /
            toolRatings.length
          : 0;

      // Calculate owner rating
      const ownerRatings = ownerReviews.map((r) => r.rating);
      const ownerAverageRating =
        ownerRatings.length > 0
          ? ownerRatings.reduce((a: number, b: number) => a + b, 0) /
            ownerRatings.length
          : 0;

      // Check if user has favorited this tool
      let isFavorited = false;
      if (userId) {
        const favorite = await this.db.query.userFavorites.findFirst({
          where: and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.toolId, id),
          ),
        });
        isFavorited = !!favorite;
      }

      // Increment view count (only if not the owner)
      if (userId && userId !== tool.ownerId) {
        await this.db
          .update(tools)
          .set({ viewCount: sql`${tools.viewCount} + 1` })
          .where(eq(tools.id, id));
      }

      return {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        brand: tool.brand || undefined,
        model: tool.model || undefined,
        condition: tool.condition,
        dailyRate: Number(tool.dailyRate),
        weeklyRate: tool.weeklyRate ? Number(tool.weeklyRate) : undefined,
        monthlyRate: tool.monthlyRate ? Number(tool.monthlyRate) : undefined,
        securityDeposit: Number(tool.securityDeposit),
        status: tool.status,
        specifications: tool.specifications,
        instructions: tool.instructions || undefined,
        safetyNotes: tool.safetyNotes || undefined,
        minimumRentalPeriod: tool.minimumRentalPeriod,
        maximumRentalPeriod: tool.maximumRentalPeriod,
        requiresPickup: tool.requiresPickup,
        deliveryAvailable: tool.deliveryAvailable,
        deliveryFee: Number(tool.deliveryFee),
        deliveryRadius: tool.deliveryRadius,
        viewCount: tool.viewCount,
        favoriteCount: tool.favoriteCount,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount: toolRatings.length,
        isFavorited,
        createdAt: tool.createdAt,
        updatedAt: tool.updatedAt,
        owner: {
          id: tool.owner.id,
          firstName: tool.owner.firstName,
          lastName: tool.owner.lastName,
          profileImageUrl: tool.owner.profileImageUrl || undefined,
          averageRating: Math.round(ownerAverageRating * 10) / 10,
          reviewCount: ownerRatings.length,
          memberSince: tool.owner.createdAt,
        },
        category: {
          id: tool.category.id,
          name: tool.category.name,
          icon: tool.category.icon || undefined,
        },
        reviews: tool.reviews.map((review: ReviewDb) => ({
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
        availability: tool.availability.map((avail: AvailabilityDb) => ({
          id: avail.id,
          startDate: avail.startDate,
          endDate: avail.endDate,
          isBlocked: avail.isBlocked,
          reason: avail.reason || undefined,
        })),
      };
    } catch (error) {
      this.handleError(error, "getToolById");
    }
  }

  async updateTool(
    id: string,
    ownerId: string,
    updates: UpdateToolDTO,
  ): Promise<ToolDetails> {
    try {
      // Verify ownership
      const tool = await this.db.query.tools.findFirst({
        where: eq(tools.id, id),
        columns: { ownerId: true },
      });

      if (!tool) {
        throw new NotFoundError("Tool", id);
      }

      if (tool.ownerId !== ownerId) {
        throw new UnauthorizedError("You can only update your own tools");
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

      const [updatedTool] = await this.db
        .update(tools)
        .set(updateData)
        .where(eq(tools.id, id))
        .returning();

      if (!updatedTool) {
        throw new NotFoundError("Tool", id);
      }

      return this.getToolById(id, ownerId);
    } catch (error) {
      this.handleError(error, "updateTool");
    }
  }

  async updateToolStatus(
    id: string,
    status: "available" | "rented" | "maintenance" | "inactive",
  ): Promise<typeof tools.$inferSelect> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Verify ownership
      const tool = await this.db.query.tools.findFirst({
        where: eq(tools.id, id),
        columns: { ownerId: true },
      });

      if (!tool) {
        throw new NotFoundError("Tool", id);
      }

      if (tool.ownerId !== userId) {
        throw new UnauthorizedError("You can only update your own tools");
      }

      const [updatedTool] = await this.db
        .update(tools)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, id))
        .returning();

      if (!updatedTool) {
        throw new NotFoundError("Tool", id);
      }

      return updatedTool;
    } catch (error) {
      this.handleError(error, "updateToolStatus");
    }
  }

  async deleteTool(id: string): Promise<void> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Verify ownership
      const tool = await this.db.query.tools.findFirst({
        where: eq(tools.id, id),
        columns: { ownerId: true },
      });

      if (!tool) {
        throw new NotFoundError("Tool", id);
      }

      if (tool.ownerId !== userId) {
        throw new UnauthorizedError("You can only delete your own tools");
      }

      const result = await this.db
        .delete(tools)
        .where(eq(tools.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError("Tool", id);
      }
    } catch (error) {
      this.handleError(error, "deleteTool");
    }
  }

  async searchTools(
    filters: ToolSearchFilters,
    pagination: PaginationOptions,
    currentUserId?: string,
  ): Promise<PaginatedResult<UserTool>> {
    try {
      this.validatePagination(pagination.page, pagination.limit);

      const offset = (pagination.page - 1) * pagination.limit;

      // Build the where conditions
      const whereConditions = [
        eq(tools.status, "available"),
        eq(tools.isActive, true),
      ];

      // Text search
      if (filters.query) {
        whereConditions.push(
          or(
            ilike(tools.name, `%${filters.query}%`),
            ilike(tools.description, `%${filters.query}%`),
            ilike(tools.brand, `%${filters.query}%`),
            ilike(tools.model, `%${filters.query}%`),
          )!,
        );
      }

      // Category filter
      if (filters.categoryId) {
        whereConditions.push(eq(tools.categoryId, filters.categoryId));
      }

      // Price filters
      if (filters.minPrice !== undefined) {
        whereConditions.push(gte(tools.dailyRate, filters.minPrice.toString()));
      }
      if (filters.maxPrice !== undefined) {
        whereConditions.push(lte(tools.dailyRate, filters.maxPrice.toString()));
      }

      // Condition filter
      if (filters.condition && filters.condition.length > 0) {
        whereConditions.push(inArray(tools.condition, filters.condition));
      }

      // Delivery filter
      if (filters.deliveryAvailable) {
        whereConditions.push(eq(tools.deliveryAvailable, true));
      }

      // Exclude current user's tools
      if (currentUserId) {
        whereConditions.push(sql`${tools.ownerId} != ${currentUserId}`);
      }

      // Get total count
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(tools)
        .innerJoin(toolCategories, eq(tools.categoryId, toolCategories.id))
        .innerJoin(users, eq(tools.ownerId, users.id))
        .where(and(...whereConditions));

      // Build the order by clause
      let orderByClause = [];

      if (filters.sortBy) {
        switch (filters.sortBy) {
          case "price":
            orderByClause = [
              filters.sortOrder === "desc"
                ? desc(tools.dailyRate)
                : asc(tools.dailyRate),
            ];
            break;
          case "newest":
            orderByClause = [desc(tools.createdAt)];
            break;
          case "rating":
            // We'll handle rating sorting in the post-processing since it requires aggregation
            orderByClause = [desc(tools.favoriteCount)];
            break;
          default:
            orderByClause = [desc(tools.createdAt)];
        }
      } else {
        orderByClause = [desc(tools.createdAt)];
      }

      // Get the tools with relations
      const toolsWithRelations = await this.db
        .select({
          tool: tools,
          category: {
            id: toolCategories.id,
            name: toolCategories.name,
            icon: toolCategories.icon,
          },
          owner: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          },
        })
        .from(tools)
        .innerJoin(toolCategories, eq(tools.categoryId, toolCategories.id))
        .innerJoin(users, eq(tools.ownerId, users.id))
        .where(and(...whereConditions))
        .orderBy(...orderByClause)
        .limit(pagination.limit)
        .offset(offset);

      // Get first image for each tool (matching getUserTools pattern)
      const toolIds = toolsWithRelations.map((t) => t.tool.id);
      const toolImagesMap = new Map<string, string>();

      if (toolIds.length > 0) {
        // Get first image for each tool individually to match getUserTools behavior
        for (const toolId of toolIds) {
          const firstImage = await this.db
            .select({ imageUrl: toolImages.imageUrl })
            .from(toolImages)
            .where(
              and(eq(toolImages.toolId, toolId), eq(toolImages.orderIndex, 0)),
            )
            .limit(1);

          if (firstImage[0]?.imageUrl) {
            toolImagesMap.set(toolId, firstImage[0].imageUrl);
          }
        }
      }

      // Get reviews for rating calculation
      const reviewsData = await this.db
        .select({
          toolId: reviews.toolId,
          rating: reviews.rating,
        })
        .from(reviews)
        .where(inArray(reviews.toolId, toolIds));

      // Calculate ratings per tool
      const ratingsMap = new Map<
        string,
        { averageRating: number; reviewCount: number }
      >();

      for (const review of reviewsData) {
        if (!ratingsMap.has(review.toolId)) {
          ratingsMap.set(review.toolId, { averageRating: 0, reviewCount: 0 });
        }
        const current = ratingsMap.get(review.toolId)!;
        current.averageRating =
          (current.averageRating * current.reviewCount + review.rating) /
          (current.reviewCount + 1);
        current.reviewCount++;
      }

      // Transform to UserTool format
      const transformedTools: UserTool[] = toolsWithRelations.map((item) => {
        const toolRating = ratingsMap.get(item.tool.id) || {
          averageRating: 0,
          reviewCount: 0,
        };

        return {
          ...item.tool,
          dailyRate: Number(item.tool.dailyRate),
          weeklyRate: item.tool.weeklyRate
            ? Number(item.tool.weeklyRate)
            : undefined,
          monthlyRate: item.tool.monthlyRate
            ? Number(item.tool.monthlyRate)
            : undefined,
          securityDeposit: Number(item.tool.securityDeposit),
          deliveryFee: Number(item.tool.deliveryFee),
          averageRating: Math.round(toolRating.averageRating * 10) / 10,
          reviewCount: toolRating.reviewCount,
          firstImageUrl: toolImagesMap.get(item.tool.id) || null,
        };
      });

      // Handle rating sorting post-processing
      if (filters.sortBy === "rating") {
        transformedTools.sort((a, b) => {
          const aRating = a.averageRating;
          const bRating = b.averageRating;
          return filters.sortOrder === "desc"
            ? bRating - aRating
            : aRating - bRating;
        });
      }

      return this.createPaginatedResult(
        transformedTools,
        total,
        pagination.page,
        pagination.limit,
      );
    } catch (error) {
      this.handleError(error, "searchTools");
    }
  }

  /**
   * Get tools owned by a user
   * @param userId - The user ID
   * @param status - Optional status filter
   * @returns Array of tools with computed averageRating and reviewCount
   */
  async getUserTools(userId: string, status?: string): Promise<UserTool[]> {
    try {
      const whereConditions = [eq(tools.ownerId, userId)];

      if (status) {
        whereConditions.push(
          eq(
            tools.status,
            status as "available" | "rented" | "maintenance" | "inactive",
          ),
        );
      }

      // Get tools without any relations to avoid circular reference issues
      const userTools = await this.db
        .select()
        .from(tools)
        .where(and(...whereConditions))
        .orderBy(desc(tools.createdAt));

      // Get reviews separately to calculate ratings
      const toolsWithRating = await Promise.all(
        userTools.map(async (tool) => {
          const toolReviews = await this.db.query.reviews.findMany({
            where: eq(reviews.toolId, tool.id),
            columns: {
              rating: true,
            },
          });

          // Get the first image for this tool
          const firstImage = await this.db
            .select({ imageUrl: toolImages.imageUrl })
            .from(toolImages)
            .where(
              and(eq(toolImages.toolId, tool.id), eq(toolImages.orderIndex, 0)),
            )
            .limit(1);

          const ratings = toolReviews.map((r) => r.rating);
          const averageRating =
            ratings.length > 0
              ? ratings.reduce((a: number, b: number) => a + b, 0) /
                ratings.length
              : 0;

          return {
            ...tool,
            dailyRate: Number(tool.dailyRate),
            weeklyRate: tool.weeklyRate ? Number(tool.weeklyRate) : undefined,
            monthlyRate: tool.monthlyRate
              ? Number(tool.monthlyRate)
              : undefined,
            securityDeposit: Number(tool.securityDeposit),
            deliveryFee: Number(tool.deliveryFee),
            averageRating: Math.round(averageRating * 10) / 10,
            reviewCount: ratings.length,
            firstImageUrl: firstImage[0]?.imageUrl || null,
          } as UserTool;
        }),
      );

      return toolsWithRating;
    } catch (error) {
      this.handleError(error, "getUserTools");
    }
  }

  /**
   * Get active tools owned by a user with search, sort, and filter options
   * @param userId - The user ID
   * @param filters - Optional filters for search, sort, and filtering
   * @returns Array of active tools with computed averageRating and reviewCount
   */
  async getUserActiveToolsWithFilters(
    userId: string,
    filters: GarageToolFilters = {},
  ): Promise<UserTool[]> {
    try {
      const baseConditions = [
        eq(tools.ownerId, userId),
        eq(tools.isActive, true),
        or(eq(tools.status, "available"), eq(tools.status, "rented")),
      ];

      return this._getUserToolsWithFilters(baseConditions, filters);
    } catch (error) {
      this.handleError(error, "getUserActiveToolsWithFilters");
    }
  }

  /**
   * Get active tools owned by a user (available or rented status, and isActive = true)
   * @param userId - The user ID
   * @returns Array of active tools with computed averageRating and reviewCount
   */
  async getUserActiveTools(userId: string): Promise<UserTool[]> {
    try {
      const whereConditions = [
        eq(tools.ownerId, userId),
        eq(tools.isActive, true),
        or(eq(tools.status, "available"), eq(tools.status, "rented")),
      ];

      return this._getUserToolsWithConditions(whereConditions);
    } catch (error) {
      this.handleError(error, "getUserActiveTools");
    }
  }

  /**
   * Get inactive tools owned by a user with search, sort, and filter options
   * @param userId - The user ID
   * @param filters - Optional filters for search, sort, and filtering
   * @returns Array of inactive tools with computed averageRating and reviewCount
   */
  async getUserInactiveToolsWithFilters(
    userId: string,
    filters: GarageToolFilters = {},
  ): Promise<UserTool[]> {
    try {
      const baseConditions = [
        eq(tools.ownerId, userId),
        eq(tools.isActive, true),
        or(eq(tools.status, "maintenance"), eq(tools.status, "inactive")),
      ];

      return this._getUserToolsWithFilters(baseConditions, filters);
    } catch (error) {
      this.handleError(error, "getUserInactiveToolsWithFilters");
    }
  }

  /**
   * Get inactive tools owned by a user (maintenance or inactive status, and isActive = true)
   * @param userId - The user ID
   * @returns Array of inactive tools with computed averageRating and reviewCount
   */
  async getUserInactiveTools(userId: string): Promise<UserTool[]> {
    try {
      const whereConditions = [
        eq(tools.ownerId, userId),
        eq(tools.isActive, true),
        or(eq(tools.status, "maintenance"), eq(tools.status, "inactive")),
      ];

      return this._getUserToolsWithConditions(whereConditions);
    } catch (error) {
      this.handleError(error, "getUserInactiveTools");
    }
  }

  /**
   * Get archived tools owned by a user with search, sort, and filter options
   * @param userId - The user ID
   * @param filters - Optional filters for search, sort, and filtering
   * @returns Array of archived tools with computed averageRating and reviewCount
   */
  async getUserArchivedToolsWithFilters(
    userId: string,
    filters: GarageToolFilters = {},
  ): Promise<UserTool[]> {
    try {
      const baseConditions = [
        eq(tools.ownerId, userId),
        eq(tools.isActive, false),
      ];

      return this._getUserToolsWithFilters(baseConditions, filters);
    } catch (error) {
      this.handleError(error, "getUserArchivedToolsWithFilters");
    }
  }

  /**
   * Private helper method to get user tools with specific conditions and filters
   * @param baseConditions - Base where conditions
   * @param filters - Search, sort, and filter options
   * @returns Array of tools with computed averageRating and reviewCount
   */
  private async _getUserToolsWithFilters(
    baseConditions: Parameters<typeof and>,
    filters: GarageToolFilters = {},
  ): Promise<UserTool[]> {
    try {
      const whereConditions = [...baseConditions];

      // Add search filter
      if (filters.query) {
        whereConditions.push(
          or(
            ilike(tools.name, `%${filters.query}%`),
            ilike(tools.description, `%${filters.query}%`),
            ilike(tools.brand, `%${filters.query}%`),
            ilike(tools.model, `%${filters.query}%`),
          )!,
        );
      }

      // Add category filter
      if (filters.categoryId) {
        whereConditions.push(eq(tools.categoryId, filters.categoryId));
      }

      // Add rental status filter (only applicable for active tools)
      if (filters.rentalStatus) {
        if (filters.rentalStatus === "available") {
          whereConditions.push(eq(tools.status, "available"));
        } else if (filters.rentalStatus === "rented") {
          whereConditions.push(eq(tools.status, "rented"));
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
            sortOrder === "asc" ? asc(tools.name) : desc(tools.name),
          ];
          break;
        case "lastRented":
          // For now, sort by updatedAt as a proxy for last rental activity
          // TODO: Add actual lastRentedAt field to schema
          orderByClause = [
            sortOrder === "asc" ? asc(tools.updatedAt) : desc(tools.updatedAt),
          ];
          break;
        case "newest":
        default:
          orderByClause = [
            sortOrder === "asc" ? asc(tools.createdAt) : desc(tools.createdAt),
          ];
          break;
      }

      // Get tools without any relations to avoid circular reference issues
      const userTools = await this.db
        .select()
        .from(tools)
        .where(and(...whereConditions))
        .orderBy(...orderByClause);

      // Get reviews separately to calculate ratings
      const toolsWithRating = await Promise.all(
        userTools.map(async (tool) => {
          const toolReviews = await this.db.query.reviews.findMany({
            where: eq(reviews.toolId, tool.id),
            columns: {
              rating: true,
            },
          });

          // Get the first image for this tool
          const firstImage = await this.db
            .select({ imageUrl: toolImages.imageUrl })
            .from(toolImages)
            .where(
              and(eq(toolImages.toolId, tool.id), eq(toolImages.orderIndex, 0)),
            )
            .limit(1);

          const ratings = toolReviews.map((r) => r.rating);
          const averageRating =
            ratings.length > 0
              ? ratings.reduce((a: number, b: number) => a + b, 0) /
                ratings.length
              : 0;

          return {
            ...tool,
            dailyRate: Number(tool.dailyRate),
            weeklyRate: tool.weeklyRate ? Number(tool.weeklyRate) : undefined,
            monthlyRate: tool.monthlyRate
              ? Number(tool.monthlyRate)
              : undefined,
            securityDeposit: Number(tool.securityDeposit),
            deliveryFee: Number(tool.deliveryFee),
            averageRating: Math.round(averageRating * 10) / 10,
            reviewCount: ratings.length,
            firstImageUrl: firstImage[0]?.imageUrl || null,
          } as UserTool;
        }),
      );

      return toolsWithRating;
    } catch (error) {
      this.handleError(error, "_getUserToolsWithFilters");
    }
  }

  /**
   * Private helper method to get user tools with specific conditions
   * @param whereConditions - Array of where conditions
   * @returns Array of tools with computed averageRating and reviewCount
   */
  private async _getUserToolsWithConditions(
    whereConditions: Parameters<typeof and>,
  ): Promise<UserTool[]> {
    try {
      // Get tools without any relations to avoid circular reference issues
      const userTools = await this.db
        .select()
        .from(tools)
        .where(and(...whereConditions))
        .orderBy(desc(tools.createdAt));

      // Get reviews separately to calculate ratings
      const toolsWithRating = await Promise.all(
        userTools.map(async (tool) => {
          const toolReviews = await this.db.query.reviews.findMany({
            where: eq(reviews.toolId, tool.id),
            columns: {
              rating: true,
            },
          });

          // Get the first image for this tool
          const firstImage = await this.db
            .select({ imageUrl: toolImages.imageUrl })
            .from(toolImages)
            .where(
              and(eq(toolImages.toolId, tool.id), eq(toolImages.orderIndex, 0)),
            )
            .limit(1);

          const ratings = toolReviews.map((r) => r.rating);
          const averageRating =
            ratings.length > 0
              ? ratings.reduce((a: number, b: number) => a + b, 0) /
                ratings.length
              : 0;

          return {
            ...tool,
            dailyRate: Number(tool.dailyRate),
            weeklyRate: tool.weeklyRate ? Number(tool.weeklyRate) : undefined,
            monthlyRate: tool.monthlyRate
              ? Number(tool.monthlyRate)
              : undefined,
            securityDeposit: Number(tool.securityDeposit),
            deliveryFee: Number(tool.deliveryFee),
            averageRating: Math.round(averageRating * 10) / 10,
            reviewCount: ratings.length,
            firstImageUrl: firstImage[0]?.imageUrl || null,
          } as UserTool;
        }),
      );

      return toolsWithRating;
    } catch (error) {
      this.handleError(error, "_getUserToolsWithConditions");
    }
  }

  /**
   * Get archived tools owned by a user (isActive = false)
   * @param userId - The user ID
   * @returns Array of archived tools with computed averageRating and reviewCount
   */
  async getUserArchivedTools(userId: string): Promise<UserTool[]> {
    try {
      const whereConditions = [
        eq(tools.ownerId, userId),
        eq(tools.isActive, false),
      ];

      return this._getUserToolsWithConditions(whereConditions);
    } catch (error) {
      this.handleError(error, "getUserArchivedTools");
    }
  }

  async getToolCategories(): Promise<(typeof toolCategories.$inferSelect)[]> {
    try {
      const categories = await this.db.query.toolCategories.findMany({
        where: and(
          eq(toolCategories.isActive, true),
          isNull(toolCategories.parentId),
        ),
        orderBy: [asc(toolCategories.sortOrder), asc(toolCategories.name)],
      });

      return categories;
    } catch (error) {
      this.handleError(error, "getToolCategories");
    }
  }

  // async toggleToolFavorite(userId: string, toolId: string): Promise<boolean> {
  //   try {
  //     const existing = await this.db.query.userFavorites.findFirst({
  //       where: and(
  //         eq(userFavorites.userId, userId),
  //         eq(userFavorites.toolId, toolId),
  //       ),
  //     });

  //     if (existing) {
  //       // Remove favorite
  //       await this.db
  //         .delete(userFavorites)
  //         .where(eq(userFavorites.id, existing.id));

  //       // Decrement favorite count
  //       await this.db
  //         .update(tools)
  //         .set({ favoriteCount: sql`${tools.favoriteCount} - 1` })
  //         .where(eq(tools.id, toolId));

  //       return false;
  //     } else {
  //       // Add favorite
  //       await this.db.insert(userFavorites).values({ userId, toolId });

  //       // Increment favorite count
  //       await this.db
  //         .update(tools)
  //         .set({ favoriteCount: sql`${tools.favoriteCount} + 1` })
  //         .where(eq(tools.id, toolId));

  //       return true;
  //     }
  //   } catch (error) {
  //     this.handleError(error, "toggleToolFavorite");
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
  //         tool: {
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
  //       const ratings = favorite.tool.reviews.map((r: any) => r.rating);
  //       const averageRating =
  //         ratings.length > 0
  //           ? ratings.reduce((a: number, b: number) => a + b, 0) /
  //             ratings.length
  //           : 0;

  //       return {
  //         ...favorite,
  //         tool: {
  //           ...favorite.tool,
  //           dailyRate: Number(favorite.tool.dailyRate),
  //           weeklyRate: favorite.tool.weeklyRate
  //             ? Number(favorite.tool.weeklyRate)
  //             : undefined,
  //           monthlyRate: favorite.tool.monthlyRate
  //             ? Number(favorite.tool.monthlyRate)
  //             : undefined,
  //           securityDeposit: Number(favorite.tool.securityDeposit),
  //           deliveryFee: Number(favorite.tool.deliveryFee),
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
