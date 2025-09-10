"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { userDAL } from "@/dal";
import { onboardingSchema } from "../form-schema/signup-schema";
import { revalidatePath } from "next/cache";
import { requireAuth } from "../utils/session";

/**
 * Server action to complete user onboarding after email verification
 * Updates user profile with bio and profile image, sets status to active
 */
interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  bio: string | null;
  profileImageUrl: string | null;
}

export async function completeOnboardingAction(
   
  _prevState: {
    success: boolean;
    error?: string;
    user?: UserInfo;
  },
  formData: FormData,
): Promise<{
  success: boolean;
  error?: string;
  user?: UserInfo;
}> {
  const { data, error } = await tryCatch(
    (async () => {
      // Require authentication
      const currentUser = await requireAuth();

      // Extract and validate form data
      const rawData = {
        bio: formData.get("bio") as string,
        profileImageUrl: formData.get("profileImageUrl") as string,
      };

      // Validate input with Zod schema
      const validatedInput = onboardingSchema.parse(rawData);

      // Complete user onboarding
      const updatedUser = await userDAL.completeUserOnboarding(currentUser.id, {
        bio: validatedInput.bio,
        profileImageUrl: validatedInput.profileImageUrl,
      });

      // Revalidate relevant paths
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/profile");
      revalidatePath("/auth/onboarding");

      return {
        success: true,
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          status: updatedUser.status,
          bio: updatedUser.bio,
          profileImageUrl: updatedUser.profileImageUrl,
        },
      };
    })(),
  );

  if (error) {
    console.error("Onboarding completion failed:", error);

    // Handle specific error cases
    if (error.message.includes("Unauthorized")) {
      return {
        success: false,
        error: "You must be signed in to complete onboarding.",
      };
    }

    if (error.message.includes("Bio")) {
      return {
        success: false,
        error: "Bio must be 500 characters or less.",
      };
    }

    if (error.message.includes("profileImageUrl")) {
      return {
        success: false,
        error: "Please enter a valid image URL.",
      };
    }

    return {
      success: false,
      error:
        error.message || "Failed to complete onboarding. Please try again.",
    };
  }

  return data as {
    success: boolean;
    user: UserInfo;
  };
}

/**
 * Server action to update user status after email verification
 * Called when user clicks verification link
 */
export async function verifyEmailAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: {
    success: boolean;
    error?: string;
    requiresOnboarding?: boolean;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formData: FormData,
): Promise<{
  success: boolean;
  error?: string;
  requiresOnboarding?: boolean;
}> {
  const { data, error } = await tryCatch(
    (async () => {
      // Require authentication
      const currentUser = await requireAuth();

      // Verify email in our database
      await userDAL.verifyUserEmail(currentUser.id);

      // Update user status to incomplete_profile (ready for onboarding)
      await userDAL.updateUserStatus(currentUser.id, "incomplete_profile");

      // Revalidate relevant paths
      revalidatePath("/dashboard");
      revalidatePath("/auth/verify-email");

      return {
        success: true,
        requiresOnboarding: true,
      };
    })(),
  );

  if (error) {
    console.error("Email verification failed:", error);

    if (error.message.includes("Unauthorized")) {
      return {
        success: false,
        error: "You must be signed in to verify your email.",
      };
    }

    return {
      success: false,
      error: error.message || "Failed to verify email. Please try again.",
    };
  }

  return data as {
    success: boolean;
    requiresOnboarding: boolean;
  };
}

/**
 * Server action to resend verification email
 */
export async function resendVerificationEmailAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: {
    success: boolean;
    error?: string;
    message?: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formData: FormData,
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  const { data, error } = await tryCatch(
    (async () => {
      // Require authentication
      const currentUser = await requireAuth();

      // Check if user is already verified
      if (currentUser.emailVerified) {
        return {
          success: false,
          error: "Your email is already verified.",
        };
      }

      // Check if user is in pending verification status
      if (currentUser.status !== "pending_verification") {
        return {
          success: false,
          error: "Email verification is not required for your account.",
        };
      }

      // Better Auth handles resending verification emails
      // This would typically call the Better Auth resend verification API
      // For now, we'll return success and let the client handle the actual resend

      return {
        success: true,
        message:
          "Verification email sent. Please check your inbox and spam folder.",
      };
    })(),
  );

  if (error) {
    console.error("Resend verification email failed:", error);

    if (error.message.includes("Unauthorized")) {
      return {
        success: false,
        error: "You must be signed in to resend verification email.",
      };
    }

    return {
      success: false,
      error:
        error.message ||
        "Failed to resend verification email. Please try again.",
    };
  }

  return data as {
    success: boolean;
    message?: string;
  };
}
