export const dynamic = "force-dynamic";

import { Suspense, type ComponentProps } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { legalDocumentDAL, serviceBookingDAL, serviceReviewDAL } from "@/dal";
import type { ServiceBookingWithDetails } from "@/dal/service-booking.dal";
import type { ServiceReviewWithReviewer } from "@/dal/service-review.dal";
import { ServiceBookingDetailClient } from "@/features/services/components/service-booking-detail-client";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Booking details",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function numericToNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numericToNumberOrNull(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function serializeBooking(
  b: ServiceBookingWithDetails,
): ComponentProps<typeof ServiceBookingDetailClient>["booking"] {
  const { cancellationReason, ...rest } = b;
  const pd = rest.proposedDate as unknown;
  const proposedDateStr =
    pd instanceof Date ? pd.toISOString().slice(0, 10) : String(pd ?? "");

  const completedAt =
    rest.completedAt instanceof Date
      ? rest.completedAt.toISOString()
      : rest.completedAt
        ? String(rest.completedAt)
        : null;
  const cancelledAt =
    rest.cancelledAt instanceof Date
      ? rest.cancelledAt.toISOString()
      : rest.cancelledAt
        ? String(rest.cancelledAt)
        : null;

  return {
    ...rest,
    cancelReason: cancellationReason ?? null,
    proposedDate: proposedDateStr,
    hours: numericToNumberOrNull(rest.hours),
    totalAmount: numericToNumber(rest.totalAmount),
    serviceFee: numericToNumber(rest.serviceFee),
    refundAmount: numericToNumberOrNull(rest.refundAmount),
    listing: {
      ...rest.listing,
      price: numericToNumber(rest.listing.price),
    },
    completedAt,
    cancelledAt,
    createdAt:
      rest.createdAt instanceof Date
        ? rest.createdAt.toISOString()
        : String(rest.createdAt),
    updatedAt:
      rest.updatedAt instanceof Date
        ? rest.updatedAt.toISOString()
        : String(rest.updatedAt),
  };
}

type SerializedReview = ComponentProps<
  typeof ServiceBookingDetailClient
>["reviews"][number];

/**
 * Maps DAL review rows (Date timestamps) to client-safe JSON props (ISO strings).
 */
function serializeReview(r: ServiceReviewWithReviewer): SerializedReview {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    reviewerId: r.reviewerId,
    reviewer: {
      id: r.reviewer.id,
      firstName: r.reviewer.firstName,
      lastName: r.reviewer.lastName,
      profileImageUrl: r.reviewer.profileImageUrl,
    },
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt),
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

  const [reviewsRaw, cancellationRefund] = await Promise.all([
    serviceReviewDAL.findByBooking(id),
    legalDocumentDAL.getCurrentVersion(LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND),
  ]);
  const reviews = reviewsRaw.map(serializeReview);
  const myReview = reviews.find((r) => r.reviewerId === userId) ?? null;

  const title = booking.listing.title;

  return (
    <div className="container pb-10">
      <PageHeader title={title} description="Service booking" />
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
      >
        <ServiceBookingDetailClient
          booking={serializeBooking(booking)}
          isRequester={booking.requesterId === userId}
          reviews={reviews}
          myReview={myReview}
          cancellationPolicyUrl={cancellationRefund?.url}
        />
      </Suspense>
    </div>
  );
}
