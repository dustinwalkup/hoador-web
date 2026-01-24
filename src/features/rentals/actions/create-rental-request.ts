"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { tryCatch } from "@walkup/walkup-utils";
import {
  createRentalRequestSchema,
  type CreateRentalRequestFormData,
} from "../lib/form-schema";
import { rentalDAL, userDAL, listingDAL, legalDocumentDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { getCurrentUserId } from "@/features/auth/utils/session";
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

  // Get current user ID
  const userIdResult = await getCurrentUserId();
  if (!userIdResult) {
    return {
      error: "You must be logged in to create a rental request",
    };
  }
  const userId: string = userIdResult;

  // Verify ownership - prevent users from renting their own listings
  const listing = await listingDAL.getListingById(validatedData.listingId);
  if (!listing) {
    return {
      error: "Listing not found",
    };
  }

  if (listing.owner.id === userId) {
    return {
      error: "Cannot rent your own listing",
    };
  }

  // Get IP address and user agent from headers (needed for legal acceptance recording)
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    null;
  const userAgent = headersList.get("user-agent") || null;

  // Create the rental request first
  const { data: rentalRequest, error } = await tryCatch(
    rentalDAL.createRentalRequest(validatedData, userId),
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

  // Record legal document acceptances AFTER rental request creation
  // This ties the acceptances to the specific rental request for legal audit trail
  if (
    validatedData.rentalAgreementAccepted ||
    validatedData.safetyLiabilityPackageAccepted ||
    validatedData.paymentPayoutAccepted
  ) {
    try {
      // Get current document versions
      const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

      // Record acceptances for documents that were accepted
      const acceptancePromises = [];

      if (
        validatedData.rentalAgreementAccepted &&
        documentVersions[LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT]
      ) {
        const doc = documentVersions[LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT];
        acceptancePromises.push(
          legalDocumentDAL.recordAcceptance(
            userId,
            LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
            doc.version,
            ipAddress,
            userAgent,
            "rental_checkout",
            rentalRequest.id, // Link to specific rental request
          ),
        );
      }

      if (
        validatedData.safetyLiabilityPackageAccepted &&
        documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
      ) {
        const doc =
          documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE];
        acceptancePromises.push(
          legalDocumentDAL.recordAcceptance(
            userId,
            LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
            doc.version,
            ipAddress,
            userAgent,
            "rental_checkout",
            rentalRequest.id, // Link to specific rental request
          ),
        );
      }

      if (
        validatedData.paymentPayoutAccepted &&
        documentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS]
      ) {
        const doc = documentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS];
        acceptancePromises.push(
          legalDocumentDAL.recordAcceptance(
            userId,
            LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS,
            doc.version,
            ipAddress,
            userAgent,
            "rental_checkout",
            rentalRequest.id, // Link to specific rental request
          ),
        );
      }

      // Record all acceptances in parallel (don't block on failures)
      await Promise.allSettled(acceptancePromises);
    } catch (error) {
      // Log error but don't fail the rental request creation
      console.error("Error recording legal document acceptances:", error);
    }
  }

  // Send notification to owner (don't block on notification failure)
  try {
    const { data: fullRequest } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalRequest.id, userId),
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
