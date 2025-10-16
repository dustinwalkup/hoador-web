"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import {
  createRentalRequestSchema,
  type CreateRentalRequestFormData,
} from "../lib/form-schema";
import { rentalDAL, userDAL } from "../../../dal";
import { sendRentalRequestCreatedNotification } from "../notifications/rental-request-created";

export async function createRentalRequest(
  formData: CreateRentalRequestFormData,
) {
  // Validate the form data
  const validationResult = createRentalRequestSchema.safeParse(formData);

  if (!validationResult.success) {
    return {
      error: "Validation failed",
      details: validationResult.error.flatten(),
    };
  }

  const validatedData = validationResult.data;

  // Create the rental request
  const { data: rentalRequest, error } = await tryCatch(
    rentalDAL.createRentalRequest(validatedData),
  );

  if (error) {
    console.error("Error creating rental request:", error);

    if (error instanceof Error) {
      return { error: error.message };
    }

    return {
      error: "An unexpected error occurred while creating the rental request",
    };
  }

  if (!rentalRequest) {
    return { error: "Failed to create rental request" };
  }

  // Send notification to owner (don't block on notification failure)
  try {
    const { data: fullRequest } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalRequest.id),
    );

    if (fullRequest) {
      const { data: ownerUser } = await tryCatch(
        userDAL.getUserById(fullRequest.ownerId),
      );
      const { data: renterUser } = await tryCatch(
        userDAL.getUserById(fullRequest.renterId),
      );

      if (ownerUser && renterUser) {
        const startDate = new Date(fullRequest.startDate).toLocaleDateString();
        const endDate = new Date(fullRequest.endDate).toLocaleDateString();

        await sendRentalRequestCreatedNotification({
          userId: ownerUser.id,
          to: ownerUser.email,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          listingName: fullRequest.listingName,
          rentalId: fullRequest.id,
          startDate,
          endDate,
          totalAmount: fullRequest.totalAmount,
        }).catch((err) => {
          console.error(
            "Failed to send rental request created notification:",
            err,
          );
        });
      }
    }
  } catch (notificationError) {
    console.error(
      "Error sending rental request notification:",
      notificationError,
    );
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/mailbox");
  revalidatePath("/dashboard/mailbox/archived");
  revalidatePath("/dashboard/lending/incoming");

  return {
    success: true,
    requestId: rentalRequest.id,
    message:
      "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
  };
}
