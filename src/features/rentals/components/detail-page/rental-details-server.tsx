import { notFound } from "next/navigation";
import { rentalDAL, legalDocumentDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentalLayout } from "./rental-layout";
import { RentalContent } from "./rental-content";
import { getAuthenticatedUser } from "@/features/auth/utils/session";

interface RentalDetailsServerProps {
  rentalId: string;
  view?: string;
}

export async function RentalDetailsServer({
  rentalId,
  view,
}: RentalDetailsServerProps) {
  // Check authentication
  const auth = await getAuthenticatedUser();
  if (!auth) {
    notFound();
  }
  const { userId } = auth;

  const rentalDetails = await rentalDAL.getRentalDetailsById(rentalId, userId);

  if (!rentalDetails) {
    notFound();
  }

  // Verify user has access to this rental (is either renter or owner)
  if (rentalDetails.renterId !== userId && rentalDetails.ownerId !== userId) {
    notFound();
  }

  const isRenter = userId === rentalDetails.renterId;
  const isOwner = userId === rentalDetails.ownerId;

  // Determine the view context
  let viewContext: "renting" | "lending" | "auto" = "auto";

  if (view === "renting") {
    viewContext = "renting";
  } else if (view === "lending") {
    viewContext = "lending";
  } else {
    // Auto-detect based on user role
    viewContext = isRenter ? "renting" : "lending";
  }

  // Fetch the rental agreement document that was accepted for this rental
  // Fallback to current version if no acceptance found
  let rentalAgreementUrl: string | undefined;
  try {
    const acceptance = await legalDocumentDAL.getRentalAgreementAcceptance(
      rentalId,
      userId,
    );
    if (acceptance) {
      rentalAgreementUrl = acceptance.url;
    } else {
      // Fallback to current version if no acceptance found
      const currentVersion = await legalDocumentDAL.getCurrentVersion(
        LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
      );
      if (currentVersion) {
        rentalAgreementUrl = currentVersion.url;
      }
    }
  } catch (error) {
    // If there's an error fetching, continue without the URL
    // The button will be disabled
    console.error("Error fetching rental agreement:", error);
  }

  // Fetch the review policy document
  let reviewPolicyUrl: string | undefined;
  try {
    const currentVersion = await legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.REVIEW_POLICY,
    );
    if (currentVersion) {
      reviewPolicyUrl = currentVersion.url;
    }
  } catch (error) {
    // If there's an error fetching, continue without the URL
    console.error("Error fetching review policy:", error);
  }

  return (
    <RentalLayout
      rentalDetails={rentalDetails}
      viewContext={viewContext}
      isRenter={isRenter}
      isOwner={isOwner}
    >
      <RentalContent
        rentalDetails={rentalDetails}
        viewContext={viewContext}
        isRenter={isRenter}
        isOwner={isOwner}
        rentalAgreementUrl={rentalAgreementUrl}
        reviewPolicyUrl={reviewPolicyUrl}
      />
    </RentalLayout>
  );
}
