"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useRentingRequests,
  useRentingActive,
  useRentingCompleted,
  useLendingIncoming,
  useLendingRejected,
  useLendingActive,
  useLendingCompleted,
} from "@/features/rentals/hooks/use-rentals";
import { RentingRequestsListWrapper } from "@/features/rentals/components/renting-lending/renting-requests-list-wrapper";
import { LendingRequestsListWrapper } from "@/features/rentals/components/renting-lending/lending-requests-list-wrapper";
import { BorrowedListingsListWrapper } from "@/features/rentals/components/renting-lending/borrowed-listings-list-wrapper";
import type {
  RentalRequestItem,
  LendingRequestItem,
  BorrowedListing,
} from "@/dal/rentals.dal";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RentalsClientProps {
  initialType: "renting" | "lending";
  initialStatus: string;
}

export function RentalsClient({
  initialType,
  initialStatus,
}: RentalsClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  // State for current tab
  const [currentTab, setCurrentTab] = useState(
    `${initialType}-${initialStatus}`,
  );

  // Parse current tab
  const [activeType, activeStatus] = currentTab.split("-") as [
    "renting" | "lending",
    string,
  ];

  // Data fetching hooks - only fetch what we need based on current tab
  const rentingRequests = useRentingRequests("pending");
  const rentingRejected = useRentingRequests("rejected");
  const rentingActive = useRentingActive();
  const rentingCompleted = useRentingCompleted();

  const lendingIncoming = useLendingIncoming();
  const lendingRejected = useLendingRejected();
  const lendingActive = useLendingActive();
  const lendingCompleted = useLendingCompleted();

  // Get current query based on active tab
  const getCurrentQuery = () => {
    switch (currentTab) {
      case "renting-requests":
        return rentingRequests;
      case "renting-rejected":
        return rentingRejected;
      case "renting-active":
        return rentingActive;
      case "renting-completed":
        return rentingCompleted;
      case "lending-incoming":
        return lendingIncoming;
      case "lending-rejected":
        return lendingRejected;
      case "lending-active":
        return lendingActive;
      case "lending-completed":
        return lendingCompleted;
      default:
        return rentingRequests;
    }
  };

  const currentQuery = getCurrentQuery();

  // Handle tab changes with URL updates
  const handleTabChange = (newTab: string) => {
    setCurrentTab(newTab);

    // Update URL to match the tab
    const [type, status] = newTab.split("-");
    const newPath = `/dashboard/${type}/${status}`;
    router.push(newPath);
  };

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    const pathParts = pathname.split("/");
    if (pathParts.length >= 4) {
      const type = pathParts[2];
      const status = pathParts[3];
      const expectedTab = `${type}-${status}`;
      if (expectedTab !== currentTab) {
        setCurrentTab(expectedTab);
      }
    }
  }, [pathname, currentTab]);

  const renderContent = () => {
    if (currentQuery.isLoading) {
      return <RentalsLoadingSkeleton />;
    }

    if (currentQuery.error) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="mb-4 h-8 w-8 text-red-500" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            Failed to load rentals
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            {currentQuery.error.message}
          </p>
          <Button onClick={() => currentQuery.refetch()}>Try Again</Button>
        </div>
      );
    }

    const data = currentQuery.data || [];

    // Render appropriate component based on tab
    if (activeType === "renting") {
      if (activeStatus === "requests" || activeStatus === "rejected") {
        return (
          <RentingRequestsListWrapper
            data={data as RentalRequestItem[]}
            emptyStateMessage={
              activeStatus === "requests"
                ? "No pending requests."
                : "No rejected requests."
            }
            emptyStateAction={
              activeStatus === "requests"
                ? { label: "Browse Listings", href: "/explore" }
                : undefined
            }
          />
        );
      } else {
        return (
          <BorrowedListingsListWrapper
            data={data as BorrowedListing[]}
            currentTab={activeStatus}
            emptyStateMessage={`No ${activeStatus} rentals.`}
          />
        );
      }
    } else {
      // Lending
      return (
        <LendingRequestsListWrapper
          data={data as LendingRequestItem[]}
          emptyStateMessage={
            activeStatus === "incoming"
              ? "No incoming requests."
              : `No ${activeStatus} requests.`
          }
        />
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Secondary tabs (Status within type) */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="mb-6 grid w-full min-w-max grid-cols-2 gap-1 sm:grid-cols-4">
            {activeType === "renting" ? (
              <>
                <TabsTrigger value="renting-requests">Requests</TabsTrigger>
                <TabsTrigger value="renting-active">Active</TabsTrigger>
                <TabsTrigger value="renting-completed">Completed</TabsTrigger>
                <TabsTrigger value="renting-rejected">Rejected</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="lending-incoming">Incoming</TabsTrigger>
                <TabsTrigger value="lending-active">Active</TabsTrigger>
                <TabsTrigger value="lending-completed">Completed</TabsTrigger>
                <TabsTrigger value="lending-rejected">Rejected</TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <TabsContent value={currentTab}>{renderContent()}</TabsContent>
      </Tabs>
    </div>
  );
}

function RentalsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
