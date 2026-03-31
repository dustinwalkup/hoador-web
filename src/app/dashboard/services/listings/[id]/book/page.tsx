export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { communityDAL, legalDocumentDAL, serviceListingDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { listStripeCardPaymentMethodsForUser } from "@/services/stripe/payment-method";
import { ServiceBookingFlow } from "@/features/services/components/service-booking-flow";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Book service",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookServicePage({ params }: PageProps) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const listing = await serviceListingDAL.getById(id);
  if (!listing) notFound();

  const membership = await communityDAL.getMembershipForUser(userId);
  if (!membership || listing.communityId !== membership.community.id) {
    notFound();
  }

  if (listing.providerId === userId) {
    return (
      <div className="container max-w-lg pb-10">
        <PageHeader title="Book service" description={listing.title} />
        <p className="text-muted-foreground mb-4 text-sm">
          You cannot book your own listing.
        </p>
        <Button asChild variant="outline">
          <Link href={`/dashboard/services/listings/${listing.id}`}>
            Back to listing
          </Link>
        </Button>
      </div>
    );
  }

  if (listing.status !== "active") {
    notFound();
  }

  const [
    serviceAgreement,
    cancellationRefund,
    safetyLiabilityPackage,
    paymentPayout,
    platformTerms,
  ] = await Promise.all([
    legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.PER_SERVICE_AGREEMENT,
    ),
    legalDocumentDAL.getCurrentVersion(LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND),
    legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
    ),
    legalDocumentDAL.getCurrentVersion(LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS),
    legalDocumentDAL.getCurrentVersion(LEGAL_DOCUMENT_IDS.TOS),
  ]);

  const paymentMethods = await listStripeCardPaymentMethodsForUser(userId);
  if (paymentMethods.length === 0) {
    return (
      <div className="container max-w-lg pb-10">
        <PageHeader
          title="Payment method required"
          description={listing.title}
        />
        <p className="text-muted-foreground mb-4 text-sm">
          Add a default payment method before requesting a booking.
        </p>
        <Button asChild>
          <Link href="/dashboard/payments">Payments</Link>
        </Button>
      </div>
    );
  }

  return (
    <main className="bg-muted/30 min-h-screen py-8">
      <div className="mx-auto max-w-2xl px-4">
        {/* Back Link */}
        <Link
          href={`/dashboard/services/listings/${listing.id}`}
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listing
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-foreground text-2xl font-semibold">
            Book Service
          </h1>
          <p className="text-muted-foreground mt-1">
            {listing.title} with {listing.provider.firstName}{" "}
            {listing.provider.lastName}
          </p>
        </div>

        {/* Booking Flow */}
        <ServiceBookingFlow
          listing={{
            id: listing.id,
            title: listing.title,
            price: Number.parseFloat(String(listing.price)),
            pricingType: listing.pricingType,
            provider: {
              firstName: listing.provider.firstName ?? "",
              lastName: listing.provider.lastName ?? "",
              profileImageUrl: listing.provider.profileImageUrl,
            },
          }}
          paymentMethods={paymentMethods}
          priceInCents={false}
          addPaymentMethodHref="/dashboard/payments"
          bookingSuccessHref="/dashboard/services/bookings"
          legalDocuments={{
            serviceAgreement: serviceAgreement ?? undefined,
            cancellationRefund: cancellationRefund ?? undefined,
            safetyLiabilityPackage: safetyLiabilityPackage ?? undefined,
            paymentPayout: paymentPayout ?? undefined,
            platformTerms: platformTerms ?? undefined,
          }}
        />
      </div>
    </main>
  );
}
