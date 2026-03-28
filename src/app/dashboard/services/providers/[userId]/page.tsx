export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  communityDAL,
  serviceListingDAL,
  serviceReviewDAL,
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

  if (viewerId === targetUserId) {
    // Self — allowed
  } else {
    const [viewerMem, targetMem] = await Promise.all([
      communityDAL.getMembershipForUser(viewerId),
      communityDAL.getMembershipForUser(targetUserId),
    ]);
    if (!viewerMem || !targetMem) {
      notFound();
    }
    if (viewerMem.community.id !== targetMem.community.id) {
      notFound();
    }
  }

  let profileUser;
  try {
    profileUser = await userDAL.getUserById(targetUserId);
  } catch {
    notFound();
  }

  const [providerProfile, allListings, reviews] = await Promise.all([
    serviceReviewDAL.getProviderProfileByUserId(targetUserId),
    serviceListingDAL.findByProvider(targetUserId),
    serviceReviewDAL.findByReviewee(targetUserId, { limit: 100 }),
  ]);

  const activeListings = allListings.filter((l) => l.status === "active");
  const name =
    [profileUser.firstName, profileUser.lastName].filter(Boolean).join(" ") ||
    "Member";
  const rating =
    providerProfile?.aggregateRating != null
      ? Number.parseFloat(String(providerProfile.aggregateRating))
      : null;
  const isSelf = viewerId === targetUserId;

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
              ★ {rating.toFixed(1)}
              {providerProfile?.reviewCount != null
                ? ` (${providerProfile.reviewCount} reviews)`
                : ""}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">New provider</p>
          )}
          {isSelf ? (
            <ServiceProviderBioForm
              userId={targetUserId}
              initialBio={providerProfile?.bio ?? ""}
            />
          ) : (
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {providerProfile?.bio || "No bio yet."}
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

      <section>
        <h2 className="mb-3 font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span>
                    {r.reviewer.firstName} {r.reviewer.lastName}
                  </span>
                  <span>★ {r.rating}</span>
                </div>
                {r.comment ? (
                  <p className="text-muted-foreground">{r.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
