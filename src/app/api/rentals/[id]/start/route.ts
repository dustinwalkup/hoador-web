import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { RentalDAL } from "@/dal/rentals.dal";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";
import { sendRentalStartedNotification } from "@/features/rentals/notifications/rental-started";

/**
 * POST /api/rentals/[id]/start
 * Start a rental (approved → active)
 * Only the owner can start approved rentals on or after the start date
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
    const rentalDAL = new RentalDAL();

    // Start the rental and get details for notification
    const { data: result, error } = await tryCatch(
      rentalDAL.startRental(rentalId),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!result) {
      return NextResponse.json(
        { error: "Failed to start rental" },
        { status: 500 },
      );
    }

    // Send notification to renter
    try {
      await sendRentalStartedNotification({
        userId: result.rental.renterId,
        renterName: result.renterName,
        ownerName: result.ownerName,
        listingName: result.listingName,
        rentalId: rentalId,
      });
    } catch (notificationError) {
      // Log notification error but don't fail the action
      console.error(
        "Failed to send rental started notification:",
        notificationError,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
