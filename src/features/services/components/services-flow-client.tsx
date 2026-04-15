"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  CalendarCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useServiceBookings } from "@/features/services/hooks/use-service-bookings";
import { ServiceBookingCard } from "@/features/services/components/service-booking-card";
import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import { EmptyStateCoach } from "@/components/empty-state-coach";

interface ServicesFlowClientProps {
  initialRole: "provider" | "requester";
  initialStatus: string;
}

const SCROLL_POSITION_KEY = "services-filter-scroll-position";

const STATUS_FILTERS = [
  { value: "pending", label: "Requests" },
  { value: "accepted", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function ServicesFlowClient({
  initialRole,
  initialStatus,
}: ServicesFlowClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Derive active role and status from URL pathname (supports browser back/forward)
  const { activeRole, activeStatus } = useMemo(() => {
    const pathParts = pathname.split("/").filter(Boolean);
    const servicesIndex = pathParts.indexOf("services");
    if (servicesIndex !== -1 && pathParts.length >= servicesIndex + 3) {
      const direction = pathParts[servicesIndex + 1];
      const urlStatus = pathParts[servicesIndex + 2];
      if (direction === "incoming") {
        return { activeRole: "provider" as const, activeStatus: urlStatus };
      }
      if (direction === "outgoing") {
        return { activeRole: "requester" as const, activeStatus: urlStatus };
      }
    }
    return { activeRole: initialRole, activeStatus: initialStatus };
  }, [pathname, initialRole, initialStatus]);

  // Both hooks called unconditionally — data is cached on first mount so
  // switching roles is instant with no additional fetch (mirrors rentals pattern).
  const providerQuery = useServiceBookings("provider");
  const requesterQuery = useServiceBookings("requester");
  const query = activeRole === "provider" ? providerQuery : requesterQuery;

  const statusFiltered = useMemo(() => {
    if (!query.data) return [];
    return query.data.filter((row) =>
      activeStatus === "pending"
        ? row.status === "pending" || row.status === "payment_failed"
        : row.status === activeStatus,
    );
  }, [query.data, activeStatus]);

  const handleRoleChange = (newRole: "provider" | "requester") => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        SCROLL_POSITION_KEY,
        scrollContainerRef.current.scrollLeft.toString(),
      );
    }
    const direction = newRole === "provider" ? "incoming" : "outgoing";
    router.push(`/dashboard/services/${direction}/pending`);
  };

  const handleStatusChange = (newStatus: string) => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        SCROLL_POSITION_KEY,
        scrollContainerRef.current.scrollLeft.toString(),
      );
    }
    const direction = activeRole === "provider" ? "incoming" : "outgoing";
    router.push(`/dashboard/services/${direction}/${newStatus}`);
  };

  // Restore scroll position after mount and navigation
  useEffect(() => {
    const restore = () => {
      const saved = sessionStorage.getItem(SCROLL_POSITION_KEY);
      if (scrollContainerRef.current && saved) {
        const pos = parseInt(saved, 10);
        if (!isNaN(pos)) scrollContainerRef.current.scrollLeft = pos;
      }
    };
    restore();
    const id = setTimeout(restore, 50);
    return () => clearTimeout(id);
  }, [activeRole, activeStatus]);

  // Save scroll position on scroll
  useEffect(() => {
    const onScroll = () => {
      if (scrollContainerRef.current) {
        sessionStorage.setItem(
          SCROLL_POSITION_KEY,
          scrollContainerRef.current.scrollLeft.toString(),
        );
      }
    };
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Role toggle */}
        <div className="bg-muted inline-flex items-center rounded-lg p-1">
          <button
            onClick={() => handleRoleChange("provider")}
            className={cn(
              "coarse:min-h-11 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeRole === "provider"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Provider
          </button>
          <button
            onClick={() => handleRoleChange("requester")}
            className={cn(
              "coarse:min-h-11 coarse:min-w-11 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeRole === "requester"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Client
          </button>
        </div>

        {/* Status filters */}
        <div className="relative">
          <div className="from-background pointer-events-none absolute top-0 -left-4 z-10 h-full w-8 bg-linear-to-r to-transparent md:hidden" />
          <div className="from-background pointer-events-none absolute top-0 -right-4 z-10 h-full w-8 bg-linear-to-l to-transparent md:hidden" />
          <div
            ref={scrollContainerRef}
            className="scrollbar-hide -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-x-visible md:px-0"
          >
            <div className="flex gap-2 md:flex-wrap">
              {STATUS_FILTERS.map((filter) => (
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
              <div className="w-3 shrink-0 md:hidden" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* key resets search/sort/page state when the active tab changes */}
      <ServiceBookingsList
        key={`${activeRole}-${activeStatus}`}
        data={statusFiltered}
        activeStatus={activeStatus}
        activeRole={activeRole}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
    </div>
  );
}

// ─── List sub-component ───────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 5;

// const EMPTY_STATE_MESSAGES: Record<string, string> = {
//   pending: "No pending requests.",
//   accepted: "No scheduled bookings.",
//   completed: "No completed bookings.",
//   declined: "No declined requests.",
//   cancelled: "No cancelled bookings.",
// };

function sortBookings(
  data: ServiceBookingDashboardRow[],
  sortBy: string,
): ServiceBookingDashboardRow[] {
  const sorted = [...data];
  switch (sortBy) {
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "oldest":
      return sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    case "amount_high":
      return sorted.sort(
        (a, b) =>
          parseFloat(String(b.totalAmount)) - parseFloat(String(a.totalAmount)),
      );
    case "amount_low":
      return sorted.sort(
        (a, b) =>
          parseFloat(String(a.totalAmount)) - parseFloat(String(b.totalAmount)),
      );
    default:
      return sorted;
  }
}

interface ServiceBookingsListProps {
  data: ServiceBookingDashboardRow[];
  activeStatus: string;
  activeRole: "provider" | "requester";
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function ServiceBookingsList({
  data,
  activeRole,
  isLoading,
  error,
  onRetry,
}: ServiceBookingsListProps) {
  // State lives here — reset for free via key prop on parent
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const searchPlaceholder =
    activeRole === "provider"
      ? "Search by listing or client..."
      : "Search by listing or provider...";

  const searchFiltered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return data;
    return data.filter((row) => {
      const title = row.listingTitle.toLowerCase();
      const cp = row.counterparty;
      const name = `${cp.firstName ?? ""} ${cp.lastName ?? ""}`.toLowerCase();
      return title.includes(q) || name.includes(q);
    });
  }, [data, searchQuery]);

  const sortedData = useMemo(
    () => sortBookings(searchFiltered, sortBy),
    [searchFiltered, sortBy],
  );

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = sortedData.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  if (isLoading) return <ServicesLoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <AlertCircle className="mb-4 h-8 w-8 text-red-500" />
        <h3 className="mb-2 text-lg font-medium">Failed to load bookings</h3>
        <p className="text-muted-foreground mb-4 text-sm">{error.message}</p>
        <Button onClick={onRetry}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search + sort */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="max-w-md pl-10"
          />
        </div>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="amount_high">Amount (high to low)</SelectItem>
            <SelectItem value="amount_low">Amount (low to high)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {paginatedData.length === 0 ? (
        <div className="rounded-lg border">
          {searchQuery ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No bookings match your search.
              </p>
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="mt-3"
              >
                Clear search
              </Button>
            </div>
          ) : activeRole === "requester" ? (
            <EmptyStateCoach
              icon={CalendarCheck}
              iconColor="text-primary/60"
              iconBg="bg-primary/10"
              headline="No service bookings yet"
              description="Browse services available in your area"
              cta={{ label: "Browse services", href: "/dashboard/explore" }}
            />
          ) : (
            <EmptyStateCoach
              icon={Briefcase}
              iconColor="text-primary/60"
              iconBg="bg-primary/10"
              headline="No service requests yet"
              description="List a service to start receiving bookings"
              cta={{
                label: "List a service",
                href: "/dashboard/services/listings/create",
              }}
            />
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedData.map((row) => (
              <ServiceBookingCard key={row.id} row={row} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Showing {startIndex + 1}–
                {Math.min(startIndex + ITEMS_PER_PAGE, sortedData.length)} of{" "}
                {sortedData.length} bookings
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ServicesLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
