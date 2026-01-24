import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { z } from "zod";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
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
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId: currentUserId } = authResult;

    const { listingId } = await params;

    // Validate listingId
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 },
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

    // Verify ownership before updating
    const existingListing = await listingDAL.getListingById(listingId);
    if (!existingListing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (existingListing.owner.id !== currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own listings" },
        { status: 403 },
      );
    }

    // Update the listing status
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
