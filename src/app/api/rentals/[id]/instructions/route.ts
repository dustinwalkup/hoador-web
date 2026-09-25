import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { z } from "zod";
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

    // Fetch rental request to verify ownership. getRentalRequestById throws
    // NotFoundError (never resolves null) and handleApiError below maps it to
    // 404 with its own safe message (ARCH-05 — previously this call was
    // tryCatch-wrapped and returned a flat 404 with the raw error message for
    // any failure).
    const rentalRequest = await rentalDAL.getRentalRequestById(
      rentalId,
      currentUserId,
    );

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

    // Update instructions via DAL. updateRentalInstructions throws
    // NotFoundError or ConflictError (wrong rental status) — handleApiError
    // below maps ConflictError to 409, not the flat 400 this route returned
    // before (ARCH-05).
    const rentalData = await rentalDAL.updateRentalInstructions(
      rentalId,
      currentUserId,
      validatedData.pickupInstructions,
      validatedData.returnInstructions,
    );

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
