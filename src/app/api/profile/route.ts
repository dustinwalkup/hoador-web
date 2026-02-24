import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { userDAL } from "@/dal";
import { trackActivity } from "@/features/activity/lib/track-activity";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
  profileImageUrl: z.string().url().optional(),
  address: z
    .object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      zipCode: z.string().min(4).max(10),
    })
    .optional(),
});

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
    const validationResult = UpdateUserProfileSchema.safeParse(body);

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
