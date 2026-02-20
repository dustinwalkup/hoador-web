import type { RentalDetails } from "@/dal/rentals.dal";
import { PushPermissionPromptFromUrl } from "@/features/rentals/components/detail-page/push-permission-prompt-from-url";
import { RentalHeader } from "./rental-header";

interface RentalLayoutProps {
  rentalDetails: RentalDetails;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
  firstApproval?: boolean;
  children: React.ReactNode;
}

export function RentalLayout({
  rentalDetails,
  viewContext,
  isRenter,
  isOwner,
  firstApproval,
  children,
}: RentalLayoutProps) {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto">
        <RentalHeader
          rentalDetails={rentalDetails}
          viewContext={viewContext}
          isRenter={isRenter}
          isOwner={isOwner}
        />
        {children}
      </div>
      {isRenter && firstApproval && (
        <PushPermissionPromptFromUrl rentalId={rentalDetails.id} />
      )}
    </div>
  );
}
