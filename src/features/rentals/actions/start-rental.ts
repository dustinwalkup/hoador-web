"use server";

import { revalidatePath } from "next/cache";
import { RentalDAL } from "@/dal/rentals.dal";
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
    const rentalDAL = new RentalDAL();

    // Start the rental and get details for notification
    const result = await rentalDAL.startRental(rentalId);

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
