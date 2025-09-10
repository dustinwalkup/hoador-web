export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { listingDAL } from "@/dal";
import { ListingDetailView } from "./_components/listing-detail-view";

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
