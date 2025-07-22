import type { RentalDetails } from "@/lib/dal/rentals.dal";
import { RentalStatusCard } from "./rental-status-card";
import { RentalToolInfo } from "./rental-tool-info";
import { RentalDetailsCard } from "./rental-details-card";
import { RentalMessagesCard } from "./rental-messages-card";
import { RentalReviewsCard } from "./rental-reviews-card";
import { RentalUserInfo } from "./rental-user-info";
import { RentalActions } from "./rental-actions";
import { RentalProtection } from "./rental-protection";

interface RentalContentProps {
  rentalDetails: RentalDetails;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
}

export function RentalContent({
  rentalDetails,
  viewContext,
  isRenter,
  isOwner,
}: RentalContentProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Main Content */}
      <div className="space-y-6 lg:col-span-2">
        <RentalStatusCard rentalDetails={rentalDetails} />
        <RentalToolInfo rentalDetails={rentalDetails} />
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
        />
        <RentalProtection />
      </div>
    </div>
  );
}
