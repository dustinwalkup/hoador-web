"use server";

import { revalidatePath } from "next/cache";
import { RentalDAL } from "@/dal/rentals.dal";
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
    const rentalDAL = new RentalDAL();

    // End the rental and get details for notification
    const result = await rentalDAL.endRental(rentalId);

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
