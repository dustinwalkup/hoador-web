"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
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

import type { GarageToolFilters } from "@/lib/dal/tool.dal";
import { emojiMap } from "@/lib/constants/garage";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface GarageFiltersProps {
  currentTab: string;
  filters: GarageToolFilters;
  categories: Category[];
}

// Get category display name with emoji
function getCategoryDisplayName(category: Category): string {
  const emoji =
    category.icon && emojiMap[category.icon] ? emojiMap[category.icon] : "";
  return emoji ? `${emoji} ${category.name}` : category.name;
}

// Get rental status display name with emoji
function getRentalStatusDisplayName(status: string): string {
  switch (status) {
    case "all":
      return "All Tools";
    case "available":
      return "✅ Available";
    case "rented":
      return "🔄 Rented";
    default:
      return status;
  }
}

function GarageFiltersContent({
  currentTab,
  filters,
  categories,
}: GarageFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(filters.query || "");

  // Update URL with new parameters
  const updateURL = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Preserve current tab
    if (currentTab !== "active") {
      params.set("tab", currentTab);
    } else {
      params.delete("tab");
    }

    router.push(`/dashboard/garage?${params.toString()}`);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedUpdateSearch(query);
  };

  // Debounced search function using walkup-utils
  const debouncedUpdateSearch = debounce((...args: unknown[]) => {
    const query = args[0] as string;
    updateURL({ q: query || undefined });
  }, 300);

  // Handle clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    updateURL({ q: undefined });
  };

  // Handle sort change
  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split("-");
    updateURL({ sortBy, sortOrder });
  };

  // Handle category change
  const handleCategoryChange = (categoryId: string) => {
    updateURL({
      category: categoryId === "all" ? undefined : categoryId,
    });
  };

  // Handle rental status change (only for active tab)
  const handleRentalStatusChange = (status: string) => {
    updateURL({
      rentalStatus: status === "all" ? undefined : status,
    });
  };

  // Get current sort display value
  const getSortDisplayValue = () => {
    if (!filters.sortBy) return "newest-desc";
    return `${filters.sortBy}-${filters.sortOrder || "desc"}`;
  };

  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input */}
      <div className="relative flex w-full max-w-sm items-center">
        <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
        <Input
          placeholder="Search tools..."
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
      <div className="flex items-center gap-2">
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
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {getCategoryDisplayName(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Rental Status Filter (Active Tab Only) */}
        {currentTab === "active" && (
          <Select
            value={filters.rentalStatus || "all"}
            onValueChange={handleRentalStatusChange}
          >
            <SelectTrigger className="h-9 w-[140px]">
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

interface GarageFiltersWrapperProps {
  currentTab: string;
  filters: GarageToolFilters;
  categories: Array<{
    id: string;
    name: string;
    icon: string | null;
  }>;
}

export function GarageFilters({
  currentTab,
  filters,
  categories,
}: GarageFiltersWrapperProps) {
  return (
    <Suspense
      fallback={<div className="bg-muted mt-6 h-20 animate-pulse rounded" />}
    >
      <GarageFiltersContent
        currentTab={currentTab}
        filters={filters}
        categories={categories}
      />
    </Suspense>
  );
}
