"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { tryCatch } from "@walkup/walkup-utils";
import { uploadToBlob } from "@/services/vercel-blob";

import {
  createListingSchemaServer,
  type CreateListingFormDataServerType,
} from "../form-schema/listing.schema";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import { listingDAL, userDAL } from "../../../dal";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

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

  // Check if user has completed Stripe Connect onboarding
  const { data: isOnboarded, error: onboardingError } = await tryCatch(
    userDAL.isConnectOnboardingComplete(userId),
  );

  if (onboardingError || !isOnboarded) {
    return {
      error:
        "Complete Stripe onboarding first. You need to set up payments before creating listings.",
    };
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

  // Record legal document acceptances for listing creation
  try {
    // Get IP address and user agent from headers
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      headersList.get("cf-connecting-ip") ||
      null;
    const userAgent = headersList.get("user-agent") || null;

    // Get current document versions
    const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

    // Record acceptance for each of the 4 owner policy documents
    const acceptancePromises = [];

    if (documentVersions[LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY]) {
      const doc = documentVersions[LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY];
      acceptancePromises.push(
        legalDocumentDAL.recordAcceptance(
          userId,
          LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY,
          doc.version,
          ipAddress,
          userAgent,
          "listing_creation",
          undefined, // rentalRequestId
          listing.id, // listingId
        ),
      );
    }

    if (documentVersions[LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS]) {
      const doc = documentVersions[LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS];
      acceptancePromises.push(
        legalDocumentDAL.recordAcceptance(
          userId,
          LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS,
          doc.version,
          ipAddress,
          userAgent,
          "listing_creation",
          undefined, // rentalRequestId
          listing.id, // listingId
        ),
      );
    }

    if (documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER]) {
      const doc = documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER];
      acceptancePromises.push(
        legalDocumentDAL.recordAcceptance(
          userId,
          LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER,
          doc.version,
          ipAddress,
          userAgent,
          "listing_creation",
          undefined, // rentalRequestId
          listing.id, // listingId
        ),
      );
    }

    if (
      documentVersions[LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT]
    ) {
      const doc =
        documentVersions[LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT];
      acceptancePromises.push(
        legalDocumentDAL.recordAcceptance(
          userId,
          LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT,
          doc.version,
          ipAddress,
          userAgent,
          "listing_creation",
          undefined, // rentalRequestId
          listing.id, // listingId
        ),
      );
    }

    // Record all acceptances in parallel
    await Promise.all(acceptancePromises);
  } catch (error) {
    // Log error but don't fail listing creation
    // The form validation already ensures the checkbox is checked
    console.error("Error recording legal document acceptances:", error);
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/listings");

  return { success: true, listingId: listing.id };
}
