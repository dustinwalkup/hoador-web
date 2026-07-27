import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { userDAL, communityDAL } from "@/dal";
import { trackActivity } from "@/features/activity/lib/track-activity";
import { updateProfileApiSchema } from "@/features/users/lib/profile.schema";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

/**
 * GET /api/profile
 * Returns the current user's full profile (including primary address) so
 * client-side TanStack Query consumers can hydrate from server data and
 * stay in sync after PATCH mutations invalidate the ["profile"] key.
 */
async function getHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const user = await userDAL.getUserById(userId);
    // D-E4-4: surface the primary community's residency verification so the mobile
    // "Verification pending" badge (Req 4.3.4) has a source. Additive + null-safe —
    // web clients ignore it; no DAL/schema change.
    const primaryMembership =
      await communityDAL.getPrimaryMembershipForUser(userId);
    return NextResponse.json(
      user
        ? {
            ...user,
            verificationStatus:
              primaryMembership?.membership.verificationStatus ?? null,
          }
        : user,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/profile");

/**
 * PATCH /api/profile
 * Update user profile and address
 */
async function patchHandler(request: NextRequest) {
  try {
    // Authenticate - ALWAYS use getAuthenticatedUserResponse()
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Parse request body
    const body = await parseFormData(request);

    // Validate form data
    const validationResult = updateProfileApiSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { address, ...userFields } = validationResult.data;

    // Update user profile
    const userResult = await tryCatch(userDAL.updateUser(userId, userFields));

    if (userResult.error) {
      return handleApiError(userResult.error);
    }

    // Update address if provided
    if (address) {
      const addressResult = await tryCatch(
        userDAL.updateUserPrimaryAddress(userId, address),
      );

      if (addressResult.error) {
        return handleApiError(addressResult.error);
      }
    }

    trackActivity(userId, "profile_updated");

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(patchHandler, "PATCH /api/profile");
