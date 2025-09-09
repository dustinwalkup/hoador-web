"use client";

import { notFound } from "next/navigation";
import { useRentalDetails } from "@/features/rentals/hooks/use-rentals";
import { RentalLayout } from "@/features/rentals/components/detail-page/rental-layout";
import { RentalContent } from "@/features/rentals/components/detail-page/rental-content";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RentalDetailsClientProps {
  rentalId: string;
  view?: string;
}

export function RentalDetailsClient({
  rentalId,
  view,
}: RentalDetailsClientProps) {
  const {
    data: rentalDetails,
    isLoading,
    error,
    refetch,
  } = useRentalDetails(rentalId);

  if (isLoading) {
    return <RentalDetailsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <AlertCircle className="mb-4 h-8 w-8 text-red-500" />
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          Failed to load rental details
        </h3>
        <p className="mb-4 text-sm text-gray-600">{error.message}</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

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

function RentalDetailsSkeleton() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Skeleton className="h-20 w-20 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Status badge */}
        <Skeleton className="h-8 w-32" />

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}
