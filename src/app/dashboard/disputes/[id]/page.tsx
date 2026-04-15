import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { disputeDAL, rentalDAL, serviceBookingDAL } from "@/dal";
import { DisputeDetails } from "@/features/disputes/components/dispute-details";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Dispute Details",
  description: "View dispute details and evidence",
};

interface DisputeDetailsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Dispute details page
 * Server component that handles authentication, authorization, and renders the client details component
 */
export default async function DisputeDetailsPage({
  params,
}: DisputeDetailsPageProps) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    redirect("/sign-in");
  }

  const { userId, isAdmin } = auth;
  const { id } = await params;

  // Get dispute with all relations
  const dispute = await disputeDAL.getById(id);

  if (!dispute) {
    notFound();
  }

  // Verify user has access (rental/service participant, or admin)
  if (!isAdmin) {
    if (dispute.serviceBookingId) {
      const detail = await serviceBookingDAL.getById(dispute.serviceBookingId);
      if (
        !detail ||
        (detail.requesterId !== userId && detail.providerId !== userId)
      ) {
        notFound();
      }
    } else if (dispute.rentalId) {
      const rental = await rentalDAL.getRentalDetailsById(
        dispute.rentalId,
        userId,
      );

      if (!rental) {
        notFound();
      }

      const isRenter = rental.renterId === userId;
      const isProvider = rental.ownerId === userId;

      if (!isRenter && !isProvider) {
        notFound();
      }
    } else {
      notFound();
    }
  }

  return (
    <div className="container pb-6">
      <div className="mb-4">
        <Link href="/dashboard/disputes">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Disputes
          </Button>
        </Link>
      </div>
      <PageHeader
        title={`Dispute ${dispute.id.slice(0, 8)}`}
        description="View dispute details, evidence, and resolution information"
      />
      <DisputeDetails disputeId={id} isAdmin={isAdmin} />
    </div>
  );
}
