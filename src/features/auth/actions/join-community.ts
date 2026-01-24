"use server";

import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";
import { communityDAL, userDAL } from "@/dal";
import { ValidationError } from "@/dal/errors";
import { UnauthorizedError } from "@/lib/api/route-helpers";
import { joinCodeSchema } from "../schemas/auth-schemas";
import { requireAuth } from "../utils/session";

type JoinCommunityResult = {
  success: boolean;
  error?: string;
  data?: {
    community: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      fullName: string;
      initials: string;
      email: string;
    };
  };
};

export async function joinCommunityAction(
  prevState: JoinCommunityResult | null,
  formData: FormData,
): Promise<JoinCommunityResult> {
  const joinCode = formData.get("joinCode") as string;

  // Validate join code format first
  try {
    joinCodeSchema.parse({ joinCode });
  } catch {
    return {
      success: false,
      error: "Invalid join code format.",
    };
  }

  // Get current user profile first
  const { data: userProfile, error: userError } = await tryCatch(requireAuth());

  if (userError || !userProfile) {
    console.error("Error fetching user profile:", userError);
    return {
      success: false,
      error: "Authentication required. Please log in again.",
    };
  }

  // Check if user is already in a community
  const { data: existingMembership } = await tryCatch(
    communityDAL.getMembershipForUser(userProfile.id),
  );

  if (existingMembership) {
    return {
      success: false,
      error:
        "You are already a member of a community. Please leave your current community first.",
    };
  }

  // Validate join code and get community
  const { data: community, error: validateError } = await tryCatch(
    communityDAL.validateJoinCodeForSignup(joinCode.trim()),
  );

  if (validateError) {
    console.error("Join code validation error:", validateError);
    return {
      success: false,
      error: "Unable to validate join code. Please try again.",
    };
  }

  if (!community) {
    return {
      success: false,
      error:
        "Invalid join code. Please check with your community administrator.",
    };
  }

  // Join the community using the more efficient method for new users
  const { data: communityInfo, error: joinError } = await tryCatch(
    communityDAL.joinCommunityForNewUser(userProfile.id, community.id),
  );

  if (joinError) {
    console.error("Join community error:", joinError);

    // Handle specific validation errors
    if (joinError instanceof ValidationError) {
      return {
        success: false,
        error: joinError.message,
      };
    }

    if (joinError instanceof UnauthorizedError) {
      return {
        success: false,
        error: "Authentication required. Please log in again.",
      };
    }

    // Generic error for database or other issues
    return {
      success: false,
      error: "Unable to join community. Please try again.",
    };
  }

  if (!communityInfo) {
    return {
      success: false,
      error: "Failed to join community. Please try again.",
    };
  }

  // Update user status to incomplete_profile after joining community
  const { error: statusError } = await tryCatch(
    userDAL.updateUserStatus(userProfile.id, "incomplete_profile"),
  );

  if (statusError) {
    console.error("Error updating user status:", statusError);
    // Don't fail the entire operation, just log the error
    // The user successfully joined the community
  }

  // Success! Redirect to onboarding
  redirect("/onboarding");
}
