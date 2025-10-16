"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
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

  // Update instructions via DAL
  const { data: rentalData, error: updateError } = await tryCatch(
    (async () => {
      return await rentalDAL.updateRentalInstructions(
        validatedData.rentalId,
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
