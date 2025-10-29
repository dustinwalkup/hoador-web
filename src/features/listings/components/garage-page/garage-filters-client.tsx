"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { debounce } from "@walkup/walkup-utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useGarageFilters,
  useGarageCategories,
} from "@/features/listings/hooks/use-garage";
import { emojiMap } from "@/constants/garage";
import { GarageFiltersLoadingSkeleton } from "./garage-loading-skeleton";
import { GarageFiltersError } from "./garage-error";

// Get category display name with emoji
function getCategoryDisplayName(category: {
  name: string;
  icon: string | null;
}): string {
  const emoji =
    category.icon && emojiMap[category.icon] ? emojiMap[category.icon] : "";
  return emoji ? `${emoji} ${category.name}` : category.name;
}

// Get rental status display name with emoji
function getRentalStatusDisplayName(status: string): string {
  switch (status) {
    case "all":
      return "All Listings";
    case "available":
      return "✅ Available";
    case "rented":
      return "🔄 Rented";
    default:
      return status;
  }
}

interface GarageFiltersClientProps {
  currentTab: string;
}

export function GarageFiltersClient({ currentTab }: GarageFiltersClientProps) {
  const { filters, updateFilters } = useGarageFilters();
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch,
  } = useGarageCategories();
  const [searchQuery, setSearchQuery] = useState(filters.query || "");

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedUpdateSearch(query);
  };

  // Debounced search function using walkup-utils
  const debouncedUpdateSearch = debounce((...args: unknown[]) => {
    const query = args[0] as string;
    updateFilters({ query: query || undefined });
  }, 300);

  // Handle clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    updateFilters({ query: undefined });
  };

  // Handle sort change
  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split("-");
    updateFilters({
      sortBy: sortBy as "newest" | "name" | "lastRented",
      sortOrder: sortOrder as "asc" | "desc",
    });
  };

  // Handle category change
  const handleCategoryChange = (categoryId: string) => {
    updateFilters({
      categoryId: categoryId === "all" ? undefined : categoryId,
    });
  };

  // Handle rental status change (only for active tab)
  const handleRentalStatusChange = (status: string) => {
    updateFilters({
      rentalStatus:
        status === "all" ? undefined : (status as "available" | "rented"),
    });
  };

  // Get current sort display value
  const getSortDisplayValue = () => {
    if (!filters.sortBy) return "newest-desc";
    return `${filters.sortBy}-${filters.sortOrder || "desc"}`;
  };

  if (categoriesLoading) {
    return <GarageFiltersLoadingSkeleton />;
  }

  if (categoriesError) {
    return (
      <GarageFiltersError error={categoriesError} onRetry={() => refetch()} />
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input */}
      <div className="relative flex w-full max-w-sm items-center">
        <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
        <Input
          placeholder="Search Listings..."
          className="pr-8 pl-9"
          value={searchQuery}
          onChange={handleSearchChange}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 h-6 w-6 p-0"
            onClick={handleClearSearch}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 md:justify-start">
        {/* Sort Dropdown */}
        <Select value={getSortDisplayValue()} onValueChange={handleSortChange}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest-desc">Newest</SelectItem>
            <SelectItem value="name-asc">A–Z</SelectItem>
            <SelectItem value="name-desc">Z–A</SelectItem>
            <SelectItem value="lastRented-desc">Last Rented</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Dropdown */}
        <Select
          value={filters.categoryId || "all"}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(
              (category: { id: string; name: string; icon: string | null }) => (
                <SelectItem key={category.id} value={category.id}>
                  {getCategoryDisplayName(category)}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        {/* Rental Status Filter (Active Tab Only) */}
        {currentTab === "active" && (
          <Select
            value={filters.rentalStatus || "all"}
            onValueChange={handleRentalStatusChange}
          >
            <SelectTrigger className="hidden h-9 w-[140px] md:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {getRentalStatusDisplayName("all")}
              </SelectItem>
              <SelectItem value="available">
                {getRentalStatusDisplayName("available")}
              </SelectItem>
              <SelectItem value="rented">
                {getRentalStatusDisplayName("rented")}
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
