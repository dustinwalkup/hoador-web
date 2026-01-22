import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { RentalDAL } from "@/dal/rentals.dal";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";
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
    const rentalDAL = new RentalDAL();

    // End the rental and get details for notification
    const { data: result, error } = await tryCatch(
      rentalDAL.endRental(rentalId),
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
      // Log notification error but don't fail the action
      console.error(
        "Failed to send rental ended notification:",
        notificationError,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
