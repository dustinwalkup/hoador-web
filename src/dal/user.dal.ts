import { eq, count, sql } from "drizzle-orm";

import { geocodeAddress } from "@/services/geocoding";
import { schema } from "@/db/schemas";
import { requireAuth } from "@/features/auth/utils/session";
import { BaseDAL } from "./base";
import {
  type CreateUserDTO,
  type CreateUserWithAddressDTO,
  type AddressData,
  type UpdateUserDTO,
  type PaginationOptions,
  type PaginatedResult,
  UserProfile,
} from "./types";
import { ConflictError, NotFoundError } from "./errors";

const { user, userPreferences, userAddresses, reviews, rentals } = schema;

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
      const auth = await requireAuth();

      // Users can only update their own address
      if (auth.id !== userId) {
        throw new Error("Unauthorized: Cannot update other user's address");
      }

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
        preferences: userData.preferences,
        primaryAddress: userData.addresses?.find((addr) => addr.isPrimary),
      };
    } catch (error) {
      this.handleError(error, "getUserByEmailForAuth");
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
      const auth = await requireAuth();

      if (auth.id !== userId) {
        throw new Error("Unauthorized: Cannot update other user's status");
      }

      await this.db
        .update(user)
        .set({ status, updatedAt: new Date() })
        .where(eq(user.id, userId));
    } catch (error) {
      this.handleError(error, "updateUserStatus");
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
      const auth = await requireAuth();
      if (auth.id !== userId) {
        throw new Error(
          "Unauthorized: Cannot update other user's profile photo",
        );
      }

      await this.db
        .update(user)
        .set({ profileImageUrl, updatedAt: new Date() })
        .where(eq(user.id, auth.id));
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
      const auth = await requireAuth();

      // Users can only complete their own onboarding
      if (auth.id !== userId) {
        throw new Error(
          "Unauthorized: Cannot complete other user's onboarding",
        );
      }

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
      const { PAYMENT_SERVER_INSTANCE } = await import(
        "@/services/stripe/server"
      );

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
      const {
        createConnectedAccount,
      } = await import("@/services/stripe/connect");

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
      const isComplete =
        status.chargesEnabled && status.payoutsEnabled;

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
