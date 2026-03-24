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

import type { ServiceListingCategoryInfo } from "@/dal/service-listing.dal";
import type { ServiceListingFilters } from "./active-service-listings";

interface MyServiceListingsFiltersClientProps {
  categories: ServiceListingCategoryInfo[];
  filters: ServiceListingFilters;
  onFiltersChange: (filters: ServiceListingFilters) => void;
}

export function MyServiceListingsFiltersClient({
  categories,
  filters,
  onFiltersChange,
}: MyServiceListingsFiltersClientProps) {
  const [searchQuery, setSearchQuery] = useState(filters.query ?? "");

  const debouncedUpdateSearch = debounce((...args: unknown[]) => {
    const query = args[0] as string;
    onFiltersChange({ ...filters, query: query || undefined });
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedUpdateSearch(query);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    onFiltersChange({ ...filters, query: undefined });
  };

  const handleSortChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortBy: value as ServiceListingFilters["sortBy"],
    });
  };

  const handleCategoryChange = (categoryId: string) => {
    onFiltersChange({
      ...filters,
      categoryId: categoryId === "all" ? undefined : categoryId,
    });
  };

  const sortValue = filters.sortBy ?? "newest";

  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Search */}
      <div className="relative flex w-full max-w-sm items-center">
        <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
        <Input
          placeholder="Search listings..."
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
        {/* Sort */}
        <Select value={sortValue} onValueChange={handleSortChange}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="name-asc">A–Z</SelectItem>
            <SelectItem value="name-desc">Z–A</SelectItem>
          </SelectContent>
        </Select>

        {/* Category */}
        <Select
          value={filters.categoryId ?? "all"}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
