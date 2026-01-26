import type { RentalDetails } from "@/dal/rentals.dal";
import type { DisputeWithRelations } from "@/dal/types";
import {
  RentalStatusCard,
  RentalListingInfo,
  RentalDetailsCard,
  RentalMessagesCard,
  RentalReviewsCard,
  RentalUserInfo,
  RentalActions,
  RentalProtection,
} from "@/features/rentals/components/detail-page";

interface RentalContentProps {
  rentalDetails: RentalDetails;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
  rentalAgreementUrl?: string;
  reviewPolicyUrl?: string;
  activeDispute?: DisputeWithRelations | null;
}

export function RentalContent({
  rentalDetails,
  viewContext,
  isRenter,
  isOwner,
  rentalAgreementUrl,
  reviewPolicyUrl,
  activeDispute,
}: RentalContentProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Main Content */}
      <div className="space-y-6 lg:col-span-2">
        <RentalStatusCard
          rentalDetails={rentalDetails}
          activeDispute={activeDispute}
        />
        <RentalListingInfo rentalDetails={rentalDetails} />
        <RentalDetailsCard rentalDetails={rentalDetails} />
        <RentalMessagesCard
          rentalDetails={rentalDetails}
          isRenter={isRenter}
          isOwner={isOwner}
        />
        {rentalDetails.status === "completed" && (
          <RentalReviewsCard
            rentalDetails={rentalDetails}
            isRenter={isRenter}
            isOwner={isOwner}
            reviewPolicyUrl={reviewPolicyUrl}
          />
        )}
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
          reviewPolicyUrl={reviewPolicyUrl}
          activeDispute={activeDispute}
        />
        <RentalProtection />
      </div>
    </div>
  );
}
