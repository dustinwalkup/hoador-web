"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { sendInstructionsUpdatedEmail } from "../notifications/instructions-updated";

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

  // Send email notification to renter
  // Note: We use the rentalRequestId for the email link since that's what the URL expects
  const { error: emailError } = await tryCatch(
    sendInstructionsUpdatedEmail({
      to: rentalData.renterEmail,
      renterName: rentalData.renterName,
      ownerName: rentalData.ownerName,
      listingName: rentalData.listingName,
      rentalId: validatedData.rentalId, // This is actually the rental request ID
      pickupInstructions: validatedData.pickupInstructions,
      returnInstructions: validatedData.returnInstructions,
    }),
  );

  // Log email error but don't fail the whole operation
  if (emailError) {
    console.error("Failed to send email notification:", emailError);
  }

  // Revalidate the relevant pages
  revalidatePath("/dashboard/lending/active");
  revalidatePath("/dashboard/lending/incoming");
  revalidatePath("/dashboard/rental/[id]", "page");

  return {
    success: true,
  };
}
