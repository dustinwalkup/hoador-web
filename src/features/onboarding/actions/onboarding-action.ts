"use server";

import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";
import { getCurrentUser } from "@/features/auth/utils/session";
import { userDAL } from "@/dal";
import { onboardingSchema } from "../schemas/validation";

type OnboardingResult = {
  success: boolean;
  error?: string;
  warning?: string;
  data?: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  };
};

export async function onboardingAction(
  prevState: OnboardingResult | null,
  formData: FormData,
): Promise<OnboardingResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: "User not found. Please log in and try again.",
    };
  }

  // Extract and structure form data
  const userData = {
    firstName: (formData.get("firstName") as string) || "",
    lastName: (formData.get("lastName") as string) || "",
    phone: (formData.get("phone") as string) || "",
    bio: (formData.get("bio") as string) || "",
    profileImageUrl: (formData.get("profileImageUrl") as string) || "",
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
  let validatedData;
  try {
    validatedData = onboardingSchema.parse(userData);
  } catch (error) {
    console.error("Validation error:", error);
    return {
      success: false,
      error: "Please check your information and try again.",
    };
  }

  // Separate address from user profile data
  const { address, ...profileData } = validatedData;

  // Step 1: Update user profile (critical - must succeed)
  const { data: updatedUser, error: userError } = await tryCatch(
    userDAL.updateUser(user.id, { ...profileData, status: "active" as const }),
  );

  if (userError) {
    console.error("User profile update error:", userError);

    if (userError.message?.includes("Unauthorized")) {
      return {
        success: false,
        error: "You don't have permission to update this profile.",
      };
    }

    if (userError.message?.includes("not found")) {
      return { success: false, error: "User account not found." };
    }

    return {
      success: false,
      error: "Failed to update your profile. Please try again.",
    };
  }

  if (!updatedUser) {
    return {
      success: false,
      error: "Failed to update user profile. Please try again.",
    };
  }

  if (
    address &&
    address.street &&
    address.city &&
    address.state &&
    address.zipCode
  ) {
    const { error: addressError } = await tryCatch(
      userDAL.updateUserPrimaryAddress(user.id, address),
    );

    if (addressError) {
      console.warn("Address update failed during onboarding:", addressError);
    }
  }

  // Success! Redirect to dashboard
  redirect("/dashboard");
}
