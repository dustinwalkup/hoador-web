"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { emailSignupServerSchema } from "../schemas/validation";
import { auth } from "@/services/better-auth";
import { userDAL, communityDAL } from "@/dal";
import { ConflictError, ValidationError } from "@/dal/errors";

type CreateAccountResult = {
  success: boolean;
  error?: string;
  data?: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
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
    firstName: (formData.get("firstName") as string) || "",
    lastName: (formData.get("lastName") as string) || "",
    email: (formData.get("email") as string) || "",
    password: (formData.get("password") as string) || "",
    phone: (formData.get("phone") as string) || "",
    address: {
      street: (formData.get("street") as string) || "",
      city: (formData.get("city") as string) || "",
      state: (formData.get("state") as string) || "",
      zipCode: (formData.get("zipCode") as string) || "",
    },
    agreeToTerms:
      formData.get("agreeToTerms") === "on" ||
      formData.get("agreeToTerms") === "true",
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
        email: validatedData.email,
        password: validatedData.password,
        name: `${validatedData.firstName} ${validatedData.lastName}`,
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
  const { data: userProfile, error: userError } = await tryCatch(
    userDAL.updateUserProfileForSignup(
      betterAuthResult.user.id,
      {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        address: validatedData.address,
      },
      communityId,
    ),
  );

  if (userError) {
    console.error("User profile creation error:", userError);

    // Handle specific DAL errors
    if (userError instanceof ConflictError) {
      return {
        success: false,
        error: "An account with this email already exists.",
      };
    }

    if (userError instanceof ValidationError) {
      return {
        success: false,
        error: userError.message,
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
        id: userProfile.user.id,
        email: userProfile.user.email!,
        firstName: userProfile.user.firstName!,
        lastName: userProfile.user.lastName!,
      },
    },
  };
}
