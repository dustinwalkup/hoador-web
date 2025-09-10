"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { userDAL, communityDAL } from "@/dal";
import { completeEmailSignupSchema } from "../form-schema/signup-schema";
import { revalidatePath } from "next/cache";

/**
 * Server action for email/password signup with community joining
 * Creates user account, joins community, and sends verification email
 */
export async function signupEmailAction(
  prevState: {
    success: boolean;
    error?: string;
    userId?: string;
    requiresVerification?: boolean;
    communityJoined?: boolean;
  },
  formData: FormData,
): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
  requiresVerification?: boolean;
  communityJoined?: boolean;
}> {
  const { data, error } = await tryCatch(
    (async () => {
      // Extract and validate form data
      const rawData = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        confirmPassword: formData.get("confirmPassword") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        phone: formData.get("phone") as string,
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        zipCode: formData.get("zipCode") as string,
        unit: formData.get("unit") as string,
        joinCode: formData.get("joinCode") as string,
      };

      // Validate input with Zod schema
      const validatedInput = completeEmailSignupSchema.parse(rawData);

      // Validate community join code
      const community = await communityDAL.validateJoinCodeForSignup(
        rawData.joinCode,
      );

      if (!community) {
        throw new Error("Invalid join code. Please check and try again.");
      }

      // Create user account with Better Auth
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: validatedInput.email,
          password: validatedInput.password,
          name: `${validatedInput.firstName} ${validatedInput.lastName}`,
          firstName: validatedInput.firstName,
          lastName: validatedInput.lastName,
          phone: validatedInput.phone,
        },
      });

      if (!signUpResult?.user) {
        throw new Error("Failed to create user account. Please try again.");
      }

      // Create user profile with address in our database
      await userDAL.createUserWithAddress(
        {
          id: signUpResult.user.id,
          name: `${validatedInput.firstName} ${validatedInput.lastName}`,
          email: validatedInput.email,
          firstName: validatedInput.firstName,
          lastName: validatedInput.lastName,
          phone: validatedInput.phone,
          address: {
            street: validatedInput.street,
            city: validatedInput.city,
            state: validatedInput.state,
            zipCode: validatedInput.zipCode,
            unit: validatedInput.unit,
          },
        },
        community.id,
      );

      // Join community
      const communityResult = await communityDAL.joinCommunityForNewUser(
        signUpResult.user.id,
        community.id,
      );

      // Revalidate relevant paths
      revalidatePath("/dashboard");
      revalidatePath("/auth/signup");

      return {
        success: true,
        userId: signUpResult.user.id,
        requiresVerification: true, // Email signups require verification
        communityJoined: !!communityResult,
      };
    })(),
  );

  if (error) {
    console.error("Email signup failed:", error);

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

    if (error.message.includes("Password")) {
      return {
        success: false,
        error: "Password does not meet requirements. Please try again.",
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
    requiresVerification: boolean;
    communityJoined: boolean;
  };
}
