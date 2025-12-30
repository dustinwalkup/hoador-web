import { notFound } from "next/navigation";
import { rentalDAL } from "@/dal";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentalLayout } from "./rental-layout";
import { RentalContent } from "./rental-content";

interface RentalDetailsServerProps {
  rentalId: string;
  view?: string;
}

export async function RentalDetailsServer({
  rentalId,
  view,
}: RentalDetailsServerProps) {
  const rentalDetails = await rentalDAL.getRentalDetailsById(rentalId);

  if (!rentalDetails) {
    notFound();
  }

  const isRenter = rentalDetails.currentUserId === rentalDetails.renterId;
  const isOwner = rentalDetails.currentUserId === rentalDetails.ownerId;

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
    const acceptance =
      await legalDocumentDAL.getRentalAgreementAcceptance(rentalId);
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
      />
    </RentalLayout>
  );
}
