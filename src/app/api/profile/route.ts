import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { userDAL } from "@/dal";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";

const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(4).max(10),
  }),
});

/**
 * PATCH /api/profile
 * Update user profile and address
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    // Get current user ID
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 },
      );
    }

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

    // Update user profile and address in parallel
    const [userResult, addressResult] = await Promise.all([
      tryCatch(userDAL.updateUser(userId, userFields)),
      tryCatch(userDAL.updateUserPrimaryAddress(userId, address)),
    ]);

    // Check for errors
    if (userResult.error) {
      return handleApiError(userResult.error);
    }

    if (addressResult.error) {
      return handleApiError(addressResult.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
