"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { userDAL, communityDAL } from "@/dal";
import {
  completeGoogleSignupSchema,
  type CompleteGoogleSignupInput,
} from "../form-schema/signup-schema";
import { revalidatePath } from "next/cache";

/**
 * Server action for Google OAuth signup completion
 * Handles additional data collection after Google authentication
 */
export async function signupGoogleAction(
  prevState: {
    success: boolean;
    error?: string;
    userId?: string;
    requiresOnboarding?: boolean;
    communityJoined?: boolean;
  },
  formData: FormData,
): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
  requiresOnboarding?: boolean;
  communityJoined?: boolean;
}> {
  const { data, error } = await tryCatch(
    (async () => {
      // Extract and validate form data
      const rawData = {
        phone: formData.get("phone") as string,
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        zipCode: formData.get("zipCode") as string,
        unit: formData.get("unit") as string,
        joinCode: formData.get("joinCode") as string,
        // Google OAuth data (passed from client)
        googleEmail: formData.get("googleEmail") as string,
        googleFirstName: formData.get("googleFirstName") as string,
        googleLastName: formData.get("googleLastName") as string,
        googleProfileImageUrl: formData.get("googleProfileImageUrl") as string,
      };

      // Validate input with Zod schema
      const validatedInput = completeGoogleSignupSchema.parse({
        phone: rawData.phone,
        address: {
          street: rawData.street,
          city: rawData.city,
          state: rawData.state,
          zipCode: rawData.zipCode,
          unit: rawData.unit,
        },
      });

      // Validate community join code
      const community = await communityDAL.validateJoinCodeForSignup(
        rawData.joinCode,
      );

      if (!community) {
        throw new Error("Invalid join code. Please check and try again.");
      }

      // Check if user already exists with this email
      const existingUser = await userDAL.getUserByEmailForAuth(
        rawData.googleEmail,
      );

      if (existingUser) {
        // User exists - this shouldn't happen in normal flow, but handle gracefully
        throw new Error(
          "An account with this email already exists. Please try signing in instead.",
        );
      }

      // For Google OAuth, the user should already be created via the OAuth callback
      // This action is for collecting additional data after OAuth authentication
      // The user ID should be passed from the client after successful OAuth
      const userId = formData.get("userId") as string;

      if (!userId) {
        throw new Error(
          "User ID is required. Please complete Google authentication first.",
        );
      }

      // Create user profile with address in our database
      await userDAL.createUserWithAddress(
        {
          id: userId,
          name: `${rawData.googleFirstName} ${rawData.googleLastName}`,
          email: rawData.googleEmail,
          firstName: rawData.googleFirstName,
          lastName: rawData.googleLastName,
          phone: validatedInput.phone,
          profileImageUrl: rawData.googleProfileImageUrl,
          address: {
            street: validatedInput.address.street,
            city: validatedInput.address.city,
            state: validatedInput.address.state,
            zipCode: validatedInput.address.zipCode,
            unit: validatedInput.address.unit,
          },
        },
        community.id,
      );

      // Join community
      const communityResult = await communityDAL.joinCommunityForNewUser(
        userId,
        community.id,
      );

      // Revalidate relevant paths
      revalidatePath("/dashboard");
      revalidatePath("/auth/signup");

      return {
        success: true,
        userId: userId,
        requiresOnboarding: true, // Google signups skip email verification but need onboarding
        communityJoined: !!communityResult,
      };
    })(),
  );

  if (error) {
    console.error("Google signup failed:", error);

    // Handle specific error cases
    if (
      error.message.includes("already exists") ||
      error.message.includes("duplicate")
    ) {
      return {
        success: false,
        error:
          "An account with this email already exists. Please try signing in instead.",
      };
    }

    if (error.message.includes("Invalid join code")) {
      return {
        success: false,
        error: "Invalid join code. Please check and try again.",
      };
    }

    if (error.message.includes("Phone")) {
      return {
        success: false,
        error: "Please enter a valid phone number.",
      };
    }

    return {
      success: false,
      error: error.message || "Failed to create account. Please try again.",
    };
  }

  return data as {
    success: boolean;
    userId: string;
    requiresOnboarding: boolean;
    communityJoined: boolean;
  };
}

/**
 * Alternative Google signup action that handles the OAuth callback flow
 * This would be called after successful Google OAuth authentication
 */
export async function completeGoogleSignupAfterOAuth(
  googleUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  },
  additionalData: CompleteGoogleSignupInput,
  communityId: string,
): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
  requiresOnboarding?: boolean;
  communityJoined?: boolean;
}> {
  const { data, error } = await tryCatch(
    (async () => {
      // Create user profile with address in our database
      await userDAL.createUserWithAddress(
        {
          id: googleUser.id,
          name: `${googleUser.firstName} ${googleUser.lastName}`,
          email: googleUser.email,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          phone: additionalData.phone,
          profileImageUrl: googleUser.profileImageUrl,
          address: additionalData.address,
        },
        communityId,
      );

      // Join community
      const communityResult = await communityDAL.joinCommunityForNewUser(
        googleUser.id,
        communityId,
      );

      // Revalidate relevant paths
      revalidatePath("/dashboard");
      revalidatePath("/auth/signup");

      return {
        success: true,
        userId: googleUser.id,
        requiresOnboarding: true, // Google signups skip email verification but need onboarding
        communityJoined: !!communityResult,
      };
    })(),
  );

  if (error) {
    console.error("Google OAuth signup completion failed:", error);

    return {
      success: false,
      error:
        error.message || "Failed to complete account setup. Please try again.",
    };
  }

  return data as {
    success: boolean;
    userId: string;
    requiresOnboarding: boolean;
    communityJoined: boolean;
  };
}
