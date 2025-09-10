import { notFound } from "next/navigation";
import { listingDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/auth.utils";
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

  // Get listing details
  const listing = await listingDAL.getListingById(id, currentUser.id);

  if (!listing) {
    notFound();
  }

  // Prevent users from renting their own listings
  if (listing.owner.id === currentUser.id) {
    notFound();
  }

  return <RentListingPageContent listing={listing} />;
}
