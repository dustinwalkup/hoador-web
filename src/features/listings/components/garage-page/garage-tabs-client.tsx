"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGarageFilters } from "@/features/listings/hooks/use-garage";

import { ActiveListings } from "./active-listings";
import { InactiveListings } from "./inactive-listings";
// import { ArchivedListings } from "./archived-listings";
import { GarageFiltersClient } from "./garage-filters-client";

interface GarageTabsClientProps {
  currentTab: string;
}

export function GarageTabsClient({ currentTab }: GarageTabsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters } = useGarageFilters();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value === "active") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }

    // Clear rental status filter when switching to inactive or archived tabs
    if (value !== "active" && filters.rentalStatus) {
      params.delete("rentalStatus");
    }

    router.replace(`/dashboard/garage?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="mb-6">
      <TabsList className="max-w-48">
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="inactive">Inactive</TabsTrigger>
        {/* <TabsTrigger value="archived">Archived</TabsTrigger> */}
      </TabsList>

      <GarageFiltersClient currentTab={currentTab} />

      <TabsContent value="active" className="mt-6">
        <ActiveListings filters={filters} />
      </TabsContent>

      <TabsContent value="inactive" className="mt-6">
        <InactiveListings filters={filters} />
      </TabsContent>

      {/* <TabsContent value="archived" className="mt-6">
        <ArchivedListings filters={filters} />
      </TabsContent> */}
    </Tabs>
  );
}
