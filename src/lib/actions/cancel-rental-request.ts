"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL } from "@/lib/dal";
import { requireAuth } from "@/lib/auth/auth.utils";

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

  // Revalidate the rentals pages to show updated status
  revalidatePath("/dashboard/renting/requests");
  revalidatePath("/dashboard/renting/");
  revalidatePath(`/dashboard/rental/${requestId}`);

  return { success: true };
}
