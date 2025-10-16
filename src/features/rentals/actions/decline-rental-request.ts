"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL, userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { sendRentalDeniedNotification } from "../notifications/rental-denied";

const declineRequestSchema = z.object({
  requestId: z.string().uuid(),
  denialReason: z.string().min(1, "Denial reason is required"),
});

export async function declineRentalRequest(
  data: z.infer<typeof declineRequestSchema>,
) {
  // Validate input data
  const parseResult = declineRequestSchema.safeParse(data);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid data provided",
    };
  }

  const validatedData = parseResult.data;

  // Fetch rental request details before declining (for notification)
  const { data: rentalRequest, error: fetchError } = await tryCatch(
    rentalDAL.getRentalRequestById(validatedData.requestId),
  );

  if (fetchError || !rentalRequest) {
    return {
      success: false,
      error: fetchError?.message || "Rental request not found",
    };
  }

  const { error } = await tryCatch(
    rentalDAL.declineRentalRequest(
      validatedData.requestId,
      validatedData.denialReason,
    ),
  );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Send notification to renter (don't block on notification failure)
  try {
    const { data: renterUser } = await tryCatch(
      userDAL.getUserById(rentalRequest.renterId),
    );
    const { data: ownerUser } = await tryCatch(
      userDAL.getUserById(rentalRequest.ownerId),
    );

    if (renterUser && ownerUser) {
      await sendRentalDeniedNotification({
        userId: renterUser.id,
        to: renterUser.email,
        renterName: `${renterUser.firstName} ${renterUser.lastName}`,
        ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
        listingName: rentalRequest.listingName,
        rentalId: rentalRequest.id,
        denialReason: validatedData.denialReason,
      }).catch((err) => {
        console.error("Failed to send rental denied notification:", err);
      });
    }
  } catch (notificationError) {
    console.error(
      "Error sending rental denied notification:",
      notificationError,
    );
  }

  // Revalidate the relevant pages
  revalidatePath("/dashboard/lending/incoming");
  revalidatePath("/dashboard/renting/pending");
  revalidatePath("/dashboard/rental/[id]", "page");

  return {
    success: true,
  };
}
