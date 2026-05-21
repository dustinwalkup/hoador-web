import type { RentalDetails } from "@/dal/rentals.dal";
import type { DisputeWithRelations } from "@/dal/types";
import {
  RentalListingInfo,
  RentalDetailsCard,
  RentalMessagesCard,
  RentalUserInfo,
  RentalActions,
  RentalProtection,
} from "@/features/rentals/components/detail-page";
import { RentalStatusProgress } from "./rental-status-progress";
import { BookingReviewsSection } from "@/features/reviews/components/booking-reviews-section";
import type { OnboardingStatus } from "@/features/payments/lib/payout-readiness";

interface RentalContentProps {
  rentalDetails: RentalDetails;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
  rentalAgreementUrl?: string;
  disputePolicyUrl?: string;
  activeDispute?: DisputeWithRelations | null;
  canReview?: boolean;
  ownerOnboardingStatus?: OnboardingStatus;
}

export function RentalContent({
  rentalDetails,
  viewContext,
  isRenter,
  isOwner,
  rentalAgreementUrl,
  disputePolicyUrl,
  activeDispute,
  canReview,
  ownerOnboardingStatus,
}: RentalContentProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Main Content */}
      <div className="space-y-6 lg:col-span-2">
        <RentalStatusProgress
          rentalId={rentalDetails.id}
          currentStatus={rentalDetails.status}
          userRole={isRenter ? "renter" : "owner"}
          deliveryRequested={rentalDetails.deliveryRequested}
          startDate={rentalDetails.startDate}
          endDate={rentalDetails.endDate}
          createdAt={rentalDetails.createdAt}
          approvedAt={rentalDetails.approvedAt}
          deniedAt={rentalDetails.deniedAt}
          denialReason={rentalDetails.denialReason}
          actualStartDate={rentalDetails.actualStartDate}
          actualEndDate={rentalDetails.actualEndDate}
          paymentStatus={rentalDetails.paymentStatus}
          paymentFailureReason={rentalDetails.paymentFailureReason}
          depositHoldStatus={rentalDetails.depositHoldStatus}
          pickupInstructions={rentalDetails.pickupInstructions}
          returnInstructions={rentalDetails.returnInstructions}
          activeDispute={activeDispute}
        />
        <RentalListingInfo rentalDetails={rentalDetails} />
        <RentalDetailsCard rentalDetails={rentalDetails} />
        <RentalMessagesCard
          rentalDetails={rentalDetails}
          isRenter={isRenter}
          isOwner={isOwner}
        />
        <BookingReviewsSection
          key={`reviews-${canReview}`}
          rentalId={rentalDetails.id}
          bookingStatus={rentalDetails.status}
        />
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <RentalUserInfo
          rentalDetails={rentalDetails}
          isRenter={isRenter}
          isOwner={isOwner}
        />
        <RentalActions
          rentalDetails={rentalDetails}
          viewContext={viewContext}
          isRenter={isRenter}
          isOwner={isOwner}
          rentalAgreementUrl={rentalAgreementUrl}
          disputePolicyUrl={disputePolicyUrl}
          activeDispute={activeDispute}
          canReview={canReview}
          ownerOnboardingStatus={ownerOnboardingStatus}
        />
        <RentalProtection />
      </div>
    </div>
  );
}
