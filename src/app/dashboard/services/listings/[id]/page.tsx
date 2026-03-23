export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  communityDAL,
  serviceListingDAL,
  serviceReviewDAL,
  userDAL,
} from "@/dal";
import { formatServiceUsd } from "@/features/services/lib/service-labels";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Service listing",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ServiceListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const listing = await serviceListingDAL.getById(id);
  if (!listing) {
    notFound();
  }

  const membership = await communityDAL.getMembershipForUser(userId);
  if (!membership) {
    notFound();
  }

  const isProvider = listing.providerId === userId;
  const inCommunity = listing.communityId === membership.community.id;
  const canView = isProvider || (inCommunity && listing.status === "active");

  if (!canView) {
    notFound();
  }

  const [providerProfile, reviews, paymentMethod] = await Promise.all([
    serviceReviewDAL.getProviderProfileByUserId(listing.providerId),
    serviceReviewDAL.findByListing(listing.id),
    userDAL.getStripeCustomerAndDefaultPaymentMethod(userId),
  ]);

  const providerName = [listing.provider.firstName, listing.provider.lastName]
    .filter(Boolean)
    .join(" ");
  const rating =
    providerProfile?.aggregateRating != null
      ? Number.parseFloat(String(providerProfile.aggregateRating))
      : null;
  const photos = Array.isArray(listing.photos)
    ? (listing.photos as string[])
    : [];

  return (
    <div className="container max-w-3xl pb-10">
      <PageHeader title={listing.title} description={listing.category.name} />

      <div className="space-y-8">
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((url) => (
              <div
                key={url}
                className="bg-muted relative aspect-video overflow-hidden rounded-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied URLs */}
                <img src={url} alt="" className="size-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage
                src={listing.provider.profileImageUrl ?? undefined}
                alt=""
              />
              <AvatarFallback>
                {(listing.provider.firstName?.[0] ?? "") +
                  (listing.provider.lastName?.[0] ?? "")}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link
                href={`/dashboard/services/providers/${listing.providerId}`}
                className="font-medium hover:underline"
              >
                {providerName || "Provider"}
              </Link>
              {rating != null && Number.isFinite(rating) && rating > 0 ? (
                <p className="text-muted-foreground text-sm">
                  ★ {rating.toFixed(1)}
                  {providerProfile?.reviewCount != null
                    ? ` (${providerProfile.reviewCount} reviews)`
                    : ""}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">New provider</p>
              )}
            </div>
          </div>
          <div className="text-lg font-semibold">
            {listing.pricingType === "hourly"
              ? `${formatServiceUsd(listing.price)}/hr`
              : formatServiceUsd(listing.price)}{" "}
            <span className="text-muted-foreground text-base font-normal">
              · {listing.pricingType === "hourly" ? "Hourly" : "Fixed price"}
            </span>
          </div>
        </div>

        <section>
          <h2 className="mb-2 font-semibold">About</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {listing.description}
          </p>
        </section>

        {listing.serviceNotes ? (
          <section>
            <h2 className="mb-2 font-semibold">Service notes</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {listing.serviceNotes}
            </p>
          </section>
        ) : null}

        <Separator />

        <section>
          <h2 className="mb-3 font-semibold">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reviews yet.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {r.reviewer.firstName} {r.reviewer.lastName}
                    </span>
                    <span className="text-sm">★ {r.rating}</span>
                  </div>
                  {r.comment ? (
                    <p className="text-muted-foreground text-sm">{r.comment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        {isProvider ? (
          <div className="flex flex-wrap gap-2">
            <p className="text-muted-foreground w-full text-sm">
              This is your listing.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/services/listings/${listing.id}/edit`}>
                Edit listing
              </Link>
            </Button>
          </div>
        ) : listing.status !== "active" ? (
          <p className="text-muted-foreground text-sm">
            This listing is not accepting bookings.
          </p>
        ) : !paymentMethod ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-100">
              Add a payment method to request this service
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/payments">Go to Payments</Link>
            </Button>
          </div>
        ) : (
          <Button asChild size="lg">
            <Link href={`/dashboard/services/listings/${listing.id}/book`}>
              Request booking
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
