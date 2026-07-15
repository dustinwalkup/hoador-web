export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { communityDAL, neighborhoodNeedsDAL } from "@/dal";
import { NeedDetail } from "@/features/neighborhood-needs/components/need-detail";

interface NeedDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function NeedDetailPage({ params }: NeedDetailPageProps) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/sign-in");

  const { id } = await params;
  const viewerLocation = await neighborhoodNeedsDAL.getUserPrimaryLocation(
    auth.userId,
  );
  const need = await neighborhoodNeedsDAL.getNeedDetail(id, viewerLocation);

  if (!need || need.deletedAt) {
    notFound();
  }

  const isOwner = need.createdByUserId === auth.userId;

  // Creator and admins always have access; everyone else needs SYMMETRIC
  // visibility — both the viewer AND the creator must be visible in the need's
  // community (mirrors the feed + listing-detail rule). A viewer-only check
  // leaks needs whose creator is no longer visible (stale community_visibility,
  // e.g. after a community changes networks).
  if (!isOwner && !auth.isAdmin) {
    const [viewerVisible, creatorVisible] = await Promise.all([
      communityDAL.isVisibleInCommunity(auth.userId, need.communityId),
      communityDAL.isVisibleInCommunity(need.createdByUserId, need.communityId),
    ]);
    if (!viewerVisible || !creatorVisible) {
      notFound();
    }
  }

  return (
    <div className="container max-w-3xl pb-10">
      <NeedDetail
        need={need}
        currentUserId={auth.userId}
        isAdmin={auth.isAdmin}
      />
    </div>
  );
}
