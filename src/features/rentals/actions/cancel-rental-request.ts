"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL, userDAL } from "@/dal";
import { requireAuth } from "@/features/auth/utils/session";
import { sendRentalCancelledNotification } from "../notifications/rental-cancelled";

/**
 * Cancel a rental request
 * Only the renter can cancel their own pending requests
 */
export async function cancelRentalRequestAction(requestId: string) {
  const { data: user, error: authError } = await tryCatch(requireAuth());

  if (authError) {
    console.error("Authentication error:", authError);
    return {
      success: false,
      error:
        authError instanceof Error
          ? authError.message
          : "Authentication failed",
    };
  }

  // Fetch rental request details before canceling (for notification)
  const { data: rentalRequest, error: fetchError } = await tryCatch(
    rentalDAL.getRentalRequestById(requestId),
  );

  if (fetchError || !rentalRequest) {
    return {
      success: false,
      error: fetchError?.message || "Rental request not found",
    };
  }

  const { error } = await tryCatch(
    rentalDAL.cancelRentalRequest(requestId, user.id),
  );

  if (error) {
    console.error("Failed to cancel rental request:", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Failed to cancel request" };
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

  // Revalidate the rentals pages to show updated status
  revalidatePath("/dashboard/renting/requests");
  revalidatePath("/dashboard/renting/");
  revalidatePath("/dashboard/lending/incoming");
  revalidatePath(`/dashboard/rental/${requestId}`);

  return { success: true };
}
