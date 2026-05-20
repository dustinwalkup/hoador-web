"use client";

import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, Package } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LendingRequestItem } from "@/dal/rentals.dal";
import { LendingCard } from "@/features/rentals/components/renting-lending";
import { EmptyStateCoach } from "@/components/empty-state-coach";
import type { OnboardingStatus } from "@/features/payments/lib/payout-readiness";

interface LendingRequestsListProps {
  data: LendingRequestItem[];
  emptyStateMessage?: string;
  emptyStateAction?: {
    label: string;
    href: string;
  };
  ownerOnboardingStatus?: OnboardingStatus;
}

export function LendingRequestsList({
  data,
  emptyStateMessage,
  emptyStateAction,
  ownerOnboardingStatus,
}: LendingRequestsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const listingName = item.listingName?.toLowerCase() || "";
      const renterName = item.renterName?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      return listingName.includes(query) || renterName.includes(query);
    });
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
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
          (a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount),
        );
      case "amount_low":
        return sorted.sort(
          (a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount),
        );
      default:
        return sorted;
    }
  }, [filteredData, sortBy]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search by listing name or renter..."
            aria-label="Search by listing name or renter"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-md pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={handleSortChange}>
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
        <Card>
          <CardContent className="py-2">
            {searchQuery ? (
              <div className="py-6 text-center">
                <p className="text-gray-600">No requests match your search.</p>
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="mt-2"
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <EmptyStateCoach
                icon={Package}
                iconColor="text-primary/60"
                iconBg="bg-primary/10"
                headline={emptyStateMessage || "No rental requests yet"}
                description="List something to start receiving requests"
                cta={
                  emptyStateAction
                    ? {
                        label: emptyStateAction.label,
                        href: emptyStateAction.href,
                      }
                    : { label: "List an item", href: "/dashboard/listings/add" }
                }
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedData.map((item) => (
              <LendingCard
                key={item.id}
                request={item}
                ownerOnboardingStatus={ownerOnboardingStatus}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-
                {Math.min(startIndex + itemsPerPage, sortedData.length)} of{" "}
                {sortedData.length} requests
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
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
