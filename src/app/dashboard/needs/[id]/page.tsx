export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { neighborhoodNeedsDAL } from "@/dal";
import { getCurrentUserVisibleCommunityIds } from "@/features/community/utils/membership";
import { NeedDetail } from "@/features/neighborhood-needs/components/need-detail";

interface NeedDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function NeedDetailPage({ params }: NeedDetailPageProps) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/sign-in");

  const { id } = await params;
  const need = await neighborhoodNeedsDAL.getNeedDetail(id);

  if (!need || need.deletedAt) {
    notFound();
  }

  const isOwner = need.createdByUserId === auth.userId;

  // Creator and admins always have access; all others need network visibility.
  if (!isOwner && !auth.isAdmin) {
    const visibleIds = await getCurrentUserVisibleCommunityIds();
    if (!visibleIds.includes(need.communityId)) {
      // Out-of-network: render neutral "not available" rather than a raw 404
      // to avoid leaking need existence for shared links (R1.4, R13.4, R13.5).
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
