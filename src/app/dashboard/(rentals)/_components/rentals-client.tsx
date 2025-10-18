"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useRentingRequests,
  useRentingActive,
  useRentingCompleted,
  useLendingIncoming,
  useLendingDenied,
  useLendingActive,
  useLendingCompleted,
  useLendingApproved,
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
import { cn } from "@/lib/utils";

interface RentalsClientProps {
  initialType: "renting" | "lending";
  initialStatus: string;
}

const SCROLL_POSITION_KEY = "rentals-filter-scroll-position";

export function RentalsClient({
  initialType,
  initialStatus,
}: RentalsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeType, setActiveType] = useState<"renting" | "lending">(
    initialType,
  );
  const [activeStatus, setActiveStatus] = useState<string>(initialStatus);

  // Data fetching hooks - only fetch what we need based on current tab
  const rentingRequests = useRentingRequests("pending");
  const rentingApproved = useRentingRequests("approved");
  const rentingDenied = useRentingRequests("denied");
  const rentingActive = useRentingActive();
  const rentingCompleted = useRentingCompleted();

  const lendingIncoming = useLendingIncoming();
  const lendingApproved = useLendingApproved(); // Use proper approved hook for lending
  const lendingDenied = useLendingDenied();
  const lendingActive = useLendingActive();
  const lendingCompleted = useLendingCompleted();

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
    setActiveType(newType);
    // Set appropriate default status for the type
    const defaultStatus = newType === "renting" ? "requests" : "incoming";
    setActiveStatus(defaultStatus);
    router.push(`/dashboard/${newType}/${defaultStatus}`);
  };

  const handleStatusChange = (newStatus: string) => {
    // Save scroll position to sessionStorage before navigation
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        SCROLL_POSITION_KEY,
        scrollContainerRef.current.scrollLeft.toString(),
      );
    }
    setActiveStatus(newStatus);
    router.push(`/dashboard/${activeType}/${newStatus}`);
  };

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    const pathParts = pathname.split("/");
    if (pathParts.length >= 4) {
      const type = pathParts[2] as "renting" | "lending";
      const status = pathParts[3];
      if (type !== activeType || status !== activeStatus) {
        setActiveType(type);
        setActiveStatus(status);
      }
    }
  }, [pathname, activeType, activeStatus]);

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
      if (
        activeStatus === "requests" ||
        activeStatus === "approved" ||
        activeStatus === "denied"
      ) {
        return (
          <RentingRequestsListWrapper
            data={data as RentalRequestItem[]}
            emptyStateMessage={
              activeStatus === "requests"
                ? "No pending requests."
                : activeStatus === "approved"
                  ? "No approved requests."
                  : "No denied requests."
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
              : activeStatus === "approved"
                ? "No approved requests."
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
          { value: "approved", label: "Approved" },
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
          { value: "denied", label: "Denied" },
        ]
      : [
          { value: "incoming", label: "Incoming" },
          { value: "approved", label: "Approved" },
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
          { value: "denied", label: "Denied" },
        ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Type Toggle (Renting/Lending) */}
        <div className="bg-muted inline-flex items-center rounded-lg p-1">
          <button
            onClick={() => handleTypeChange("renting")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeType === "renting"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Renting
          </button>
          <button
            onClick={() => handleTypeChange("lending")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeType === "lending"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Lending
          </button>
        </div>

        {/* Status Filters */}
        <div className="relative">
          {/* Left fade gradient */}
          <div className="from-background pointer-events-none absolute top-0 -left-4 z-10 h-full w-8 bg-gradient-to-r to-transparent md:hidden" />

          {/* Right fade gradient */}
          <div className="from-background pointer-events-none absolute top-0 -right-4 z-10 h-full w-8 bg-gradient-to-l to-transparent md:hidden" />

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
                    "shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
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
