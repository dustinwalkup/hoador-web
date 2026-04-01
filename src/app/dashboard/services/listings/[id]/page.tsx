export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { communityDAL, serviceListingDAL, serviceReviewDAL } from "@/dal";
import { formatServiceUsd } from "@/features/services/lib/service-labels";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { getStripeCustomerContext } from "@/services/stripe/payment-method";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Star } from "lucide-react";

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
    getStripeCustomerContext(userId),
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

  const initials =
    (listing.provider.firstName?.[0] ?? "") +
    (listing.provider.lastName?.[0] ?? "");

  const hasValidRating =
    rating != null && Number.isFinite(rating) && rating > 0;

  const hasPaymentMethod = Boolean(paymentMethod);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <div className="space-y-8">
        {/* Header Section */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              {listing.category.name}
            </Badge>
            {listing.status !== "active" && (
              <Badge variant="outline" className="text-xs">
                {listing.status}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {listing.title}
          </h1>
        </header>

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((url, index) => (
              <div
                key={url}
                className={`bg-muted relative aspect-4/3 overflow-hidden rounded-lg ${
                  index === 0 && photos.length > 2
                    ? "col-span-2 row-span-2 aspect-square sm:aspect-4/3"
                    : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${listing.title} photo ${index + 1}`}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </div>
            ))}
          </div>
        )}

        {/* Provider Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/dashboard/services/providers/${listing.providerId}`}
                className="group flex items-center gap-4"
              >
                <Avatar className="border-background h-14 w-14 shrink-0 border-2 shadow-sm">
                  <AvatarImage
                    src={listing.provider.profileImageUrl ?? undefined}
                    alt={providerName}
                  />
                  <AvatarFallback className="bg-muted text-sm font-medium">
                    {initials || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-foreground font-medium group-hover:underline">
                    {providerName || "Provider"}
                  </p>
                  {hasValidRating ? (
                    <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-foreground font-medium">
                        {rating.toFixed(1)}
                      </span>
                      {providerProfile?.reviewCount != null && (
                        <span>({providerProfile.reviewCount} reviews)</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      New provider
                    </p>
                  )}
                </div>
              </Link>

              {/* Price Display */}
              <div className="bg-muted/50 flex items-baseline gap-1 rounded-lg px-4 py-3 sm:text-right">
                <span className="text-2xl font-semibold tracking-tight">
                  {formatServiceUsd(listing.price)}
                </span>
                {listing.pricingType === "hourly" && (
                  <span className="text-muted-foreground">/hr</span>
                )}
                <div className="text-muted-foreground ml-3 flex items-center gap-1 text-sm">
                  {listing.pricingType === "fixed" && <span>Flat rate</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About Section */}
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            About this service
          </h2>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
            {listing.description}
          </p>
        </section>

        {/* Service Notes */}
        {listing.serviceNotes && (
          <section className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              Service notes
            </h2>
            <div className="bg-muted/30 rounded-lg border p-4">
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {listing.serviceNotes}
              </p>
            </div>
          </section>
        )}

        <Separator />

        {/* Reviews Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              Reviews
            </h2>
            {reviews.length > 0 && (
              <span className="text-muted-foreground text-sm">
                {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No reviews yet. Be the first to book this service!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <Card key={review.id} className="shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="bg-muted text-xs">
                            {(review.reviewer.firstName?.[0] ?? "") +
                              (review.reviewer.lastName?.[0] ?? "")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {review.reviewer.firstName}{" "}
                            {review.reviewer.lastName}
                          </p>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < review.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-muted text-muted"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Action Section */}
        <section className="pb-4">
          {isProvider ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild>
                <Link href={`/dashboard/services/listings/${listing.id}/edit`}>
                  Edit listing
                </Link>
              </Button>
            </div>
          ) : listing.status !== "active" ? (
            <div className="rounded-lg border border-dashed py-6 text-center">
              <p className="text-muted-foreground text-sm">
                This listing is not accepting bookings at this time.
              </p>
            </div>
          ) : !hasPaymentMethod ? (
            <div className="flex flex-row items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:items-center dark:border-amber-900 dark:bg-amber-950/30">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex w-full flex-col items-end sm:flex-row sm:justify-between">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Add a payment method to request this servicessss
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/payments">Go to Payments</Link>
                </Button>
              </div>
            </div>
          ) : (
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href={`/dashboard/services/listings/${listing.id}/book`}>
                Request booking
              </Link>
            </Button>
          )}
        </section>
      </div>
    </main>
  );
}
