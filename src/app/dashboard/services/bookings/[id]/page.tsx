export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import {
  disputeDAL,
  legalDocumentDAL,
  serviceAgreementDocumentDAL,
  serviceBookingDAL,
  userDAL,
} from "@/dal";
import type { ServiceBookingWithDetails } from "@/dal/service-booking.dal";
import {
  ServiceBookingDetailClient,
  type ServiceBookingPayload,
} from "@/features/services/components/service-booking-detail-client";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { BlindReviewService } from "@/features/reviews/services/blind-review-service";
import {
  getPayoutReadiness,
  type OnboardingStatus,
} from "@/features/payments/lib/payout-readiness";

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

function serializeBooking(b: ServiceBookingWithDetails): ServiceBookingPayload {
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

  const [
    cancellationRefund,
    disputePolicy,
    activeDispute,
    reviewStatus,
    serviceAgreementDoc,
  ] = await Promise.all([
    legalDocumentDAL.getCurrentVersion(LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND),
    legalDocumentDAL.getCurrentVersion(LEGAL_DOCUMENT_IDS.DISPUTE_POLICY),
    disputeDAL.getActiveByServiceBookingId(id),
    booking.status === "completed"
      ? BlindReviewService.getReviewStatus(userId, { serviceBookingId: id })
      : Promise.resolve(null),
    serviceAgreementDocumentDAL.getByServiceBookingId(id),
  ]);

  // When the current user is the provider on a pending booking, fetch their
  // payout readiness so the Accept button can pre-empt the accept dialog with
  // a JIT onboarding prompt when Stripe Connect isn't verified.
  const isProvider = booking.providerId === userId;
  let providerOnboardingStatus: OnboardingStatus | undefined;
  if (
    isProvider &&
    (booking.status === "pending" || booking.status === "payment_failed")
  ) {
    try {
      const providerUser = await userDAL.getUserById(userId);
      providerOnboardingStatus =
        getPayoutReadiness(providerUser).onboardingStatus;
    } catch {
      // Non-critical — fall back to the existing 403 redirect path.
    }
  }

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
          cancellationPolicyUrl={cancellationRefund?.url}
          disputePolicyUrl={disputePolicy?.url}
          serviceAgreementUrl={serviceAgreementDoc?.pdfUrl}
          hasActiveDispute={Boolean(activeDispute)}
          canReview={reviewStatus?.canReview ?? false}
          providerOnboardingStatus={providerOnboardingStatus}
        />
      </Suspense>
    </div>
  );
}
