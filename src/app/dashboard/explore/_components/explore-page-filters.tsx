"use client";

import { useState } from "react";
import { Filter, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { useListingFilters } from "@/features/listings/hooks/use-url-state";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { STATIC_CATEGORIES } from "@/constants/listings";

interface ExplorePageFiltersProps {
  basePath?: string;
}

export function ExplorePageFilters({
  basePath: _basePath = "/dashboard/explore", // eslint-disable-line @typescript-eslint/no-unused-vars
}: ExplorePageFiltersProps) {
  // URL state management
  const { state: filters, updateState: updateFilters } = useListingFilters();

  // Local state for filter form
  const [minPrice, setMinPrice] = useState(filters.minPrice?.toString() || "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice?.toString() || "");
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    filters.condition || [],
  );
  const [deliveryAvailable, setDeliveryAvailable] = useState(
    filters.deliveryAvailable || false,
  );
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounced search
  const { localQuery, handleSearchChange, clearSearch } = useDebouncedSearch(
    (query: string) => updateFilters({ query: query || undefined }),
    300,
    filters.query || "",
  );

  // Get current sort option label
  const getCurrentSortLabel = () => {
    const sortBy = filters.sortBy || "newest";
    const sortOrder = filters.sortOrder || "desc";

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ query: localQuery || undefined });
  };

  const handleCategorySelect = (categoryId: string) => {
    // If categoryId is empty string, clear the category filter
    // Otherwise, toggle the category (set to undefined if already selected, otherwise set to new category)
    const newCategoryId =
      categoryId === ""
        ? undefined
        : filters.categoryId === categoryId
          ? undefined
          : categoryId;

    updateFilters({
      categoryId: newCategoryId,
    });
  };

  const handleSortSelect = (
    sortBy: "price" | "rating" | "distance" | "newest",
    sortOrder?: "asc" | "desc",
  ) => {
    updateFilters({ sortBy, sortOrder });
    setSortOpen(false);
  };

  const handleClearSearch = () => {
    clearSearch();
  };

  const handleConditionToggle = (condition: string) => {
    const newConditions = selectedConditions.includes(condition)
      ? selectedConditions.filter((c) => c !== condition)
      : [...selectedConditions, condition];

    setSelectedConditions(newConditions);
    updateFilters({
      condition: newConditions.length > 0 ? newConditions : undefined,
    });
  };

  const handleFiltersApply = () => {
    updateFilters({
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      condition: selectedConditions.length > 0 ? selectedConditions : undefined,
      deliveryAvailable: deliveryAvailable || undefined,
    });
    setFiltersOpen(false);
  };

  const handleFiltersReset = () => {
    setMinPrice("");
    setMaxPrice("");
    setSelectedConditions([]);
    setDeliveryAvailable(false);
    updateFilters({
      minPrice: undefined,
      maxPrice: undefined,
      condition: undefined,
      deliveryAvailable: undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Category buttons */}
      <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-2 md:mb-8">
        <CategoryButton
          icon="🔨"
          label="All Tools"
          active={!filters.categoryId}
          onClick={() => handleCategorySelect("")}
        />
        {STATIC_CATEGORIES.map(
          (category: { id: string; name: string; icon: string | null }) => (
            <CategoryButton
              key={category.id}
              icon={category.icon || ""}
              label={category.name}
              active={filters.categoryId === category.id}
              onClick={() => handleCategorySelect(category.id)}
            />
          ),
        )}
      </div>

      {/* Search and filters row */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between md:gap-4">
        <form
          onSubmit={handleSearch}
          className="relative flex w-full max-w-sm items-center"
        >
          <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
          <Input
            value={localQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tools..."
            className="pr-8 pl-9"
          />
          {localQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="hover:bg-muted absolute right-2 flex h-5 w-5 items-center justify-center rounded-full"
            >
              <X className="text-muted-foreground h-3 w-3" />
            </button>
          )}
        </form>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
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
                <SheetTitle>Filter Listings</SheetTitle>
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
        </div>
      </div>
    </div>
  );
}
