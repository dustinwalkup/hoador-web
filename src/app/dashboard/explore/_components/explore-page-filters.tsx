"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Filter, ChevronDown, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CategoryButton from "@/components/dashboard/category-button";
import type { ToolSearchFilters } from "@/lib/dal/types";
import { emojiMap } from "@/lib/constants/garage";

interface ExplorePageFiltersProps {
  categories: Array<{
    id: string;
    name: string;
    icon: string | null;
  }>;
  initialFilters: ToolSearchFilters;
  totalResults: number;
  basePath?: string; // Default to /dashboard/explore for backward compatibility
}

// Map category names to emoji icons
const getCategoryIcon = (name: string, iconFromDb: string | null) => {
  // First check if we have a database icon identifier and map it to emoji
  if (iconFromDb && emojiMap[iconFromDb]) {
    return emojiMap[iconFromDb];
  }

  // If the database icon is already an emoji, return it directly
  if (iconFromDb) {
    return iconFromDb;
  }

  // Fallback emoji mapping based on category names
  const iconMap: Record<string, string> = {
    "Power Tools": "🔌",
    "Hand Tools": "🪚",
    "Lawn & Garden": "🌱",
    Gardening: "🌱",
    "Ladders & Access": "🪜",
    Ladders: "🪜",
    Painting: "🎨",
    Trucks: "🚚",
    Plumbing: "🧰",
    Automotive: "🚗",
    Electrical: "⚡",
    Cleaning: "🧽",
    Construction: "🏗️",
    "Party Equipment": "⛺",
  };

  return iconMap[name] || "🔧";
};

export function ExplorePageFilters({
  categories,
  initialFilters,
  totalResults,
  basePath = "/dashboard/explore", // Default to existing behavior
}: ExplorePageFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(initialFilters.query || "");
  const [minPrice, setMinPrice] = useState(
    initialFilters.minPrice?.toString() || "",
  );
  const [maxPrice, setMaxPrice] = useState(
    initialFilters.maxPrice?.toString() || "",
  );
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    initialFilters.condition || [],
  );
  const [deliveryAvailable, setDeliveryAvailable] = useState(
    initialFilters.deliveryAvailable || false,
  );
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Get current sort option label
  const getCurrentSortLabel = () => {
    const sortBy = initialFilters.sortBy || "newest";
    const sortOrder = initialFilters.sortOrder || "desc";

    if (sortBy === "newest") return "Recently added";
    if (sortBy === "price" && sortOrder === "asc") return "Price: Low to high";
    if (sortBy === "price" && sortOrder === "desc") return "Price: High to low";
    if (sortBy === "rating") return "Highest rated";
    return "Sort";
  };

  // Count active filters
  const getActiveFiltersCount = () => {
    let count = 0;
    if (minPrice) count++; // Min price
    if (maxPrice) count++; // Max price
    count += selectedConditions.length; // Each condition individually
    if (deliveryAvailable) count++; // Delivery filter
    return count;
  };

  const updateURL = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset to page 1 when filters change
    if (Object.keys(updates).some((key) => key !== "page")) {
      params.set("page", "1");
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateURL({ q: searchQuery });
  };

  const handleCategorySelect = (categoryId: string) => {
    const currentCategory = searchParams.get("category");
    updateURL({
      category: currentCategory === categoryId ? undefined : categoryId,
    });
  };

  const handleSortSelect = (sortBy: string, sortOrder?: string) => {
    updateURL({ sortBy, sortOrder });
    setSortOpen(false);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    updateURL({ q: undefined });
  };

  const handleConditionToggle = (condition: string) => {
    const newConditions = selectedConditions.includes(condition)
      ? selectedConditions.filter((c) => c !== condition)
      : [...selectedConditions, condition];

    setSelectedConditions(newConditions);
    updateURL({
      condition: newConditions.length > 0 ? newConditions.join(",") : undefined,
    });
  };

  const handleFiltersApply = () => {
    updateURL({
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      condition:
        selectedConditions.length > 0
          ? selectedConditions.join(",")
          : undefined,
      delivery: deliveryAvailable ? "true" : undefined,
    });
    setFiltersOpen(false);
  };

  const handleFiltersReset = () => {
    setMinPrice("");
    setMaxPrice("");
    setSelectedConditions([]);
    setDeliveryAvailable(false);
    updateURL({
      minPrice: undefined,
      maxPrice: undefined,
      condition: undefined,
      delivery: undefined,
    });
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Category buttons */}
      <div className="mb-8 flex flex-nowrap gap-2 overflow-x-auto pb-2">
        <CategoryButton
          icon="🔨"
          label="All Tools"
          active={!initialFilters.categoryId}
          onClick={() => handleCategorySelect("")}
        />
        {categories.map((category) => (
          <CategoryButton
            key={category.id}
            icon={getCategoryIcon(category.name, category.icon)}
            label={category.name}
            active={initialFilters.categoryId === category.id}
            onClick={() => handleCategorySelect(category.id)}
          />
        ))}
      </div>

      {/* Search and filters row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={handleSearch}
          className="relative flex w-full max-w-sm items-center"
        >
          <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="pr-8 pl-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="hover:bg-muted absolute right-2 flex h-5 w-5 items-center justify-center rounded-full"
            >
              <X className="text-muted-foreground h-3 w-3" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {getActiveFiltersCount() > 0 && (
                  <Badge className="ml-2">{getActiveFiltersCount()}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filter Tools</SheetTitle>
                <SheetDescription>
                  Narrow down your search with these filters
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6 px-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Price Range</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="min-price" className="text-xs">
                        Min
                      </Label>
                      <Input
                        id="min-price"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="$0"
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="max-price" className="text-xs">
                        Max
                      </Label>
                      <Input
                        id="max-price"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="$100"
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Condition</h3>
                  <div className="space-y-2">
                    {["excellent", "good", "fair", "poor"].map((condition) => (
                      <div
                        key={condition}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`condition-${condition}`}
                          checked={selectedConditions.includes(condition)}
                          onCheckedChange={() =>
                            handleConditionToggle(condition)
                          }
                        />
                        <label
                          htmlFor={`condition-${condition}`}
                          className="text-sm leading-none capitalize peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {condition}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Delivery</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="delivery-available"
                      checked={deliveryAvailable}
                      onCheckedChange={(checked) =>
                        setDeliveryAvailable(checked === true)
                      }
                    />
                    <label
                      htmlFor="delivery-available"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Delivery available
                    </label>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={handleFiltersReset}
                  className="w-full"
                >
                  Reset Filters
                </Button>
                <Button onClick={handleFiltersApply} className="w-full">
                  Apply Filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                {getCurrentSortLabel()}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSortSelect("newest", "desc")}
                >
                  Recently added
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSortSelect("price", "asc")}
                >
                  Price: Low to high
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSortSelect("price", "desc")}
                >
                  Price: High to low
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSortSelect("rating", "desc")}
                >
                  Highest rated
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Results count */}
          <div className="text-muted-foreground text-sm">
            {totalResults} tools found
          </div>
        </div>
      </div>
    </div>
  );
}
