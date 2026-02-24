import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL } from "@/dal";
import {
  handleApiError,
  captureNonCriticalError,
  parseFormData,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { sendInstructionsUpdatedNotification } from "@/features/rentals/notifications/instructions-updated";

const updateInstructionsSchema = z.object({
  pickupInstructions: z.string().optional(),
  returnInstructions: z.string().optional(),
});

/**
 * PATCH /api/rentals/[id]/instructions
 * Update rental instructions
 */
async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { id: rentalId } = await params;

    // Parse request body
    const body = await parseFormData(request);

    // Validate input data
    const parseResult = updateInstructionsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid data provided" },
        { status: 400 },
      );
    }

    const validatedData = parseResult.data;

    // Get current user ID for authorization
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch rental request to verify ownership
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, currentUserId),
    );

    if (fetchError || !rentalRequest) {
      return NextResponse.json(
        { error: fetchError?.message || "Rental request not found" },
        { status: 404 },
      );
    }

    // Authorization check: only owner can update instructions
    if (rentalRequest.ownerId !== currentUserId) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the listing owner can update rental instructions",
        },
        { status: 403 },
      );
    }

    // Update instructions via DAL
    const { data: rentalData, error: updateError } = await tryCatch(
      rentalDAL.updateRentalInstructions(
        rentalId,
        currentUserId,
        validatedData.pickupInstructions,
        validatedData.returnInstructions,
      ),
    );

    if (updateError || !rentalData) {
      return NextResponse.json(
        {
          error: updateError?.message || "Failed to update instructions",
        },
        { status: updateError ? 400 : 500 },
      );
    }

    // Send notification to renter
    try {
      await sendInstructionsUpdatedNotification({
        userId: rentalData.rental.renterId,
        renterName: rentalData.renterName,
        ownerName: rentalData.ownerName,
        listingName: rentalData.listingName,
        rentalId: rentalId,
        pickupInstructions: validatedData.pickupInstructions,
        returnInstructions: validatedData.returnInstructions,
      });
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "PATCH /api/rentals/[id]/instructions",
        action: "send_instructions_updated_notification",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/rentals/[id]/instructions",
);
