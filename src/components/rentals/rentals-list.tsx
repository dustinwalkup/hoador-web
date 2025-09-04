"use client";

import { useState, useMemo } from "react";
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
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { RentingCard, LendingCard } from "./rental-card";
import type {
  RentingRental,
  LendingRental,
  RentalType,
} from "@/features/rentals/lib/types";

interface RentalsListProps {
  data: RentingRental[] | LendingRental[];
  type: RentalType;
  status: string;
  emptyStateMessage?: string;
  emptyStateAction?: {
    label: string;
    href: string;
  };
}

export function RentalsList({
  data,
  type,
  status,
  emptyStateMessage,
  emptyStateAction,
}: RentalsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const listingName = item.listing?.name?.toLowerCase() || "";
      const personName =
        type === "renting"
          ? (item as RentingRental).owner?.name?.toLowerCase() || ""
          : (item as LendingRental).renter?.name?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      return listingName.includes(query) || personName.includes(query);
    });
  }, [data, searchQuery, type]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    switch (sortBy) {
      case "newest":
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt || b.startDate).getTime() -
            new Date(a.createdAt || a.startDate).getTime(),
        );
      case "oldest":
        return sorted.sort(
          (a, b) =>
            new Date(a.createdAt || a.startDate).getTime() -
            new Date(b.createdAt || b.startDate).getTime(),
        );
      case "amount_high":
        return sorted.sort((a, b) => b.totalAmount - a.totalAmount);
      case "amount_low":
        return sorted.sort((a, b) => a.totalAmount - b.totalAmount);
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

  const searchPlaceholder =
    type === "renting"
      ? "Search by listing name or owner..."
      : "Search by listing name or renter...";

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
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
          <CardContent className="py-8 text-center">
            <p className="text-gray-600">
              {searchQuery
                ? `No ${type === "renting" ? "rentals" : "requests"} match your search.`
                : emptyStateMessage ||
                  `No ${status} ${type === "renting" ? "rentals" : "requests"}.`}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="mt-2"
              >
                Clear search
              </Button>
            )}
            {!searchQuery && emptyStateAction && (
              <Link href={emptyStateAction.href}>
                <Button className="mt-4">{emptyStateAction.label}</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedData.map((item) =>
              type === "renting" ? (
                <RentingCard
                  key={item.id}
                  rental={item as RentingRental}
                  currentTab={status}
                />
              ) : (
                <LendingCard
                  key={item.id}
                  request={item as LendingRental}
                  currentTab={status}
                />
              ),
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-
                {Math.min(startIndex + itemsPerPage, sortedData.length)} of{" "}
                {sortedData.length}{" "}
                {type === "renting" ? "rentals" : "requests"}
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
