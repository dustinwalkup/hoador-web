export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { ListingDetailView } from "@/features/listings/components/listing-detail-view";
import { listingDAL } from "@/dal";

export const metadata = {
  title: "Listing Details",
  description: "View detailed information about this listing",
};

interface ToolDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return notFound();
  const { id } = await params;
  const listing = await listingDAL.getListingById(id, currentUser.id);

  if (!listing) {
    notFound();
  }

  const isOwner = currentUser.id === listing.owner.id;

  return <ListingDetailView listing={listing} isOwner={isOwner} />;
}
