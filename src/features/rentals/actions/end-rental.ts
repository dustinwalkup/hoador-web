"use server";

import { revalidatePath } from "next/cache";
import { RentalDAL } from "@/dal/rentals.dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { tryCatch } from "@walkup/walkup-utils";
import { sendRentalEndedNotification } from "@/features/rentals/notifications/rental-ended";

/**
 * End a rental (active → completed)
 * Only the owner can end active rentals
 */
export async function endRental(rentalId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get current user ID for authorization
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const rentalDAL = new RentalDAL();

    // Fetch rental request to verify ownership
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, userId),
    );

    if (fetchError || !rentalRequest) {
      return {
        success: false,
        error: fetchError?.message || "Rental request not found",
      };
    }

    // Authorization check: only owner can end rentals
    if (rentalRequest.ownerId !== userId) {
      return {
        success: false,
        error: "Forbidden: Only the listing owner can end rentals",
      };
    }

    // End the rental and get details for notification
    const result = await rentalDAL.endRental(rentalId, userId);

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

    // Revalidate rental detail page
    revalidatePath(`/dashboard/rental/${rentalId}`);
    revalidatePath("/dashboard/lending");
    revalidatePath("/dashboard/rentals");

    return { success: true };
  } catch (error) {
    console.error("Error ending rental:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to end rental. Please try again.",
    };
  }
}
