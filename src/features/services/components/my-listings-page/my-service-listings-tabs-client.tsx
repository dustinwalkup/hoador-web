"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { ServiceListingCategoryInfo } from "@/dal/service-listing.dal";
import {
  useMyDeniedServiceListingsCount,
  useMyPendingServiceListingsCount,
} from "@/features/services/hooks/use-service-listings";

import type { ServiceListingFilters } from "./active-service-listings";
import { ActiveServiceListings } from "./active-service-listings";
import { InactiveServiceListings } from "./inactive-service-listings";
import { PendingServiceListings } from "./pending-service-listings";
import { MyServiceListingsFiltersClient } from "./my-service-listings-filters-client";

interface MyServiceListingsTabsClientProps {
  currentTab: string;
  categories: ServiceListingCategoryInfo[];
}

export function MyServiceListingsTabsClient({
  currentTab,
  categories,
}: MyServiceListingsTabsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: pendingCount = 0 } = useMyPendingServiceListingsCount();
  const { data: deniedCount = 0 } = useMyDeniedServiceListingsCount();

  const [filters, setFilters] = useState<ServiceListingFilters>({});

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value === "active") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }

    router.replace(`/dashboard/listings/services?${params.toString()}`, {
      scroll: false,
    });
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="mb-6">
      <TabsList className="max-w-96">
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="inactive">Inactive</TabsTrigger>
        <TabsTrigger value="pending_review" className="gap-1.5">
          Pending Review
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex shrink-0"
                  aria-label="About the review process"
                >
                  <Info className="text-muted-foreground h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left">
                <p>
                  New listings are reviewed before they go live. You will be
                  notified when yours is approved or if changes are needed.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs font-medium text-white">
              {pendingCount}
            </span>
          )}
          {deniedCount > 0 && (
            <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white">
              {deniedCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <MyServiceListingsFiltersClient
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <TabsContent value="active" className="mt-6">
        <ActiveServiceListings filters={filters} />
      </TabsContent>

      <TabsContent value="inactive" className="mt-6">
        <InactiveServiceListings filters={filters} />
      </TabsContent>

      <TabsContent value="pending_review" className="mt-6">
        <PendingServiceListings filters={filters} />
      </TabsContent>
    </Tabs>
  );
}
