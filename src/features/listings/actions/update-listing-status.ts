"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import { z } from "zod";
import { listingDAL } from "../../../dal";

const updateListingStatusSchema = z.object({
  status: z.enum(["available", "maintenance", "inactive"]),
});

type UpdateListingStatusData = z.infer<typeof updateListingStatusSchema>;

export async function updateListingStatus(
  listingId: string,
  formData: UpdateListingStatusData,
) {
  // Validate the form data
  const validationResult = updateListingStatusSchema.safeParse(formData);

  if (!validationResult.success) {
    return {
      error: "Validation failed",
      details: validationResult.error.flatten(),
    };
  }

  const validatedData = validationResult.data;

  // Update the listing status
  const { data: listing, error } = await tryCatch(
    listingDAL.updateListingStatus(listingId, validatedData.status),
  );

  if (error) {
    console.error("Error updating listing status:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return {
      error: "An unexpected error occurred while updating the listing status",
    };
  }

  if (!listing) {
    return { error: "Failed to update listing status" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard/explore");

  return { success: true, listing };
}
