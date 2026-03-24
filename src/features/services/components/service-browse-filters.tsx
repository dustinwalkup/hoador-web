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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CategoryButton from "@/components/dashboard/category-button";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { useServiceBrowseFilters } from "@/features/services/hooks/use-service-browse-filters";
import type { ServiceSortKey } from "@/features/services/hooks/use-service-browse-filters";

/** Map known category names to emojis. Falls back to 💼 for unknown names. */
const CATEGORY_ICONS: Record<string, string> = {
  "Lawn & Yard": "🌿",
  Cleaning: "🧹",
  Handyman: "🔧",
  "Pet Care": "🐾",
  Childcare: "👶",
  "Moving Help": "📦",
  Tutoring: "📚",
  Errands: "🛒",
};

const SORT_LABELS: Record<ServiceSortKey, string> = {
  newest: "Recently added",
  price_asc: "Price: Low to high",
  price_desc: "Price: High to low",
  rating_desc: "Highest rated",
};

interface ServiceBrowseFiltersProps {
  categories: { id: string; name: string }[];
}

export function ServiceBrowseFilters({
  categories,
}: ServiceBrowseFiltersProps) {
  const { state, updateState } = useServiceBrowseFilters();

  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Local draft state for the sheet (discarded on cancel)
  const [draftMinPrice, setDraftMinPrice] = useState(state.minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(state.maxPrice);
  const [draftPricingTypes, setDraftPricingTypes] = useState<
    Array<"hourly" | "fixed">
  >(state.pricingTypes);

  const syncDraftFromState = () => {
    setDraftMinPrice(state.minPrice);
    setDraftMaxPrice(state.maxPrice);
    setDraftPricingTypes(state.pricingTypes);
  };

  // Debounced search → updates URL
  const { localQuery, handleSearchChange, clearSearch } = useDebouncedSearch(
    (q: string) => updateState({ query: q || undefined }),
    300,
    state.query || "",
  );

  const handleCategorySelect = (id: string) => {
    updateState({ categoryId: id === "all" ? undefined : id });
  };

  const handlePricingTypeToggle = (type: "hourly" | "fixed") => {
    setDraftPricingTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleFiltersApply = () => {
    updateState({
      minPrice: draftMinPrice,
      maxPrice: draftMaxPrice,
      pricingTypes: draftPricingTypes,
    });
    setFiltersOpen(false);
  };

  const handleFiltersCancel = () => {
    syncDraftFromState();
    setFiltersOpen(false);
  };

  const handleFiltersReset = () => {
    setDraftMinPrice("");
    setDraftMaxPrice("");
    setDraftPricingTypes([]);
    clearSearch();
    updateState({
      query: undefined,
      categoryId: undefined,
      minPrice: "",
      maxPrice: "",
      pricingTypes: [],
      sortBy: "newest",
    });
    setFiltersOpen(false);
  };

  const activeFiltersCount =
    (state.minPrice ? 1 : 0) +
    (state.maxPrice ? 1 : 0) +
    state.pricingTypes.length;

  return (
    <div className="space-y-6">
      {/* Mobile category dropdown */}
      <div className="md:hidden">
        <Select
          value={state.categoryId ?? "all"}
          onValueChange={(v) => handleCategorySelect(v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <span>🏪</span>
                <span>All Categories</span>
              </div>
            </SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICONS[c.name] ?? "💼"}</span>
                  <span>{c.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop category pills */}
      <div className="mb-4 hidden flex-wrap gap-2 md:mb-8 md:flex">
        <CategoryButton
          icon="🏪"
          label="All Categories"
          active={!state.categoryId}
          onClick={() => handleCategorySelect("all")}
        />
        {categories.map((c) => (
          <CategoryButton
            key={c.id}
            icon={CATEGORY_ICONS[c.name] ?? "💼"}
            label={c.name}
            active={state.categoryId === c.id}
            onClick={() =>
              handleCategorySelect(state.categoryId === c.id ? "all" : c.id)
            }
          />
        ))}
      </div>

      {/* Search and filter/sort row */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between md:gap-4">
        <div className="relative flex w-full max-w-sm items-center">
          <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
          <Input
            value={localQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search services..."
            className="pr-8 pl-9"
          />
          {localQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="hover:bg-muted absolute right-2 flex h-5 w-5 items-center justify-center rounded-full"
            >
              <X className="text-muted-foreground h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
          {/* Filters Sheet */}
          <Sheet
            open={filtersOpen}
            onOpenChange={(open) => {
              if (open) {
                syncDraftFromState();
                setFiltersOpen(true);
              } else {
                handleFiltersCancel();
              }
            }}
          >
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 bg-transparent"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2">{activeFiltersCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filter Services</SheetTitle>
                <SheetDescription>
                  Narrow down your search with these filters
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6 px-4">
                {/* Price Range */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Price Range</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="svc-min-price" className="text-xs">
                        Min
                      </Label>
                      <Input
                        id="svc-min-price"
                        value={draftMinPrice}
                        onChange={(e) => setDraftMinPrice(e.target.value)}
                        placeholder="$0"
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="svc-max-price" className="text-xs">
                        Max
                      </Label>
                      <Input
                        id="svc-max-price"
                        value={draftMaxPrice}
                        onChange={(e) => setDraftMaxPrice(e.target.value)}
                        placeholder="$500"
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Pricing Type */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Pricing Type</h3>
                  <div className="space-y-2">
                    {(["hourly", "fixed"] as const).map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`svc-pricing-${type}`}
                          checked={draftPricingTypes.includes(type)}
                          onCheckedChange={() => handlePricingTypeToggle(type)}
                        />
                        <label
                          htmlFor={`svc-pricing-${type}`}
                          className="text-sm leading-none capitalize peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {type === "hourly" ? "Hourly" : "Fixed price"}
                        </label>
                      </div>
                    ))}
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

          {/* Sort Popover */}
          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 bg-transparent"
              >
                {SORT_LABELS[state.sortBy]}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-1">
                {(
                  Object.entries(SORT_LABELS) as [ServiceSortKey, string][]
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      updateState({ sortBy: key });
                      setSortOpen(false);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
