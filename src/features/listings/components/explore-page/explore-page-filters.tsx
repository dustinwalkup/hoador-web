"use client";

import { useEffect, useRef, useState } from "react";
import { Filter, ChevronDown, Search, X } from "lucide-react";
import { trackSearch } from "@/lib/analytics/meta";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CategoryButton from "@/components/dashboard/category-button";
import { useListingFilters } from "@/features/listings/hooks/use-url-state";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { STATIC_CATEGORIES } from "@/constants/listings";

interface ExplorePageFiltersProps {
  basePath?: string;
}

function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="bg-muted flex h-7 items-center gap-1.5 rounded-full px-3 text-sm">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

const deliveryModeLabel = (mode: string) => {
  if (mode === "delivery_only") return "Delivery only";
  if (mode === "both_available") return "Pickup & Delivery";
  return mode;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ExplorePageFilters({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  basePath: _basePath = "/dashboard/explore",
}: ExplorePageFiltersProps) {
  // URL state management
  const { state: filters, updateState: updateFilters } = useListingFilters();

  // Local state for filter form
  const [minPrice, setMinPrice] = useState(filters.minPrice?.toString() || "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice?.toString() || "");
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    filters.condition || [],
  );
  const [deliveryMode, setDeliveryMode] = useState(
    filters.deliveryMode || "pickup_only",
  );
  const [setupAvailable, setSetupAvailable] = useState(
    filters.setupAvailable === true,
  );
  const [availableNow, setAvailableNow] = useState(
    filters.availableNow === true,
  );

  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sync local state with URL filters when opening the sheet
  const syncLocalStateFromFilters = () => {
    setMinPrice(filters.minPrice?.toString() || "");
    setMaxPrice(filters.maxPrice?.toString() || "");
    setSelectedConditions(filters.condition || []);
    setSetupAvailable(filters.setupAvailable === true);
    setAvailableNow(filters.availableNow === true);
    setDeliveryMode(filters.deliveryMode || "pickup_only");
  };

  // Debounced search
  const { localQuery, handleSearchChange, clearSearch } = useDebouncedSearch(
    (query: string) => updateFilters({ query: query || undefined }),
    300,
    filters.query || "",
  );

  // Fire Meta Pixel Search whenever the committed query in the URL changes.
  // The debounced/auto-update path commits via updateFilters({ query }), so this
  // covers both submit-by-form and submit-by-typing without firing per keystroke.
  const lastTrackedQuery = useRef<string | undefined>(filters.query);
  useEffect(() => {
    const q = filters.query?.trim();
    if (q && q !== lastTrackedQuery.current) {
      lastTrackedQuery.current = q;
      trackSearch(q);
    } else if (!q) {
      lastTrackedQuery.current = undefined;
    }
  }, [filters.query]);

  // Get current sort option label
  const getCurrentSortLabel = () => {
    const sortBy = filters.sortBy || "newest";
    const sortOrder = filters.sortOrder || "desc";

    if (sortBy === "newest") return "Newest";
    if (sortBy === "price" && sortOrder === "asc") return "Price: Low to high";
    if (sortBy === "price" && sortOrder === "desc") return "Price: High to low";
    if (sortBy === "rating") return "Highest rated";
    if (sortBy === "distance" && sortOrder === "asc")
      return "Distance: Near to far";
    if (sortBy === "distance" && sortOrder === "desc")
      return "Distance: Far to near";
    return "Sort";
  };

  // Count active filters (reads local/draft state for the badge on the button)
  const getActiveFiltersCount = () => {
    let count = 0;
    if (minPrice) count++;
    if (maxPrice) count++;
    count += selectedConditions.length;
    if (deliveryMode !== "pickup_only") count++;
    if (setupAvailable) count++;
    if (availableNow) count++;
    return count;
  };

  // Active filters from URL state (committed)
  const hasActiveFilters = !!(
    filters.categoryId ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.condition?.length ||
    filters.deliveryMode ||
    filters.setupAvailable ||
    filters.availableNow
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ query: localQuery || undefined });
  };

  const handleCategorySelect = (categoryId: string) => {
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
  };

  const handleFiltersApply = () => {
    updateFilters({
      categoryId: filters.categoryId,
      query: filters.query,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      minPrice: minPrice ? Number.parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? Number.parseFloat(maxPrice) : undefined,
      condition: selectedConditions.length > 0 ? selectedConditions : undefined,
      deliveryMode: deliveryMode !== "pickup_only" ? deliveryMode : undefined,
      setupAvailable: setupAvailable || undefined,
      availableNow: availableNow || undefined,
    });
    setFiltersOpen(false);
  };

  const handleFiltersReset = () => {
    setMinPrice("");
    setMaxPrice("");
    setSelectedConditions([]);
    setDeliveryMode("pickup_only");
    setSetupAvailable(false);
    setAvailableNow(false);
    clearSearch();
    updateFilters({
      categoryId: undefined,
      query: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      condition: undefined,
      deliveryMode: undefined,
      setupAvailable: undefined,
      availableNow: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    });
    setFiltersOpen(false);
  };

  const handleFiltersCancel = () => {
    setMinPrice(filters.minPrice?.toString() || "");
    setMaxPrice(filters.maxPrice?.toString() || "");
    setSelectedConditions(filters.condition || []);
    const setupFromUrl = filters.setupAvailable === true;
    const availableNowFromUrl = filters.availableNow === true;
    const deliveryFromUrl = filters.deliveryMode || "pickup_only";

    setSetupAvailable(setupFromUrl);
    setAvailableNow(availableNowFromUrl);
    setDeliveryMode(deliveryFromUrl);
    setFiltersOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Category scroll — unified across all screen sizes */}
      <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <CategoryButton
          icon="🏪"
          label="All"
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={handleSearch}
          className="relative flex w-full max-w-md items-center"
        >
          <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
          <Input
            value={localQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search rentals..."
            className="h-10 pr-8 pl-9"
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
          <Sheet
            open={filtersOpen}
            onOpenChange={(open) => {
              if (!open) {
                handleFiltersCancel();
              } else {
                syncLocalStateFromFilters();
                setFiltersOpen(true);
              }
            }}
          >
            <SheetTrigger asChild>
              <Button
                variant={getActiveFiltersCount() > 0 ? "default" : "outline"}
                size="sm"
                className="h-9 bg-transparent"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {getActiveFiltersCount() > 0 && (
                  <Badge
                    className="ml-2"
                    variant={
                      getActiveFiltersCount() > 0 ? "secondary" : "default"
                    }
                  >
                    {getActiveFiltersCount()}
                  </Badge>
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
                  <div className="flex flex-col space-y-2">
                    <div className="mb-4 space-y-2">
                      <Label className="text-sm font-medium">
                        Delivery Method
                      </Label>
                      <Select
                        value={deliveryMode}
                        onValueChange={(value) =>
                          setDeliveryMode(
                            value as
                              | "pickup_only"
                              | "delivery_only"
                              | "both_available",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pickup_only">
                            Pickup Only
                          </SelectItem>
                          <SelectItem value="delivery_only">
                            Delivery Only
                          </SelectItem>
                          <SelectItem value="both_available">
                            Pickup & Delivery
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <h3 className="text-sm font-medium">Options</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="setup-available"
                        checked={setupAvailable}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setSetupAvailable(isChecked);
                          if (isChecked && deliveryMode === "pickup_only") {
                            setDeliveryMode("both_available");
                          }
                        }}
                      />
                      <label
                        htmlFor="setup-available"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Setup available
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="available-now"
                        checked={availableNow}
                        onCheckedChange={(checked) => {
                          setAvailableNow(checked === true);
                        }}
                      />
                      <label
                        htmlFor="available-now"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Available now
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    onClick={handleFiltersReset}
                    className="flex-1 bg-transparent"
                  >
                    Reset
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleFiltersCancel}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleFiltersApply} className="flex-1">
                    Apply
                  </Button>
                </div>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 bg-transparent"
              >
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
                  Newest
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
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSortSelect("distance", "asc")}
                >
                  Distance: Near to far
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSortSelect("distance", "desc")}
                >
                  Distance: Far to near
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active filters row */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.categoryId && (
            <ActiveFilterChip
              label={
                STATIC_CATEGORIES.find((c) => c.id === filters.categoryId)
                  ?.name ?? "Category"
              }
              onRemove={() => updateFilters({ categoryId: undefined })}
            />
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <ActiveFilterChip
              label={`$${filters.minPrice ?? "0"}–$${filters.maxPrice ?? "∞"}`}
              onRemove={() =>
                updateFilters({ minPrice: undefined, maxPrice: undefined })
              }
            />
          )}
          {filters.condition?.map((c) => (
            <ActiveFilterChip
              key={c}
              label={capitalize(c)}
              onRemove={() =>
                updateFilters({
                  condition: filters.condition?.filter((x) => x !== c),
                })
              }
            />
          ))}
          {filters.deliveryMode && (
            <ActiveFilterChip
              label={deliveryModeLabel(filters.deliveryMode)}
              onRemove={() => updateFilters({ deliveryMode: undefined })}
            />
          )}
          {filters.setupAvailable && (
            <ActiveFilterChip
              label="Setup available"
              onRemove={() => updateFilters({ setupAvailable: undefined })}
            />
          )}
          {filters.availableNow && (
            <ActiveFilterChip
              label="Available now"
              onRemove={() => updateFilters({ availableNow: undefined })}
            />
          )}
          <button
            type="button"
            onClick={handleFiltersReset}
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
