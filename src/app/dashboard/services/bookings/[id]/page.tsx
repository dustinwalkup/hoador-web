export const dynamic = "force-dynamic";

import { Suspense, type ComponentProps } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { serviceBookingDAL, serviceReviewDAL } from "@/dal";
import type { ServiceBookingWithDetails } from "@/dal/service-booking.dal";
import { ServiceBookingDetailClient } from "@/features/services/components/service-booking-detail-client";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Booking details",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function serializeBooking(
  b: ServiceBookingWithDetails,
): ComponentProps<typeof ServiceBookingDetailClient>["booking"] {
  const pd = b.proposedDate as unknown;
  const proposedDateStr =
    pd instanceof Date ? pd.toISOString().slice(0, 10) : String(pd ?? "");

  const completedAt =
    b.completedAt instanceof Date
      ? b.completedAt.toISOString()
      : b.completedAt
        ? String(b.completedAt)
        : null;
  const cancelledAt =
    b.cancelledAt instanceof Date
      ? b.cancelledAt.toISOString()
      : b.cancelledAt
        ? String(b.cancelledAt)
        : null;

  return {
    ...b,
    proposedDate: proposedDateStr,
    completedAt,
    cancelledAt,
    createdAt:
      b.createdAt instanceof Date
        ? b.createdAt.toISOString()
        : String(b.createdAt),
    updatedAt:
      b.updatedAt instanceof Date
        ? b.updatedAt.toISOString()
        : String(b.updatedAt),
  };
}

export default async function ServiceBookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const booking = await serviceBookingDAL.getById(id);
  if (!booking) {
    notFound();
  }

  if (booking.requesterId !== userId && booking.providerId !== userId) {
    notFound();
  }

  const reviews = await serviceReviewDAL.findByBooking(id);
  const myReview = reviews.find((r) => r.reviewerId === userId) ?? null;

  const title = booking.listing.title;

  return (
    <div className="container max-w-2xl pb-10">
      <PageHeader title={title} description="Service booking" />
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
      >
        <ServiceBookingDetailClient
          booking={serializeBooking(booking)}
          isRequester={booking.requesterId === userId}
          reviews={reviews}
          myReview={myReview}
        />
      </Suspense>
    </div>
  );
}
