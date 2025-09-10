"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import { uploadToBlob } from "@/services/vercel-blob";

import {
  createListingSchemaServer,
  type CreateListingFormDataServerType,
} from "../form-schema/listing.schema";
import { getCurrentUserId } from "../../auth/auth.utils";
import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import { listingDAL } from "../../../dal";

// Separate action for uploading images
export async function uploadListingImage(
  file: File,
  listingId: string,
  orderIndex: number,
) {
  try {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `listings/${listingId}/${timestamp}-${sanitizedName}`;

    const blob = await uploadToBlob(filename, file);

    // Save to database
    const [savedImage] = await db
      .insert(listingImages)
      .values({
        listingId,
        imageUrl: blob.url,
        blobPathname: blob.pathname,
        orderIndex,
      })
      .returning();

    return { success: true, image: savedImage };
  } catch (error) {
    console.error("Error uploading image:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

export async function createListing(formData: CreateListingFormDataServerType) {
  console.log("CREATE Listing formData", formData);
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

  // Create the listing first
  const { data: listing, error } = await tryCatch(
    listingDAL.createListing(validatedData),
  );

  if (error) {
    console.error("Error creating listing:", error);

    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "An unexpected error occurred while creating the listing" };
  }

  // Create the listing
  if (!listing) {
    return { error: "Failed to create listing" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/listings");

  return { success: true, listingId: listing.id };
}
