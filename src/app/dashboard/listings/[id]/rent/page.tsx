import { notFound } from "next/navigation";
import { listingDAL, rentalDAL, legalDocumentDAL } from "@/dal";
import { canViewOwnerItem } from "@/features/community/utils/item-visibility";
import { getCurrentUser } from "@/features/auth/utils/session";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentListingPageContent } from "@/features/rentals/components/rent-flow/rent-listing-page-content";

interface RentListingPageProps {
  params: Promise<{ id: string }>;
}

// Statuses a non-owner may browse / rent — matches the listing search filter.
const RENTABLE_STATUSES = new Set(["available", "rented"]);

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

  // Symmetric visibility (R5 + SETTINGS-004): a renter may reach the rent flow
  // only for a browseable listing whose home community is visible to both them
  // and the owner, when neither has hidden the other's home community — the
  // same gate the tool search and listing detail apply.
  if (!RENTABLE_STATUSES.has(listing.status)) notFound();
  const visible = await canViewOwnerItem(
    currentUser.id,
    listing.owner.id,
    listing.communityId,
  );
  if (!visible) notFound();

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
