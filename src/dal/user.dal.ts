import { eq, count, sql } from "drizzle-orm";

import { geocodeAddress } from "@/services/geocoding";
import { schema } from "@/db/schemas";
import { requireAuth } from "@/features/auth/auth.utils";
import { BaseDAL } from "./base";
import {
  type CreateUserDTO,
  type UpdateUserDTO,
  type PaginationOptions,
  type PaginatedResult,
  UserProfile,
} from "./types";
import { ConflictError, NotFoundError } from "./errors";

const { user, userPreferences, userAddresses, reviews, rentals } = schema;

export class UserDAL extends BaseDAL {
  async createUser(userData: CreateUserDTO): Promise<UserProfile> {
    try {
      // Check if user already exists
      const existingUser = await this.db.query.user.findFirst({
        where: eq(user.email, userData.email),
      });

      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      // Create user (BetterAuth handles password, we just create profile data)
      const [newUser] = await this.db
        .insert(user)
        .values({
          id: userData.id, // BetterAuth provides the ID
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          emailVerified: false,
        })
        .returning();

      // Create default preferences
      await this.db.insert(userPreferences).values({
        userId: newUser.id,
      });

      return this.getUserById(newUser.id);
    } catch (error) {
      this.handleError(error, "createUser");
    }
  }

  async getUserById(id: string): Promise<UserProfile> {
    try {
      const userData = await this.db.query.user.findFirst({
        where: eq(user.id, id),
        with: {
          preferences: true,
          addresses: true, // fetch all addresses, no filter
        },
      });

      if (!userData) {
        throw new NotFoundError("User", id);
      }

      // Get user stats
      const stats = await this.getUserStats(id);

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.emailVerified,
        image: userData.image,
        firstName: userData.firstName,
        lastName: userData.lastName,
        status: userData.status,
        phone: userData.phone ?? null,
        bio: userData.bio ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        stripeCustomerId: userData.stripeCustomerId ?? null,
        idVerified: userData.idVerified,
        addressVerified: userData.addressVerified,
        createdAt: userData.createdAt,
        stats,
        preferences: userData.preferences,
        primaryAddress: userData.addresses?.[0] ?? undefined,
      };
    } catch (error) {
      this.handleError(error, "getUserById");
    }
  }

  async getCurrentUserProfile(): Promise<UserProfile> {
    try {
      const auth = await requireAuth();

      if (!auth.id) {
        throw new Error("Unauthorized: Cannot get current user profile");
      }
      return this.getUserById(auth.id);
    } catch (error) {
      this.handleError(error, "getCurrentUserProfile");
    }
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      await requireAuth();

      const userData = await this.db.query.user.findFirst({
        where: eq(user.email, email),
        // with: {
        //   preferences: true,
        // },
      });

      if (!userData) {
        return null;
      }

      const stats = await this.getUserStats(userData.id);

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.emailVerified,
        image: userData.image,
        firstName: userData.firstName,
        lastName: userData.lastName,
        status: userData.status,
        phone: userData.phone ?? null,
        bio: userData.bio ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        stripeCustomerId: userData.stripeCustomerId ?? null,
        idVerified: userData.idVerified,
        addressVerified: userData.addressVerified,
        createdAt: userData.createdAt,
        stats,
        preferences: null, // userData.preferences,
        primaryAddress: undefined, // userData.addresses?.[0] ?? undefined,
      };
    } catch (error) {
      this.handleError(error, "getUserByEmail");
    }
  }

  async updateUser(id: string, updates: UpdateUserDTO): Promise<UserProfile> {
    try {
      const auth = await requireAuth();

      if (auth.id !== id) {
        throw new Error("Unauthorized: Cannot update other user's profile");
      }

      const [updatedUser] = await this.db
        .update(user)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(user.id, id))
        .returning();

      if (!updatedUser) {
        throw new NotFoundError("User", id);
      }

      return this.getUserById(id);
    } catch (error) {
      this.handleError(error, "updateUser");
    }
  }

  // Method to update current user (convenience method)
  async updateCurrentUser(updates: UpdateUserDTO): Promise<UserProfile> {
    try {
      const auth = await requireAuth();

      if (!auth.id) {
        throw new Error("Unauthorized: Cannot update current user");
      }

      return this.updateUser(auth.id, updates);
    } catch (error) {
      this.handleError(error, "updateCurrentUser");
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const auth = await requireAuth();

      // Users can only delete their own account
      if (auth.id !== id) {
        throw new Error("Unauthorized: Cannot delete other user's account");
      }

      const result = await this.db
        .delete(user)
        .where(eq(user.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError("User", id);
      }
    } catch (error) {
      this.handleError(error, "deleteUser");
    }
  }

  async getUserStats(userId: string) {
    try {
      // Remove requireAuth to break circular dependency
      // Authentication should be handled at the service/controller level

      const [statsResult] = await this.db
        .select({
          listingsBorrowed: count(
            sql`CASE WHEN ${rentals.renterId} = ${userId} THEN 1 END`,
          ),
          listingsShared: count(
            sql`CASE WHEN ${rentals.ownerId} = ${userId} THEN 1 END`,
          ),
          averageRating: sql<number>`COALESCE(AVG(CASE WHEN ${reviews.revieweeId} = ${userId} THEN ${reviews.rating} END), 0)`,
          totalReviews: count(
            sql`CASE WHEN ${reviews.revieweeId} = ${userId} THEN 1 END`,
          ),
        })
        .from(rentals)
        .leftJoin(reviews, eq(reviews.rentalId, rentals.id))
        .where(
          sql`${rentals.renterId} = ${userId} OR ${rentals.ownerId} = ${userId}`,
        );

      return {
        listingsBorrowed: Number(statsResult.listingsBorrowed) || 0,
        listingsShared: Number(statsResult.listingsShared) || 0,
        averageRating:
          Math.round((Number(statsResult.averageRating) || 0) * 10) / 10,
        totalReviews: Number(statsResult.totalReviews) || 0,
      };
    } catch (error) {
      this.handleError(error, "getUserStats");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateUserPreferences(userId: string, preferences: any): Promise<void> {
    try {
      const auth = await requireAuth();

      // Users can only update their own preferences
      if (auth.id !== userId) {
        throw new Error("Unauthorized: Cannot update other user's preferences");
      }

      await this.db
        .update(userPreferences)
        .set({ ...preferences, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId));
    } catch (error) {
      this.handleError(error, "updateUserPreferences");
    }
  }

  // Convenience method for current user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateCurrentUserPreferences(preferences: any): Promise<void> {
    try {
      const auth = await requireAuth();

      if (!auth.id) {
        throw new Error("Unauthorized: Cannot update preferences");
      }

      return this.updateUserPreferences(auth.id, preferences);
    } catch (error) {
      this.handleError(error, "updateCurrentUserPreferences");
    }
  }

  async getUserReviews(
    userId: string,
    options: PaginationOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<PaginatedResult<any>> {
    try {
      // Remove requireAuth to break circular dependency
      // Authentication should be handled at the service/controller level

      this.validatePagination(options.page, options.limit);

      const offset = (options.page - 1) * options.limit;

      // Get total count
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(reviews)
        .where(eq(reviews.revieweeId, userId));

      // Get reviews
      const userReviews = await this.db.query.reviews.findMany({
        where: eq(reviews.revieweeId, userId),
        with: {
          reviewer: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
            },
          },
          listing: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
        limit: options.limit,
        offset,
        orderBy: (reviews, { desc }) => [desc(reviews.createdAt)],
      });

      return this.createPaginatedResult(
        userReviews,
        total,
        options.page,
        options.limit,
      );
    } catch (error) {
      this.handleError(error, "getUserReviews");
    }
  }

  async verifyUserEmail(userId: string): Promise<void> {
    try {
      const auth = await requireAuth();

      // Users can only verify their own email
      if (auth.id !== userId) {
        throw new Error("Unauthorized: Cannot verify other user's email");
      }

      await this.db
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "verifyUserEmail");
    }
  }

  async updateUserStatus(userId: string, status: string): Promise<void> {
    try {
      const auth = await requireAuth();

      // Users can only update their own status
      if (auth.id !== userId) {
        throw new Error("Unauthorized: Cannot update other user's status");
      }

      await this.db
        .update(user)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ status: status as any, updatedAt: new Date() })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "updateUserStatus");
    }
  }

  async updateUserPrimaryAddress(
    userId: string,
    input: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    },
  ): Promise<void> {
    try {
      const auth = await requireAuth();

      // Users can only update their own address
      if (auth.id !== userId) {
        throw new Error("Unauthorized: Cannot update other user's address");
      }

      const geo = await geocodeAddress(input);

      if (!geo) {
        throw new Error("Failed to geocode address");
      }

      const { latitude, longitude } = geo;

      console.log("userId", userId);

      const existing = await this.db.query.userAddresses.findFirst({
        where: (addr, { eq, and }) =>
          and(eq(addr.userId, userId), eq(addr.isPrimary, true)),
      });

      console.log("input", input);

      if (existing) {
        console.log("existing", existing);

        await this.db
          .update(userAddresses)
          .set({
            ...input,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            updatedAt: new Date(),
          })
          .where(eq(userAddresses.id, existing.id))
          .execute();
        console.log("updated");
      } else {
        await this.db.insert(userAddresses).values({
          userId,
          ...input,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          isPrimary: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      this.handleError(error, "updateUserPrimaryAddress");
    }
  }

  // Convenience method for current user
  async updateCurrentUserPrimaryAddress(input: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  }): Promise<void> {
    try {
      const auth = await requireAuth();
      if (!auth.id) {
        throw new Error("Unauthorized: Cannot update current user's address");
      }
      return this.updateUserPrimaryAddress(auth.id, input);
    } catch (error) {
      this.handleError(error, "updateCurrentUserPrimaryAddress");
    }
  }
}
