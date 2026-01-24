import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL, userDAL, listingDAL, legalDocumentDAL } from "@/dal";
import {
  handleApiError,
  parseFormData,
  getClientIP,
  getUserAgent,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { createRentalRequestSchema } from "@/features/rentals/lib/form-schema";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { sendRentalRequestCreatedNotification } from "@/features/rentals/notifications/rental-request-created";

/**
 * POST /api/rentals
 * Create a new rental request
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    // Parse request body
    const body = await parseFormData(request);

    // Convert date strings to Date objects if needed
    const processedBody = {
      ...body,
      startDate:
        typeof body.startDate === "string"
          ? new Date(body.startDate)
          : body.startDate,
      endDate:
        typeof body.endDate === "string"
          ? new Date(body.endDate)
          : body.endDate,
    };

    // Validate form data
    const validationResult = createRentalRequestSchema.safeParse(processedBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    // Get current user ID (already checked auth above)
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "You must be logged in to create a rental request" },
        { status: 401 },
      );
    }

    // Verify ownership - prevent users from renting their own listings
    const listing = await listingDAL.getListingById(validatedData.listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.owner.id === currentUserId) {
      return NextResponse.json(
        { error: "Cannot rent your own listing" },
        { status: 403 },
      );
    }

    // Get IP address and user agent for legal acceptance recording
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    // Create the rental request
    const { data: rentalRequest, error } = await tryCatch(
      rentalDAL.createRentalRequest(validatedData, currentUserId),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!rentalRequest) {
      return NextResponse.json(
        { error: "Failed to create rental request" },
        { status: 500 },
      );
    }

    // Record legal document acceptances AFTER rental request creation
    // This ties the acceptances to the specific rental request for legal audit trail
    if (
      validatedData.rentalAgreementAccepted ||
      validatedData.cancellationRefundAcknowledged ||
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
              currentUserId,
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
          validatedData.cancellationRefundAcknowledged &&
          documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND]
        ) {
          const doc = documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              currentUserId,
              LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND,
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
              currentUserId,
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
              currentUserId,
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
        rentalDAL.getRentalRequestById(rentalRequest.id, currentUserId),
      );

      if (fullRequest) {
        const { data: ownerUser } = await tryCatch(
          userDAL.getUserById(fullRequest.ownerId),
        );
        const { data: renterUser } = await tryCatch(
          userDAL.getUserById(fullRequest.renterId),
        );

        if (ownerUser && renterUser) {
          const startDate = new Date(
            fullRequest.startDate,
          ).toLocaleDateString();
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

    return NextResponse.json({
      success: true,
      requestId: rentalRequest.id,
      message:
        "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
