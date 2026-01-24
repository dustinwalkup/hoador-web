"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { sendInstructionsUpdatedNotification } from "../notifications/instructions-updated";

const updateInstructionsSchema = z.object({
  rentalId: z.string().uuid(),
  pickupInstructions: z.string().optional(),
  returnInstructions: z.string().optional(),
});

export async function updateRentalInstructions(
  data: z.infer<typeof updateInstructionsSchema>,
) {
  // Validate input data
  const parseResult = updateInstructionsSchema.safeParse(data);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid data provided",
    };
  }

  const validatedData = parseResult.data;

  // Get current user ID for authorization
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  // Fetch rental request to verify ownership
  const { data: rentalRequest, error: fetchError } = await tryCatch(
    rentalDAL.getRentalRequestById(validatedData.rentalId, userId),
  );

  if (fetchError || !rentalRequest) {
    return {
      success: false,
      error: fetchError?.message || "Rental request not found",
    };
  }

  // Authorization check: only owner can update instructions
  if (rentalRequest.ownerId !== userId) {
    return {
      success: false,
      error: "Forbidden: Only the listing owner can update rental instructions",
    };
  }

  // Update instructions via DAL
  const { data: rentalData, error: updateError } = await tryCatch(
    (async () => {
      return await rentalDAL.updateRentalInstructions(
        validatedData.rentalId,
        userId,
        validatedData.pickupInstructions,
        validatedData.returnInstructions,
      );
    })(),
  );

  if (updateError || !rentalData) {
    return {
      success: false,
      error: updateError?.message || "Failed to update instructions",
    };
  }

  // Send notification to renter
  try {
    await sendInstructionsUpdatedNotification({
      userId: rentalData.rental.renterId,
      renterName: rentalData.renterName,
      ownerName: rentalData.ownerName,
      listingName: rentalData.listingName,
      rentalId: validatedData.rentalId,
      pickupInstructions: validatedData.pickupInstructions,
      returnInstructions: validatedData.returnInstructions,
    });
  } catch (notificationError) {
    console.error("Failed to send notification:", notificationError);
  }

  // Revalidate the relevant pages
  revalidatePath("/dashboard/lending/active");
  revalidatePath("/dashboard/lending/incoming");
  revalidatePath("/dashboard/rental/[id]", "page");

  return {
    success: true,
  };
}
