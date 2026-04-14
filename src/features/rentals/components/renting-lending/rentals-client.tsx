"use client";

import { useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useRentingRequests,
  useRentingActive,
  useRentingCompleted,
  useRentingCancelled,
  useLendingIncoming,
  useLendingDenied,
  useLendingActive,
  useLendingCompleted,
  useLendingApproved,
  useLendingCancelled,
} from "@/features/rentals/hooks/use-rentals";
import {
  RentalList,
  LendingRequestsList,
} from "@/features/rentals/components/renting-lending";
import type {
  RentalRequestItem,
  LendingRequestItem,
  BorrowedListing,
} from "@/dal/rentals.dal";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RentalsClientProps {
  initialType: "renting" | "lending";
  initialStatus: string;
  reviewPolicyUrl?: string;
}

const SCROLL_POSITION_KEY = "rentals-filter-scroll-position";

export function RentalsClient({
  initialType,
  initialStatus,
  reviewPolicyUrl,
}: RentalsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Derive active type and status from URL pathname (supports browser back/forward)
  // URL: /dashboard/rentals/incoming/requests or /dashboard/rentals/outgoing/requests
  const { activeType, activeStatus } = useMemo(() => {
    const pathParts = pathname.split("/").filter(Boolean);
    const rentalsIndex = pathParts.indexOf("rentals");
    if (rentalsIndex !== -1 && pathParts.length >= rentalsIndex + 3) {
      const direction = pathParts[rentalsIndex + 1];
      const urlStatus = pathParts[rentalsIndex + 2];
      if (direction === "incoming") {
        return {
          activeType: "lending" as const,
          activeStatus: urlStatus === "requests" ? "incoming" : urlStatus,
        };
      }
      if (direction === "outgoing") {
        return {
          activeType: "renting" as const,
          activeStatus: urlStatus,
        };
      }
    }
    return { activeType: initialType, activeStatus: initialStatus };
  }, [pathname, initialType, initialStatus]);

  // Data fetching hooks - only fetch the currently active tab
  const rentingRequests = useRentingRequests("pending", {
    enabled: activeType === "renting" && activeStatus === "requests",
  });
  const rentingApproved = useRentingRequests("approved", {
    enabled: activeType === "renting" && activeStatus === "approved",
  });
  const rentingDenied = useRentingRequests("denied", {
    enabled: activeType === "renting" && activeStatus === "denied",
  });
  const rentingCancelled = useRentingCancelled({
    enabled: activeType === "renting" && activeStatus === "cancelled",
  });
  const rentingActive = useRentingActive({
    enabled: activeType === "renting" && activeStatus === "active",
  });
  const rentingCompleted = useRentingCompleted({
    enabled: activeType === "renting" && activeStatus === "completed",
  });

  const lendingIncoming = useLendingIncoming({
    enabled: activeType === "lending" && activeStatus === "incoming",
  });
  const lendingApproved = useLendingApproved({
    enabled: activeType === "lending" && activeStatus === "approved",
  });
  const lendingDenied = useLendingDenied({
    enabled: activeType === "lending" && activeStatus === "denied",
  });
  const lendingCancelled = useLendingCancelled({
    enabled: activeType === "lending" && activeStatus === "cancelled",
  });
  const lendingActive = useLendingActive({
    enabled: activeType === "lending" && activeStatus === "active",
  });
  const lendingCompleted = useLendingCompleted({
    enabled: activeType === "lending" && activeStatus === "completed",
  });

  // Get current query based on active tab
  const getCurrentQuery = () => {
    const key = `${activeType}-${activeStatus}`;
    switch (key) {
      case "renting-requests":
        return rentingRequests;
      case "renting-approved":
        return rentingApproved;
      case "renting-denied":
        return rentingDenied;
      case "renting-cancelled":
        return rentingCancelled;
      case "renting-active":
        return rentingActive;
      case "renting-completed":
        return rentingCompleted;
      case "lending-incoming":
        return lendingIncoming;
      case "lending-approved":
        return lendingApproved;
      case "lending-denied":
        return lendingDenied;
      case "lending-cancelled":
        return lendingCancelled;
      case "lending-active":
        return lendingActive;
      case "lending-completed":
        return lendingCompleted;
      default:
        return rentingRequests;
    }
  };

  const currentQuery = getCurrentQuery();

  const handleTypeChange = (newType: "renting" | "lending") => {
    // Save scroll position to sessionStorage before navigation
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        SCROLL_POSITION_KEY,
        scrollContainerRef.current.scrollLeft.toString(),
      );
    }
    const direction = newType === "renting" ? "outgoing" : "incoming";
    const defaultStatus = newType === "renting" ? "requests" : "requests";
    router.push(`/dashboard/rentals/${direction}/${defaultStatus}`);
  };

  const handleStatusChange = (newStatus: string) => {
    // Save scroll position to sessionStorage before navigation
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        SCROLL_POSITION_KEY,
        scrollContainerRef.current.scrollLeft.toString(),
      );
    }
    const direction = activeType === "renting" ? "outgoing" : "incoming";
    const urlStatus =
      activeType === "lending" && newStatus === "incoming"
        ? "requests"
        : newStatus;
    router.push(`/dashboard/rentals/${direction}/${urlStatus}`);
  };

  // Restore scroll position after mount and navigation
  useEffect(() => {
    const restoreScrollPosition = () => {
      const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
      if (scrollContainerRef.current && savedPosition) {
        const position = parseInt(savedPosition, 10);
        if (!isNaN(position)) {
          scrollContainerRef.current.scrollLeft = position;
        }
      }
    };

    // Try to restore immediately
    restoreScrollPosition();

    // Also try after a short delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(restoreScrollPosition, 50);

    return () => clearTimeout(timeoutId);
  }, [activeType, activeStatus]);

  // Save scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        sessionStorage.setItem(
          SCROLL_POSITION_KEY,
          scrollContainerRef.current.scrollLeft.toString(),
        );
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, []);

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
      const isRequest =
        activeStatus === "requests" ||
        activeStatus === "approved" ||
        activeStatus === "denied" ||
        activeStatus === "cancelled";

      return (
        <RentalList
          data={data as RentalRequestItem[] | BorrowedListing[]}
          variant={isRequest ? "request" : "active"}
          reviewPolicyUrl={reviewPolicyUrl}
          emptyStateMessage={
            activeStatus === "requests"
              ? "Nothing rented yet"
              : activeStatus === "approved"
                ? "No approved requests."
                : activeStatus === "denied"
                  ? "No denied requests."
                  : activeStatus === "cancelled"
                    ? "No cancelled rentals."
                    : `No ${activeStatus} rentals.`
          }
          emptyStateAction={
            activeStatus === "requests"
              ? { label: "Browse", href: "/dashboard/explore" }
              : undefined
          }
        />
      );
    } else {
      // Lending
      return (
        <LendingRequestsList
          data={data as LendingRequestItem[]}
          emptyStateMessage={
            activeStatus === "incoming"
              ? "No rental requests yet"
              : activeStatus === "approved"
                ? "No approved requests."
                : activeStatus === "cancelled"
                  ? "No cancelled rentals."
                  : `No ${activeStatus} requests.`
          }
        />
      );
    }
  };

  const statusFilters: { value: string; label: string }[] =
    activeType === "renting"
      ? [
          { value: "requests", label: "Requests" },
          { value: "approved", label: "Scheduled" },
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
          { value: "denied", label: "Denied" },
          { value: "cancelled", label: "Cancelled" },
        ]
      : [
          { value: "incoming", label: "Requests" },
          { value: "approved", label: "Scheduled" },
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
          { value: "denied", label: "Denied" },
          { value: "cancelled", label: "Cancelled" },
        ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Type Toggle (Renting/Lending) */}
        <div className="bg-muted inline-flex items-center rounded-lg p-1">
          <button
            onClick={() => handleTypeChange("lending")}
            className={cn(
              "coarse:min-h-11 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeType === "lending"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Owner
          </button>
          <button
            onClick={() => handleTypeChange("renting")}
            className={cn(
              "coarse:min-h-11 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeType === "renting"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Renter
          </button>
        </div>

        {/* Status Filters */}
        <div className="relative">
          {/* Left fade gradient */}
          <div className="from-background pointer-events-none absolute top-0 -left-4 z-10 h-full w-8 bg-linear-to-r to-transparent md:hidden" />

          {/* Right fade gradient */}
          <div className="from-background pointer-events-none absolute top-0 -right-4 z-10 h-full w-8 bg-linear-to-l to-transparent md:hidden" />

          {/* Scrollable container */}
          <div
            ref={scrollContainerRef}
            className="scrollbar-hide -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-x-visible md:px-0"
          >
            <div className="flex gap-2 md:flex-wrap">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => handleStatusChange(filter.value)}
                  className={cn(
                    "coarse:min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                    activeStatus === filter.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent",
                  )}
                >
                  {filter.label}
                </button>
              ))}
              {/* Spacer to ensure last item clears the fade gradient on mobile */}
              <div className="w-3 shrink-0 md:hidden" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>{renderContent()}</div>
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
