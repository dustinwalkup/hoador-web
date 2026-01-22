import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL, userDAL } from "@/dal";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";
import { sendRentalCancelledNotification } from "@/features/rentals/notifications/rental-cancelled";

/**
 * POST /api/rentals/[id]/cancel
 * Cancel a rental request (only renter can cancel pending requests)
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

    // Get current user ID
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch rental request details before canceling (for notification)
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId),
    );

    if (fetchError || !rentalRequest) {
      return NextResponse.json(
        { error: fetchError?.message || "Rental request not found" },
        { status: 404 },
      );
    }

    const { error } = await tryCatch(
      rentalDAL.cancelRentalRequest(rentalId, currentUserId),
    );

    if (error) {
      return handleApiError(error);
    }

    // Send notification to owner (don't block on notification failure)
    try {
      const { data: ownerUser } = await tryCatch(
        userDAL.getUserById(rentalRequest.ownerId),
      );
      const { data: renterUser } = await tryCatch(
        userDAL.getUserById(rentalRequest.renterId),
      );

      if (ownerUser && renterUser) {
        await sendRentalCancelledNotification({
          recipientUserId: ownerUser.id,
          recipientName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          otherPartyName: `${renterUser.firstName} ${renterUser.lastName}`,
          listingName: rentalRequest.listingName,
          rentalId: rentalRequest.id,
          cancelledBy: "renter",
          cancellationReason: "Renter cancelled the request",
        }).catch((err) => {
          console.error("Failed to send rental cancelled notification:", err);
        });
      }
    } catch (notificationError) {
      console.error(
        "Error sending rental cancelled notification:",
        notificationError,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
