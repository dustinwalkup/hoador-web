import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { RentalDAL } from "@/dal/rentals.dal";
import {
  handleApiError,
  captureNonCriticalError,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { sendRentalEndedNotification } from "@/features/rentals/notifications/rental-ended";

/**
 * POST /api/rentals/[id]/end
 * End a rental (active → completed)
 * Only the owner can end active rentals
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { id: rentalId } = await params;

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
    const rentalDAL = new RentalDAL();
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, currentUserId),
    );

    if (fetchError || !rentalRequest) {
      return NextResponse.json(
        { error: fetchError?.message || "Rental request not found" },
        { status: 404 },
      );
    }

    // Authorization check: only owner can end rentals
    if (rentalRequest.ownerId !== currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: Only the listing owner can end rentals" },
        { status: 403 },
      );
    }

    // End the rental and get details for notification
    const { data: result, error } = await tryCatch(
      rentalDAL.endRental(rentalId, currentUserId),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!result) {
      return NextResponse.json(
        { error: "Failed to end rental" },
        { status: 500 },
      );
    }

    // Send notification to renter
    try {
      await sendRentalEndedNotification({
        userId: result.rental.renterId,
        renterName: result.renterName,
        ownerName: result.ownerName,
        listingName: result.listingName,
        rentalId: rentalId,
      });
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/rentals/[id]/end",
        action: "send_rental_ended_notification",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
