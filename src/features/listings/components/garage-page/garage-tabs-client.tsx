"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGarageFilters } from "@/features/listings/hooks/use-garage";

import { ActiveListings } from "./active-listings";
import { InactiveListings } from "./inactive-listings";
// import { ArchivedListings } from "./archived-listings";
import { GarageFiltersClient } from "./garage-filters-client";
import { PendingReviewListings } from "./pending-review-listings";
import { usePendingListingsCount } from "@/features/listings/hooks/use-garage";

interface GarageTabsClientProps {
  currentTab: string;
}

export function GarageTabsClient({ currentTab }: GarageTabsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters } = useGarageFilters();
  const { data: pendingCount = 0 } = usePendingListingsCount();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value === "active") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }

    // Clear rental status filter when switching to inactive, archived, or pending_review tabs
    if (value !== "active" && filters.rentalStatus) {
      params.delete("rentalStatus");
    }

    router.replace(`/dashboard/garage?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="mb-6">
      <TabsList className="max-w-96">
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="inactive">Inactive</TabsTrigger>
        <TabsTrigger value="pending_review">
          Pending Review
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs font-medium text-white">
              {pendingCount}
            </span>
          )}
        </TabsTrigger>
        {/* <TabsTrigger value="archived">Archived</TabsTrigger> */}
      </TabsList>

      <GarageFiltersClient currentTab={currentTab} />

      <TabsContent value="active" className="mt-6">
        <ActiveListings filters={filters} />
      </TabsContent>

      <TabsContent value="inactive" className="mt-6">
        <InactiveListings filters={filters} />
      </TabsContent>

      <TabsContent value="pending_review" className="mt-6">
        <PendingReviewListings />
      </TabsContent>

      {/* <TabsContent value="archived" className="mt-6">
        <ArchivedListings filters={filters} />
      </TabsContent> */}
    </Tabs>
  );
}
