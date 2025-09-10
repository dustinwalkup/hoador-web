import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { listingDAL } from "@/dal";
import { ListingDetailView } from "../../dashboard/listings/[id]/_components/listing-detail-view";

interface PublicListingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicListingDetailPage({
  params,
}: PublicListingDetailPageProps) {
  // For public view, we may or may not have a current user
  const currentUser = await getCurrentUser().catch(() => null);
  const { id } = await params;

  // Get listing details - pass undefined for userId if no user is logged in
  const listing = await listingDAL.getListingById(
    id,
    currentUser?.id || undefined,
  );

  if (!listing) {
    notFound();
  }

  // Public view always shows as non-owner (isOwner = false)
  return <ListingDetailView listing={listing} isOwner={false} />;
}
