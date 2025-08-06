"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import {
  createRentalRequestSchema,
  type CreateRentalRequestFormData,
} from "../form-schemas/rental.schema";
import { rentalDAL } from "../dal";

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

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/mailbox");
  revalidatePath("/dashboard/mailbox/archived");

  return {
    success: true,
    requestId: rentalRequest.id,
    message:
      "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
  };
}
