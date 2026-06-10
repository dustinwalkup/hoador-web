export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { ListingDetailView } from "@/features/listings/components/listing-detail-view";
import { TrackViewContent } from "@/components/analytics/track-view-content";
import { communityDAL, listingDAL } from "@/dal";

export const metadata = {
  title: "Listing Details",
  description: "View detailed information about this listing",
};

interface ToolDetailPageProps {
  params: Promise<{ id: string }>;
}

const BROWSEABLE_STATUSES = new Set(["available", "rented"]);

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return notFound();
  const { id } = await params;
  const listing = await listingDAL.getListingById(id, currentUser.id);

  if (!listing) {
    notFound();
  }

  const isOwner = currentUser.id === listing.owner.id;

  // Symmetric per-community visibility (R5): a non-owner may view a browseable
  // listing only if both the viewer and the owner are visible in the listing's
  // home community — the same rule the tool search applies.
  if (!isOwner) {
    if (!BROWSEABLE_STATUSES.has(listing.status)) {
      notFound();
    }
    const [viewerVisible, ownerVisible] = await Promise.all([
      communityDAL.isVisibleInCommunity(currentUser.id, listing.communityId),
      communityDAL.isVisibleInCommunity(listing.owner.id, listing.communityId),
    ]);
    if (!viewerVisible || !ownerVisible) {
      notFound();
    }
  }

  return (
    <>
      <TrackViewContent contentId={listing.id} contentName={listing.name} />
      <ListingDetailView listing={listing} isOwner={isOwner} />
    </>
  );
}
