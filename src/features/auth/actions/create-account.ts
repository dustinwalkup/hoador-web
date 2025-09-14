"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { communityDAL } from "@/dal";
import { ValidationError } from "@/dal/errors";
import { emailSignupServerSchema } from "../schemas/validation";

type CreateAccountResult = {
  success: boolean;
  error?: string;
  data?: {
    user: {
      id: string;
      email: string;
    };
  };
};

export async function createAccountAction(
  prevState: CreateAccountResult | null,
  formData: FormData,
): Promise<CreateAccountResult> {
  // Extract and structure form data
  const userData = {
    joinCode: (formData.get("joinCode") as string) || "",
    communityId: (formData.get("communityId") as string) || "",
    email: (formData.get("email") as string) || "",
    password: (formData.get("password") as string) || "",
  };

  // Server-side validation
  try {
    emailSignupServerSchema.parse(userData);
  } catch {
    return {
      success: false,
      error: "Please check your information and try again.",
    };
  }

  const validatedData = emailSignupServerSchema.parse(userData);

  // Use communityId if available, otherwise validate joinCode
  let communityId = userData.communityId;

  if (!communityId && validatedData.joinCode) {
    // Fallback: validate join code to get community
    const { data: community, error: communityError } = await tryCatch(
      communityDAL.validateJoinCodeForSignup(validatedData.joinCode),
    );

    if (communityError) {
      console.error("Community validation error:", communityError);
      return {
        success: false,
        error: "Unable to validate community. Please try again.",
      };
    }

    if (!community) {
      return {
        success: false,
        error: "Community no longer available.",
      };
    }

    communityId = community.id;
  }

  if (!communityId) {
    return {
      success: false,
      error: "Community information is missing. Please start over.",
    };
  }

  // Create user account using Better Auth
  const { data: betterAuthResult, error: authError } = await tryCatch(
    auth.api.signUpEmail({
      body: {
        name: "User",
        email: validatedData.email,
        password: validatedData.password,
      },
    }),
  );

  if (authError) {
    console.error("Better Auth error:", authError);

    // Handle specific Better Auth errors
    if (
      authError.message?.includes("email") ||
      authError.message?.includes("already exists")
    ) {
      return {
        success: false,
        error: "An account with this email already exists.",
      };
    }

    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }

  if (!betterAuthResult) {
    return {
      success: false,
      error: "Failed to create user account.",
    };
  }

  // Update user profile with additional data using UserDAL
  const { error: communityError } = await tryCatch(
    communityDAL.joinCommunityForNewUser(betterAuthResult.user.id, communityId),
  );

  if (communityError) {
    console.error("Join community error:", communityError);

    if (communityError instanceof ValidationError) {
      return {
        success: false,
        error: communityError.message,
      };
    }

    return {
      success: false,
      error: "Failed to create user profile. Please try again.",
    };
  }

  return {
    success: true,
    data: {
      user: {
        id: betterAuthResult.user.id,
        email: betterAuthResult.user.email!,
      },
    },
  };
}
