"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ServiceListingBrowseItem } from "@/dal/service-listing.dal";
import { useServiceBrowseFilters } from "@/features/services/hooks/use-service-browse-filters";
import { cn } from "@/lib/utils";
import { EmptyStateNeedCTA } from "@/features/neighborhood-needs/components/empty-state-need-cta";
import { ServiceBrowseFilters } from "./service-browse-filters";
import { ListingCard } from "./listing-card";

interface CategoryOption {
  id: string;
  name: string;
}

interface ServiceBrowseClientProps {
  listings: ServiceListingBrowseItem[];
  categories: CategoryOption[];
  canCreateListing: boolean;
}

function providerName(first: string | null, last: string | null): string {
  const parts = [first, last].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Provider";
}

/**
 * Category filters, search, sort, and responsive grid for HOA service marketplace browse.
 * Filter/sort state is managed via URL search params (shareable links).
 */
export function ServiceBrowseClient({
  listings,
  categories,
  canCreateListing,
}: ServiceBrowseClientProps) {
  const { state, updateState } = useServiceBrowseFilters();

  const filtered = useMemo(() => {
    let result = listings;

    // 1. Category
    if (state.categoryId) {
      result = result.filter((l) => l.categoryId === state.categoryId);
    }

    // 2. Search (title + provider name)
    const q = (state.query ?? "").trim().toLowerCase();
    if (q) {
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          providerName(l.providerFirstName, l.providerLastName)
            .toLowerCase()
            .includes(q),
      );
    }

    // 3. Price range
    const min = Number.parseFloat(state.minPrice);
    const max = Number.parseFloat(state.maxPrice);
    if (!Number.isNaN(min)) {
      result = result.filter((l) => Number.parseFloat(String(l.price)) >= min);
    }
    if (!Number.isNaN(max)) {
      result = result.filter((l) => Number.parseFloat(String(l.price)) <= max);
    }

    // 4. Pricing type
    if (state.pricingTypes.length > 0) {
      result = result.filter((l) => state.pricingTypes.includes(l.pricingType));
    }

    // 5. Sort
    result = [...result].sort((a, b) => {
      if (state.sortBy === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (state.sortBy === "price_asc" || state.sortBy === "price_desc") {
        const pa = Number.parseFloat(String(a.price));
        const pb = Number.parseFloat(String(b.price));
        return state.sortBy === "price_asc" ? pa - pb : pb - pa;
      }
      if (state.sortBy === "rating_desc") {
        const ra = a.aggregateRating
          ? Number.parseFloat(a.aggregateRating)
          : -1;
        const rb = b.aggregateRating
          ? Number.parseFloat(b.aggregateRating)
          : -1;
        return rb - ra;
      }
      return 0;
    });

    return result;
  }, [listings, state]);

  const hasActiveFilters = Boolean(
    state.query ||
    state.categoryId ||
    state.minPrice ||
    state.maxPrice ||
    state.pricingTypes.length > 0 ||
    state.sortBy !== "newest",
  );

  return (
    <div className="space-y-6">
      <ServiceBrowseFilters categories={categories} />

      {filtered.length === 0 ? (
        <div className="space-y-6">
          <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
            <Briefcase className="mx-auto mb-3 size-10 opacity-40" />
            <p className="text-foreground mb-4 text-lg font-medium">
              {listings.length === 0
                ? "No services available in your community yet"
                : "No services match your search"}
            </p>
            {listings.length === 0 && canCreateListing ? (
              <Button asChild>
                <Link href="/dashboard/services/listings/create">
                  Create a listing
                </Link>
              </Button>
            ) : listings.length === 0 && !canCreateListing ? (
              <p className="text-sm">
                Complete Stripe Connect onboarding under Payments → Earnings to
                offer services here.
              </p>
            ) : hasActiveFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  updateState({
                    query: undefined,
                    categoryId: undefined,
                    minPrice: "",
                    maxPrice: "",
                    pricingTypes: [],
                    sortBy: "newest",
                  })
                }
              >
                Clear filters
              </Button>
            ) : null}
          </div>
          <Separator />
          <EmptyStateNeedCTA
            type="service"
            categoryId={state.categoryId ?? undefined}
          />
        </div>
      ) : (
        <div
          className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3")}
        >
          {filtered.map((item) => (
            <ListingCard key={item.id} listing={item} />
          ))}
        </div>
      )}
    </div>
  );
}
