"use server";

import { revalidatePath } from "next/cache";
import { RentalDAL } from "@/dal/rentals.dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { tryCatch } from "@walkup/walkup-utils";
import { sendRentalStartedNotification } from "@/features/rentals/notifications/rental-started";

/**
 * Start a rental (approved → active)
 * Only the owner can start approved rentals on or after the start date
 */
export async function startRental(rentalId: string): Promise<{
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

    // Authorization check: only owner can start rentals
    if (rentalRequest.ownerId !== userId) {
      return {
        success: false,
        error: "Forbidden: Only the listing owner can start rentals",
      };
    }

    // Start the rental and get details for notification
    const result = await rentalDAL.startRental(rentalId, userId);

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

    // Revalidate rental detail page
    revalidatePath(`/dashboard/rental/${rentalId}`);
    revalidatePath("/dashboard/lending");
    revalidatePath("/dashboard/rentals");
    revalidatePath("/dashboard/lending/approved");
    revalidatePath("/dashboard/lending/active");

    return { success: true };
  } catch (error) {
    console.error("Error starting rental:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to start rental. Please try again.",
    };
  }
}
