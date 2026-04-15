import { eq, count, sql, and, or, ilike, desc, lt, lte } from "drizzle-orm";

import { geocodeAddress } from "@/services/geocoding";
import { schema } from "@/db/schemas";
import { BaseDAL } from "./base";
import {
  type CreateUserDTO,
  type CreateUserWithAddressDTO,
  type AddressData,
  type UpdateUserDTO,
  type PaginationOptions,
  type PaginatedResult,
  type GetUsersForAdminOptions,
  type AdminUpdateUserDTO,
  type AdminUserListItem,
  type AdminUserDetail,
  UserProfile,
} from "./types";
import { ConflictError, NotFoundError } from "./errors";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";

const {
  user,
  userPreferences,
  userAddresses,
  reviews,
  rentals,
  listings,
  communityMemberships,
} = schema;

type UpdateUserPreferencesDTO = Partial<
  Omit<
    typeof userPreferences.$inferInsert,
    "id" | "userId" | "createdAt" | "updatedAt"
  >
>;

export class UserDAL extends BaseDAL {
  /**
   * Format phone number as (555) 123-4567
   */
  static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, "");

    // Check if it's a valid US phone number (10 digits)
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }

    // If 11 digits and starts with 1, remove the 1
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const withoutCountryCode = cleaned.slice(1);
      return `(${withoutCountryCode.slice(0, 3)}) ${withoutCountryCode.slice(3, 6)}-${withoutCountryCode.slice(6)}`;
    }

    // Return original if not a valid format
    return phone;
  }

  /**
   * Validate and format address data
   */
  private validateAndFormatAddress(addressData: AddressData): AddressData {
    const { street, city, state, zipCode, unit } = addressData;

    // Basic validation
    if (!street?.trim()) throw new Error("Street address is required");
    if (!city?.trim()) throw new Error("City is required");
    if (!state?.trim()) throw new Error("State is required");
    if (!zipCode?.trim()) throw new Error("ZIP code is required");

    // Format ZIP code (remove spaces, ensure 5 or 9 digit format)
    const cleanedZip = zipCode.replace(/\D/g, "");
    let formattedZip = cleanedZip;
    if (cleanedZip.length === 9) {
      formattedZip = `${cleanedZip.slice(0, 5)}-${cleanedZip.slice(5)}`;
    } else if (cleanedZip.length !== 5) {
      throw new Error("ZIP code must be 5 or 9 digits");
    }

    return {
      street: street.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zipCode: formattedZip,
      unit: unit?.trim() || undefined,
    };
  }
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
        userType: userData.userType,
        phone: userData.phone ?? null,
        bio: userData.bio ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        stripeCustomerId: userData.stripeCustomerId ?? null,
        stripeConnectedAccountId: userData.stripeConnectedAccountId ?? null,
        connectOnboardingComplete: userData.connectOnboardingComplete,
        connectChargesEnabled: userData.connectChargesEnabled,
        connectPayoutsEnabled: userData.connectPayoutsEnabled,
        idVerified: userData.idVerified,
        addressVerified: userData.addressVerified,
        tosVersion: userData.tosVersion ?? null,
        tosAcceptedAt: userData.tosAcceptedAt ?? null,
        privacyVersion: userData.privacyVersion ?? null,
        privacyAcceptedAt: userData.privacyAcceptedAt ?? null,
        communityVersion: userData.communityVersion ?? null,
        communityAcceptedAt: userData.communityAcceptedAt ?? null,
        createdAt: userData.createdAt,
        stats,
        preferences: userData.preferences,
        primaryAddress: userData.addresses?.[0] ?? undefined,
      };
    } catch (error) {
      this.handleError(error, "getUserById");
    }
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
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
        userType: userData.userType,
        tosVersion: userData.tosVersion ?? null,
        tosAcceptedAt: userData.tosAcceptedAt ?? null,
        privacyVersion: userData.privacyVersion ?? null,
        privacyAcceptedAt: userData.privacyAcceptedAt ?? null,
        communityVersion: userData.communityVersion ?? null,
        communityAcceptedAt: userData.communityAcceptedAt ?? null,
        status: userData.status,
        phone: userData.phone ?? null,
        bio: userData.bio ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        stripeCustomerId: userData.stripeCustomerId ?? null,
        stripeConnectedAccountId: userData.stripeConnectedAccountId ?? null,
        connectOnboardingComplete: userData.connectOnboardingComplete,
        connectChargesEnabled: userData.connectChargesEnabled,
        connectPayoutsEnabled: userData.connectPayoutsEnabled,
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
      // Sanitize text fields if provided
      const sanitizedUpdates: UpdateUserDTO = { ...updates };
      if (updates.firstName !== undefined) {
        sanitizedUpdates.firstName = sanitizeTextWithMaxLength(
          updates.firstName,
          100,
        );
      }
      if (updates.lastName !== undefined) {
        sanitizedUpdates.lastName = sanitizeTextWithMaxLength(
          updates.lastName,
          100,
        );
      }
      if (updates.bio !== undefined && updates.bio !== null) {
        sanitizedUpdates.bio = sanitizeTextWithMaxLength(updates.bio, 500);
      }

      const [updatedUser] = await this.db
        .update(user)
        .set({ ...sanitizedUpdates, updatedAt: new Date() })
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
  async updateCurrentUser(
    userId: string,
    updates: UpdateUserDTO,
  ): Promise<UserProfile> {
    try {
      return this.updateUser(userId, updates);
    } catch (error) {
      this.handleError(error, "updateCurrentUser");
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
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

  /**
   * Get paginated users for admin list. Default sort: most recently signed up first.
   */
  async getUsersForAdmin(
    options: GetUsersForAdminOptions,
  ): Promise<PaginatedResult<AdminUserListItem>> {
    try {
      const { search, status, userType, page, limit, inactiveDays, sortBy } =
        options;
      this.validatePagination(page, limit);
      const offset = (page - 1) * limit;

      const conditions = [];
      if (search?.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(or(ilike(user.name, term), ilike(user.email, term)));
      }
      if (status) {
        conditions.push(eq(user.status, status));
      }
      if (userType) {
        conditions.push(eq(user.userType, userType));
      }
      if (inactiveDays != null && inactiveDays > 0) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - inactiveDays);
        // Inactive: last activity before threshold (or never)
        conditions.push(
          or(
            lt(user.lastActiveAt, threshold),
            sql`${user.lastActiveAt} IS NULL`,
          ),
        );
        // Account must be at least that old (can't be "inactive 30+ days" if account is 5 days old)
        conditions.push(lte(user.createdAt, threshold));
      }
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const countQuery = this.db
        .select({ total: count() })
        .from(user)
        .where(whereClause);
      const [{ total }] = await countQuery;

      const orderBy =
        sortBy === "lastActiveAt"
          ? [sql`${user.lastActiveAt} DESC NULLS LAST`]
          : [desc(user.createdAt)];

      const rows = await this.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          userType: user.userType,
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt,
          communityNamesLabel: sql<string | null>`(
            SELECT string_agg("communities"."name"::text, ', ' ORDER BY "community_memberships"."created_at" ASC)
            FROM "community_memberships"
            INNER JOIN "communities" ON "communities"."id" = "community_memberships"."community_id"
            WHERE "community_memberships"."user_id" = "user"."id"
          )`.as("communityNamesLabel"),
        })
        .from(user)
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);

      return this.createPaginatedResult(
        rows as AdminUserListItem[],
        Number(total),
        page,
        limit,
      );
    } catch (error) {
      this.handleError(error, "getUsersForAdmin");
    }
  }

  /**
   * Get total user count for admin metrics (platform-wide).
   */
  async getTotalUserCount(): Promise<number> {
    try {
      const result = await this.db.select({ total: count() }).from(user);
      return Number(result[0]?.total ?? 0);
    } catch (error) {
      this.handleError(error, "getTotalUserCount");
    }
  }

  /**
   * Users with no community membership (distinct accounts).
   */
  async countUsersWithNoCommunityMembership(): Promise<number> {
    try {
      const [row] = await this.db
        .select({ count: count() })
        .from(user)
        .where(
          sql`NOT EXISTS (
            SELECT 1 FROM ${communityMemberships}
            WHERE ${communityMemberships.userId} = ${user.id}
          )`,
        );
      return Number(row?.count ?? 0);
    } catch (error) {
      this.handleError(error, "countUsersWithNoCommunityMembership");
    }
  }

  /**
   * Active admin and superadmin accounts for staff-facing notifications (e.g. service listing review).
   */
  async getStaffNotificationRecipients(): Promise<
    Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    }>
  > {
    try {
      return await this.db
        .select({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(user)
        .where(
          and(
            eq(user.status, "active"),
            or(eq(user.userType, "admin"), eq(user.userType, "superadmin")),
          ),
        );
    } catch (error) {
      this.handleError(error, "getStaffNotificationRecipients");
    }
  }

  /**
   * Returns the user's Stripe customer ID, or null if none exists.
   */
  async getStripeCustomerId(userId: string): Promise<string | null> {
    try {
      const [u] = await this.db
        .select({ stripeCustomerId: user.stripeCustomerId })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return u?.stripeCustomerId ?? null;
    } catch (error) {
      this.handleError(error, "getStripeCustomerId");
    }
  }

  /**
   * Get user profile with extra counts for admin detail view.
   */
  async getUserDetailsForAdmin(userId: string): Promise<AdminUserDetail> {
    try {
      const profile = await this.getUserById(userId);

      const [listingsCountResult, rentalsRenterResult, rentalsOwnerResult] =
        await Promise.all([
          this.db
            .select({ count: count() })
            .from(listings)
            .where(eq(listings.ownerId, userId)),
          this.db
            .select({ count: count() })
            .from(rentals)
            .where(eq(rentals.renterId, userId)),
          this.db
            .select({ count: count() })
            .from(rentals)
            .where(eq(rentals.ownerId, userId)),
        ]);

      return {
        ...profile,
        listingsCount: Number(listingsCountResult[0]?.count ?? 0),
        rentalsAsRenterCount: Number(rentalsRenterResult[0]?.count ?? 0),
        rentalsAsOwnerCount: Number(rentalsOwnerResult[0]?.count ?? 0),
      };
    } catch (error) {
      this.handleError(error, "getUserDetailsForAdmin");
    }
  }

  /**
   * Admin-only update: status and/or userType. Caller must enforce admin auth.
   */
  async adminUpdateUser(
    userId: string,
    updates: AdminUpdateUserDTO,
  ): Promise<UserProfile> {
    try {
      if (updates.status !== undefined) {
        await this.updateUserStatus(userId, updates.status);
      }
      if (updates.userType !== undefined) {
        await this.db
          .update(user)
          .set({ userType: updates.userType, updatedAt: new Date() })
          .where(eq(user.id, userId));
      }
      return this.getUserById(userId);
    } catch (error) {
      this.handleError(error, "adminUpdateUser");
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

  async updateUserPreferences(
    userId: string,
    preferences: UpdateUserPreferencesDTO,
  ): Promise<void> {
    try {
      await this.db
        .insert(userPreferences)
        .values({ userId, ...preferences })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: { ...preferences, updatedAt: new Date() },
        });
    } catch (error) {
      this.handleError(error, "updateUserPreferences");
    }
  }

  // Convenience method for current user
  async updateCurrentUserPreferences(
    userId: string,
    preferences: UpdateUserPreferencesDTO,
  ): Promise<void> {
    try {
      return this.updateUserPreferences(userId, preferences);
    } catch (error) {
      this.handleError(error, "updateCurrentUserPreferences");
    }
  }

  /**
   * Get master notification preferences (email/push) for a user.
   * Defaults to true for both when no preferences row exists.
   */
  async getUserPreferences(userId: string): Promise<{
    emailNotifications: boolean;
    pushNotifications: boolean;
  }> {
    try {
      const row = await this.db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
        columns: { emailNotifications: true, pushNotifications: true },
      });
      return {
        emailNotifications: row?.emailNotifications ?? true,
        pushNotifications: row?.pushNotifications ?? true,
      };
    } catch (error) {
      this.handleError(error, "getUserPreferences");
    }
  }

  /**
   * Get user's timezone from preferences (e.g. for reminder scheduling).
   * Returns IANA timezone string; default "America/Chicago" if not set.
   */
  async getTimezone(userId: string): Promise<string> {
    try {
      const row = await this.db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
        columns: { timezone: true },
      });
      return row?.timezone ?? "America/Chicago";
    } catch (error) {
      this.handleError(error, "getTimezone");
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
      await this.db
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "verifyUserEmail");
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
      const geo = await geocodeAddress(input);

      if (!geo) {
        throw new Error("Failed to geocode address");
      }

      const { latitude, longitude } = geo;

      const existing = await this.db.query.userAddresses.findFirst({
        where: (addr, { eq, and }) =>
          and(eq(addr.userId, userId), eq(addr.isPrimary, true)),
      });

      if (existing) {
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
  async updateCurrentUserPrimaryAddress(
    userId: string,
    input: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    },
  ): Promise<void> {
    try {
      return this.updateUserPrimaryAddress(userId, input);
    } catch (error) {
      this.handleError(error, "updateCurrentUserPrimaryAddress");
    }
  }

  /**
   * Create user with address and community joining (atomic transaction)
   * This is the main method for signup flow
   */
  async createUserWithAddress(
    userData: CreateUserWithAddressDTO,
    communityId: string,
  ): Promise<{ user: UserProfile; communityJoined: boolean }> {
    console.log("communityId", communityId);
    try {
      // Validate and format phone number
      const formattedPhone = UserDAL.formatPhoneNumber(userData.phone);

      // Validate and format address
      const validatedAddress = this.validateAndFormatAddress(userData.address);

      // Check if user already exists
      const existingUser = await this.db.query.user.findFirst({
        where: eq(user.email, userData.email),
      });

      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      // Start transaction for atomic user creation + address + community joining
      const result = await this.db.transaction(async (tx) => {
        // Create user
        const [newUser] = await tx
          .insert(user)
          .values({
            id: userData.id, // Better Auth provides the ID
            name: userData.name,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: formattedPhone,
            profileImageUrl: userData.profileImageUrl,
            status: "pending_verification", // Default status for email signups
            emailVerified: false,
          })
          .returning();

        // Create default preferences
        await tx.insert(userPreferences).values({
          userId: newUser.id,
        });

        // Create primary address with geocoding
        let latitude: string | undefined;
        let longitude: string | undefined;

        try {
          const geo = await geocodeAddress({
            street: validatedAddress.street,
            city: validatedAddress.city,
            state: validatedAddress.state,
            zipCode: validatedAddress.zipCode,
          });

          if (geo) {
            latitude = geo.latitude.toString();
            longitude = geo.longitude.toString();
          }
        } catch (geoError) {
          // Log geocoding error but don't fail the transaction
          console.warn("Geocoding failed during user creation:", geoError);
        }

        await tx.insert(userAddresses).values({
          userId: newUser.id,
          street: validatedAddress.street,
          city: validatedAddress.city,
          state: validatedAddress.state,
          zipCode: validatedAddress.zipCode,
          ...(validatedAddress.unit && { unit: validatedAddress.unit }),
          latitude,
          longitude,
          isPrimary: true,
        });

        return newUser;
      });

      // Get the complete user profile
      const userProfile = await this.getUserById(result.id);

      // Community joining will be handled separately to avoid circular dependencies
      // Return success flag for community joining
      return {
        user: userProfile,
        communityJoined: false, // Will be updated by community joining logic
      };
    } catch (error) {
      this.handleError(error, "createUserWithAddress");
    }
  }

  /**
   * Update user address (for existing users)
   */
  async updateUserAddress(
    userId: string,
    addressData: AddressData,
  ): Promise<void> {
    try {
      const validatedAddress = this.validateAndFormatAddress(addressData);

      // Get geocoding for the new address
      let latitude: string | undefined;
      let longitude: string | undefined;

      try {
        const geo = await geocodeAddress({
          street: validatedAddress.street,
          city: validatedAddress.city,
          state: validatedAddress.state,
          zipCode: validatedAddress.zipCode,
        });

        if (geo) {
          latitude = geo.latitude.toString();
          longitude = geo.longitude.toString();
        }
      } catch (geoError) {
        console.warn("Geocoding failed during address update:", geoError);
      }

      // Find existing primary address
      const existing = await this.db.query.userAddresses.findFirst({
        where: (addr, { eq, and }) =>
          and(eq(addr.userId, userId), eq(addr.isPrimary, true)),
      });

      if (existing) {
        // Update existing primary address
        await this.db
          .update(userAddresses)
          .set({
            street: validatedAddress.street,
            city: validatedAddress.city,
            state: validatedAddress.state,
            zipCode: validatedAddress.zipCode,
            ...(validatedAddress.unit && { unit: validatedAddress.unit }),
            latitude,
            longitude,
            updatedAt: new Date(),
          })
          .where(eq(userAddresses.id, existing.id));
      } else {
        // Create new primary address
        await this.db.insert(userAddresses).values({
          userId,
          street: validatedAddress.street,
          city: validatedAddress.city,
          state: validatedAddress.state,
          zipCode: validatedAddress.zipCode,
          ...(validatedAddress.unit && { unit: validatedAddress.unit }),
          latitude,
          longitude,
          isPrimary: true,
        });
      }
    } catch (error) {
      this.handleError(error, "updateUserAddress");
    }
  }

  /**
   * Get user with address (for auth flows)
   */
  async getUserWithAddress(userId: string): Promise<UserProfile> {
    try {
      // This method can be called without auth for signup flows
      return this.getUserById(userId);
    } catch (error) {
      this.handleError(error, "getUserWithAddress");
    }
  }

  /**
   * Get user by email for auth purposes (no auth required)
   */
  async getUserByEmailForAuth(email: string): Promise<UserProfile | null> {
    try {
      const userData = await this.db.query.user.findFirst({
        where: eq(user.email, email),
        with: {
          preferences: true,
          addresses: true,
        },
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
        userType: userData.userType,
        phone: userData.phone ?? null,
        bio: userData.bio ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        stripeCustomerId: userData.stripeCustomerId ?? null,
        stripeConnectedAccountId: userData.stripeConnectedAccountId ?? null,
        connectOnboardingComplete: userData.connectOnboardingComplete,
        connectChargesEnabled: userData.connectChargesEnabled,
        connectPayoutsEnabled: userData.connectPayoutsEnabled,
        idVerified: userData.idVerified,
        addressVerified: userData.addressVerified,
        tosVersion: userData.tosVersion ?? null,
        tosAcceptedAt: userData.tosAcceptedAt ?? null,
        privacyVersion: userData.privacyVersion ?? null,
        privacyAcceptedAt: userData.privacyAcceptedAt ?? null,
        communityVersion: userData.communityVersion ?? null,
        communityAcceptedAt: userData.communityAcceptedAt ?? null,
        createdAt: userData.createdAt,
        stats,
        preferences: userData.preferences,
        primaryAddress: userData.addresses?.find((addr) => addr.isPrimary),
      };
    } catch (error) {
      this.handleError(error, "getUserByEmailForAuth");
    }
  }

  /**
   * Slim user lookup for the auth hot path. PK lookup, no joins, no stats.
   *
   * Every authenticated request in the app resolves through getCurrentUser,
   * so this function must stay cheap. Callers that actually need preferences,
   * addresses, or stats must fetch them explicitly from their own DAL methods.
   *
   * Returns a UserProfile-compatible shape with zeroed stats and null relations
   * so existing consumers of getCurrentUser keep type-compat without changes.
   */
  async getUserForAuth(id: string): Promise<UserProfile | null> {
    try {
      const userData = await this.db.query.user.findFirst({
        where: eq(user.id, id),
      });

      if (!userData) {
        return null;
      }

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.emailVerified,
        image: userData.image,
        firstName: userData.firstName,
        lastName: userData.lastName,
        status: userData.status,
        userType: userData.userType,
        phone: userData.phone ?? null,
        bio: userData.bio ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        stripeCustomerId: userData.stripeCustomerId ?? null,
        stripeConnectedAccountId: userData.stripeConnectedAccountId ?? null,
        connectOnboardingComplete: userData.connectOnboardingComplete,
        connectChargesEnabled: userData.connectChargesEnabled,
        connectPayoutsEnabled: userData.connectPayoutsEnabled,
        idVerified: userData.idVerified,
        addressVerified: userData.addressVerified,
        tosVersion: userData.tosVersion ?? null,
        tosAcceptedAt: userData.tosAcceptedAt ?? null,
        privacyVersion: userData.privacyVersion ?? null,
        privacyAcceptedAt: userData.privacyAcceptedAt ?? null,
        communityVersion: userData.communityVersion ?? null,
        communityAcceptedAt: userData.communityAcceptedAt ?? null,
        createdAt: userData.createdAt,
        stats: {
          listingsBorrowed: 0,
          listingsShared: 0,
          averageRating: 0,
          totalReviews: 0,
        },
        preferences: null,
        primaryAddress: undefined,
      };
    } catch (error) {
      this.handleError(error, "getUserForAuth");
    }
  }

  /**
   * Update user status (for auth flows)
   */
  async updateUserStatus(
    userId: string,
    status:
      | "pending_verification"
      | "email_verified"
      | "incomplete_profile"
      | "active"
      | "inactive"
      | "suspended",
  ): Promise<void> {
    try {
      await this.db
        .update(user)
        .set({ status, updatedAt: new Date() })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "updateUserStatus");
    }
  }

  /**
   * Update legal document acceptances on user record
   * Requires authentication - use updateLegalAcceptancesForSignup during signup flow
   */
  async updateLegalAcceptances(
    userId: string,
    acceptances: {
      tosVersion?: string;
      tosAcceptedAt?: Date;
      privacyVersion?: string;
      privacyAcceptedAt?: Date;
      communityVersion?: string;
      communityAcceptedAt?: Date;
    },
  ): Promise<void> {
    try {
      await this.db
        .update(user)
        .set({
          ...acceptances,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "updateLegalAcceptances");
    }
  }

  /**
   * Update legal document acceptances on user record during signup
   * Does not require authentication - used during signup flow before session exists
   */
  async updateLegalAcceptancesForSignup(
    userId: string,
    acceptances: {
      tosVersion?: string;
      tosAcceptedAt?: Date;
      privacyVersion?: string;
      privacyAcceptedAt?: Date;
      communityVersion?: string;
      communityAcceptedAt?: Date;
    },
  ): Promise<void> {
    try {
      await this.db
        .update(user)
        .set({
          ...acceptances,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "updateLegalAcceptancesForSignup");
    }
  }

  /**
   * Update users profile photo
   */
  async updateUserProfilePhoto(
    userId: string,
    profileImageUrl: string,
  ): Promise<void> {
    try {
      await this.db
        .update(user)
        .set({ profileImageUrl, updatedAt: new Date() })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "updateUserProfilePhoto");
    }
  }

  /**
   * Complete user onboarding (update status to active)
   */
  async completeUserOnboarding(
    userId: string,
    onboardingData: { bio?: string; profileImageUrl?: string },
  ): Promise<UserProfile> {
    try {
      // Update user with onboarding data and set status to active
      await this.db
        .update(user)
        .set({
          ...onboardingData,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));

      return this.getUserById(userId);
    } catch (error) {
      this.handleError(error, "completeUserOnboarding");
    }
  }

  /**
   * Get or create Stripe customer ID for a user
   * Returns the existing customer ID if present, or creates a new Stripe customer
   */
  async getOrCreateStripeCustomerId(userId: string): Promise<string> {
    try {
      // Get user data
      const userData = await this.db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (!userData) {
        throw new NotFoundError("User", userId);
      }

      // Return existing customer ID if present
      if (userData.stripeCustomerId) {
        return userData.stripeCustomerId;
      }

      // Create new Stripe customer
      const { PAYMENT_SERVER_INSTANCE } =
        await import("@/services/stripe/server");

      const customer = await PAYMENT_SERVER_INSTANCE.customers.create({
        email: userData.email,
        name: userData.name,
        metadata: {
          userId: userData.id,
        },
      });

      // Update user with new Stripe customer ID
      await this.db
        .update(user)
        .set({
          stripeCustomerId: customer.id,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));

      return customer.id;
    } catch (error) {
      this.handleError(error, "getOrCreateStripeCustomerId");
    }
  }

  /**
   * Get or create Stripe Connect account for a user
   * Returns the existing connected account ID if present, or creates a new Express account
   */
  async getOrCreateConnectedAccount(userId: string): Promise<string> {
    try {
      // Get user data
      const userData = await this.db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (!userData) {
        throw new NotFoundError("User", userId);
      }

      // Return existing connected account ID if present
      if (userData.stripeConnectedAccountId) {
        return userData.stripeConnectedAccountId;
      }

      // Create new Stripe Connect Express account
      const { createConnectedAccount } =
        await import("@/services/stripe/connect");

      const account = await createConnectedAccount(userId, userData.email);

      // Update user with new connected account ID
      await this.db
        .update(user)
        .set({
          stripeConnectedAccountId: account.id,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));

      return account.id;
    } catch (error) {
      this.handleError(error, "getOrCreateConnectedAccount");
    }
  }

  /**
   * Update Stripe Connect onboarding status
   */
  async updateConnectOnboardingStatus(
    userId: string,
    status: { chargesEnabled: boolean; payoutsEnabled: boolean },
  ): Promise<void> {
    try {
      const isComplete = status.chargesEnabled && status.payoutsEnabled;

      await this.db
        .update(user)
        .set({
          connectChargesEnabled: status.chargesEnabled,
          connectPayoutsEnabled: status.payoutsEnabled,
          connectOnboardingComplete: isComplete,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "updateConnectOnboardingStatus");
    }
  }

  /**
   * Check if user has completed Stripe Connect onboarding
   * Returns true if charges_enabled && payouts_enabled
   */
  async isConnectOnboardingComplete(userId: string): Promise<boolean> {
    try {
      const userData = await this.db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: {
          connectChargesEnabled: true,
          connectPayoutsEnabled: true,
          connectOnboardingComplete: true,
        },
      });

      if (!userData) {
        throw new NotFoundError("User", userId);
      }

      return (
        userData.connectChargesEnabled &&
        userData.connectPayoutsEnabled &&
        userData.connectOnboardingComplete
      );
    } catch (error) {
      this.handleError(error, "isConnectOnboardingComplete");
    }
  }

  /**
   * Get connected account ID for a user
   */
  async getConnectedAccountId(userId: string): Promise<string | null> {
    try {
      const userData = await this.db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: {
          stripeConnectedAccountId: true,
        },
      });

      if (!userData) {
        throw new NotFoundError("User", userId);
      }

      return userData.stripeConnectedAccountId || null;
    } catch (error) {
      this.handleError(error, "getConnectedAccountId");
    }
  }

  /**
   * Get user by connected account ID (for webhooks)
   */
  async getUserByConnectedAccountId(
    accountId: string,
  ): Promise<UserProfile | null> {
    try {
      const userData = await this.db.query.user.findFirst({
        where: eq(user.stripeConnectedAccountId, accountId),
      });

      if (!userData) {
        return null;
      }

      return this.getUserById(userData.id);
    } catch (error) {
      this.handleError(error, "getUserByConnectedAccountId");
    }
  }
}
