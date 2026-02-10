import { notFound } from "next/navigation";
import { listingDAL, rentalDAL, legalDocumentDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentListingPageContent } from "@/features/rentals/components/rent-flow/rent-listing-page-content";

interface RentListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function RentListingPage({
  params,
}: RentListingPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  const { id } = await params;

  const [listing, bookedDates, documentVersions] = await Promise.all([
    listingDAL.getListingById(id, currentUser.id),
    rentalDAL.getBookedDatesForListing(id, currentUser.id),
    legalDocumentDAL.getAllCurrentVersions(),
  ]);

  if (!listing) notFound();
  if (listing.owner.id === currentUser.id) notFound();

  const legalDocuments = {
    rentalAgreement: documentVersions[LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT],
    cancellationRefund:
      documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND],
    safetyLiabilityPackage:
      documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE],
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
