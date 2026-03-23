export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { communityDAL, serviceListingDAL, userDAL } from "@/dal";
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

  const pm = await userDAL.getStripeCustomerAndDefaultPaymentMethod(userId);
  if (!pm) {
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
    <div className="container max-w-lg pb-10">
      <PageHeader title="Request booking" description={listing.title} />
      <ServiceBookingFlow
        listingId={listing.id}
        listing={{
          pricingType: listing.pricingType,
          price: listing.price,
          title: listing.title,
        }}
      />
    </div>
  );
}
