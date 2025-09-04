"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";

import {
  createListingSchemaServer,
  type CreateListingFormDataServerType,
} from "../form-schema/listing.schema";
import { getCurrentUserId } from "../../authentication/auth.utils";
import { listingDAL } from "../../../dal";

export async function updateListing(
  listingId: string,
  formData: CreateListingFormDataServerType,
) {
  console.log("FORM DATA", formData);
  // Validate the form data
  const validationResult = createListingSchemaServer.safeParse(formData);

  if (!validationResult.success) {
    return {
      error: "Validation failed",
      details: validationResult.error.flatten(),
    };
  }

  const validatedData = validationResult.data;

  // Get current user ID
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Unauthorized: User not authenticated" };
  }

  // Update the listing
  const { data: listing, error } = await tryCatch(
    listingDAL.updateListing(listingId, userId, validatedData),
  );

  if (error) {
    console.error("Error updating listing:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "An unexpected error occurred while updating the listing" };
  }

  if (!listing) {
    return { error: "Failed to update listing" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/listings");

  return { success: true, listingId };
}
