import { notFound } from "next/navigation";
import { listingDAL, rentalDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentListingPageContent } from "./_components/rent-listing-page-content";

interface RentListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function RentListingPage({
  params,
}: RentListingPageProps) {
  // Get the current user - they must be authenticated to rent
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) {
    // Redirect to login would be handled by middleware
    notFound();
  }

  const { id } = await params;

  // Fetch listing details, booked dates, and legal documents in parallel
  const [listing, bookedDates, documentVersions] = await Promise.all([
    listingDAL.getListingById(id, currentUser.id),
    rentalDAL.getBookedDatesForListing(id),
    legalDocumentDAL.getAllCurrentVersions(),
  ]);

  if (!listing) {
    notFound();
  }

  // Prevent users from renting their own listings
  if (listing.owner.id === currentUser.id) {
    notFound();
  }

  // Prepare document data for client component
  const legalDocuments = {
    rentalAgreement: documentVersions[LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT],
    cancellationRefund:
      documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND],
    safetyDisclaimer: documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER],
    damageLossLiability:
      documentVersions[LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY],
    paymentPayout: documentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS],
  };

  return (
    <RentListingPageContent
      listing={listing}
      bookedDates={bookedDates}
      currentUser={currentUser}
      legalDocuments={legalDocuments}
    />
  );
}
