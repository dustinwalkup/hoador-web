import { notFound } from "next/navigation";
import { rentalDAL } from "@/dal";
import { RentalLayout } from "./_components/rental-layout";
import { RentalContent } from "./_components/rental-content";

interface RentalDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function RentalDetailPage({
  params,
  searchParams,
}: RentalDetailPageProps) {
  const { id } = await params;
  const { view } = await searchParams;

  // Get rental details directly from DAL
  const rentalDetails = await rentalDAL.getRentalDetailsById(id);

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
