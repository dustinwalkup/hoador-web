export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  blindReviewDAL,
  communityDAL,
  serviceListingDAL,
  userDAL,
} from "@/dal";
import { ServiceProviderBioForm } from "@/features/services/components/service-provider-bio-form";
import { formatServiceUsd } from "@/features/services/lib/service-labels";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Service provider",
};

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function ServiceProviderProfilePage({
  params,
}: PageProps) {
  const { userId: targetUserId } = await params;
  const viewerId = await getCurrentUserId();
  if (!viewerId) return null;
  const isSelf = viewerId === targetUserId;

  // Symmetric per-community visibility (R5): a non-self viewer may see a
  // provider's profile only when they share at least one community where both
  // are visible — the precondition for any of the provider's listings to be
  // visible to them. Listings shown are then scoped to that shared set.
  let sharedVisibleCommunityIds: Set<string> | null = null; // null = self (no filter)
  if (!isSelf) {
    const [viewerVisible, providerVisible] = await Promise.all([
      communityDAL.getVisibleCommunityIds(viewerId),
      communityDAL.getVisibleCommunityIds(targetUserId),
    ]);
    const providerSet = new Set(providerVisible);
    sharedVisibleCommunityIds = new Set(
      viewerVisible.filter((c) => providerSet.has(c)),
    );
    if (sharedVisibleCommunityIds.size === 0) {
      notFound();
    }
  }

  let profileUser;
  try {
    profileUser = await userDAL.getUserById(targetUserId);
  } catch {
    notFound();
  }

  const [allListings, aggregate] = await Promise.all([
    serviceListingDAL.findByProvider(targetUserId),
    blindReviewDAL.getAggregate(targetUserId),
  ]);

  const activeListings = allListings.filter(
    (l) =>
      l.status === "active" &&
      (sharedVisibleCommunityIds === null ||
        sharedVisibleCommunityIds.has(l.communityId)),
  );
  const name =
    [profileUser.firstName, profileUser.lastName].filter(Boolean).join(" ") ||
    "Member";
  const rating = aggregate.totalReviews > 0 ? aggregate.averageRating : null;

  return (
    <div className="container max-w-3xl pb-10">
      <PageHeader title={name} description="Service provider" />

      <div className="mb-8 flex flex-wrap items-start gap-6">
        <Avatar className="size-20">
          <AvatarImage src={profileUser.profileImageUrl ?? undefined} alt="" />
          <AvatarFallback>
            {(profileUser.firstName?.[0] ?? "") +
              (profileUser.lastName?.[0] ?? "")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-muted-foreground text-sm">
            Member since{" "}
            {profileUser.createdAt instanceof Date
              ? profileUser.createdAt.toLocaleDateString()
              : String(profileUser.createdAt)}
          </p>
          {rating != null && Number.isFinite(rating) && rating > 0 ? (
            <p className="text-sm">
              ★ {rating.toFixed(1)} ({aggregate.totalReviews} review
              {aggregate.totalReviews !== 1 ? "s" : ""})
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">New provider</p>
          )}
          {isSelf ? (
            <ServiceProviderBioForm
              userId={targetUserId}
              initialBio={profileUser.bio ?? ""}
            />
          ) : (
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {profileUser.bio || "No bio yet."}
            </p>
          )}
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-semibold">Active listings</h2>
        {activeListings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active listings.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {activeListings.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/dashboard/services/listings/${l.id}`}
                  className="bg-card hover:border-primary/40 block rounded-lg border p-4 transition-colors"
                >
                  <p className="font-medium">{l.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {l.pricingType === "hourly"
                      ? `${formatServiceUsd(l.price)}/hr`
                      : formatServiceUsd(l.price)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* TODO: Re-enable reviews section once service reviews are ready */}
    </div>
  );
}
