import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { communityDAL, userDAL } from "@/dal";
import { ValidationError, UnauthorizedError } from "@/dal/errors";
import { joinCodeSchema } from "@/features/auth/schemas/auth-schemas";
import { requireAuth } from "@/features/auth/utils/session";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
} from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) {
      return authError;
    }

    const body = await parseFormData(request);
    const joinCode = body.joinCode as string;

    // Validate join code format first
    try {
      joinCodeSchema.parse({ joinCode });
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid join code format." },
        { status: 400 },
      );
    }

    // Get current user profile
    const { data: userProfile, error: userError } =
      await tryCatch(requireAuth());

    if (userError) {
      console.error("Error fetching user profile:", userError);
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required. Please log in again.",
        },
        { status: 401 },
      );
    }

    // Check if user is already in a community
    const { data: existingMembership } = await tryCatch(
      communityDAL.getCurrentUserMembership(),
    );

    if (existingMembership) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You are already a member of a community. Please leave your current community first.",
        },
        { status: 409 },
      );
    }

    // Validate join code and get community
    const { data: community, error: validateError } = await tryCatch(
      communityDAL.validateJoinCodeForSignup(joinCode.trim()),
    );

    if (validateError) {
      console.error("Join code validation error:", validateError);
      return NextResponse.json(
        {
          success: false,
          error: "Unable to validate join code. Please try again.",
        },
        { status: 500 },
      );
    }

    if (!community) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid join code. Please check with your community administrator.",
        },
        { status: 404 },
      );
    }

    // Join the community using the more efficient method for new users
    const { data: communityInfo, error: joinError } = await tryCatch(
      communityDAL.joinCommunityForNewUser(userProfile.id, community.id),
    );

    if (joinError) {
      console.error("Join community error:", joinError);

      // Handle specific validation errors
      if (joinError instanceof ValidationError) {
        return NextResponse.json(
          { success: false, error: joinError.message },
          { status: 400 },
        );
      }

      if (joinError instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: "Authentication required. Please log in again.",
          },
          { status: 401 },
        );
      }

      // Generic error for database or other issues
      return NextResponse.json(
        {
          success: false,
          error: "Unable to join community. Please try again.",
        },
        { status: 500 },
      );
    }

    if (!communityInfo) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to join community. Please try again.",
        },
        { status: 500 },
      );
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

    // Success! Return redirect URL
    return NextResponse.json({
      success: true,
      redirect: "/onboarding",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
