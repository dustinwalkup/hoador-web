import { notFound } from "next/navigation";
import { listingDAL, rentalDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
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

  // Fetch listing details and booked dates in parallel for better performance
  const [listing, bookedDates] = await Promise.all([
    listingDAL.getListingById(id, currentUser.id),
    rentalDAL.getBookedDatesForListing(id),
  ]);

  if (!listing) {
    notFound();
  }

  // Prevent users from renting their own listings
  if (listing.owner.id === currentUser.id) {
    notFound();
  }

  return <RentListingPageContent listing={listing} bookedDates={bookedDates} />;
}
