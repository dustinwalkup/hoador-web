import { notFound } from "next/navigation";
import { rentalDAL } from "@/dal";
import { RentalLayout } from "./rental-layout";
import { RentalContent } from "./rental-content";

interface RentalDetailsServerProps {
  rentalId: string;
  view?: string;
}

export async function RentalDetailsServer({
  rentalId,
  view,
}: RentalDetailsServerProps) {
  const rentalDetails = await rentalDAL.getRentalDetailsById(rentalId);

  if (!rentalDetails) {
    notFound();
  }

  const isRenter = rentalDetails.currentUserId === rentalDetails.renterId;
  const isOwner = rentalDetails.currentUserId === rentalDetails.ownerId;

  // Determine the view context
  let viewContext: "renting" | "lending" | "auto" = "auto";

  if (view === "renting") {
    viewContext = "renting";
  } else if (view === "lending") {
    viewContext = "lending";
  } else {
    // Auto-detect based on user role
    viewContext = isRenter ? "renting" : "lending";
  }

  return (
    <RentalLayout
      rentalDetails={rentalDetails}
      viewContext={viewContext}
      isRenter={isRenter}
      isOwner={isOwner}
    >
      <RentalContent
        rentalDetails={rentalDetails}
        viewContext={viewContext}
        isRenter={isRenter}
        isOwner={isOwner}
      />
    </RentalLayout>
  );
}
