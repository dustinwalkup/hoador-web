import type { RentalDetails } from "@/lib/dal/rentals.dal";
import { RentalHeader } from "./rental-header";

interface RentalLayoutProps {
  rentalDetails: RentalDetails;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
  children: React.ReactNode;
}

export function RentalLayout({
  rentalDetails,
  viewContext,
  isRenter,
  isOwner,
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
    </div>
  );
}
