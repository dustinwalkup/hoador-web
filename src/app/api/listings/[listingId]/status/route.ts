import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { z } from "zod";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

const updateListingStatusSchema = z.object({
  status: z.enum(["available", "maintenance", "inactive"]),
});

/**
 * PATCH /api/listings/[listingId]/status
 * Update listing status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { listingId } = await params;

    // Validate listingId
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 },
      );
    }

    // Get current user ID
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await parseFormData(request);

    // Validate form data
    const validationResult = updateListingStatusSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { status } = validationResult.data;

    // Update the listing status (DAL handles ownership validation)
    const { data: listing, error } = await tryCatch(
      listingDAL.updateListingStatus(listingId, status),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!listing) {
      return NextResponse.json(
        { error: "Failed to update listing status" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      listing,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
