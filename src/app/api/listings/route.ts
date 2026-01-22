import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import {
  createListingSchemaServer,
  type CreateListingFormDataServerType,
} from "@/features/listings/form-schema/listing.schema";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { listingDAL, userDAL } from "@/dal";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

/**
 * POST /api/listings
 * Create a new listing
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    // Get current user ID
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await parseFormData(request);

    // Validate form data
    const validationResult = createListingSchemaServer.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data as CreateListingFormDataServerType;

    // Check if user has completed Stripe Connect onboarding
    const { data: isOnboarded, error: onboardingError } = await tryCatch(
      userDAL.isConnectOnboardingComplete(currentUserId),
    );

    if (onboardingError || !isOnboarded) {
      return NextResponse.json(
        {
          error:
            "Complete Stripe onboarding first. You need to set up payments before creating listings.",
        },
        { status: 400 },
      );
    }

    // Create the listing
    const { data: listing, error } = await tryCatch(
      listingDAL.createListing(validatedData),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!listing) {
      return NextResponse.json(
        { error: "Failed to create listing" },
        { status: 500 },
      );
    }

    // Record legal document acceptances for listing creation
    try {
      // Get IP address and user agent from request
      const ipAddress = getClientIP(request);
      const userAgent = getUserAgent(request);

      // Get current document versions
      const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

      // Record acceptance for each of the owner policy documents
      const acceptancePromises = [];

      if (documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]) {
        const doc = documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE];
        acceptancePromises.push(
          legalDocumentDAL.recordAcceptance(
            currentUserId,
            LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
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
          documentVersions[
            LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT
          ];
        acceptancePromises.push(
          legalDocumentDAL.recordAcceptance(
            currentUserId,
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

    return NextResponse.json({
      success: true,
      listingId: listing.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
