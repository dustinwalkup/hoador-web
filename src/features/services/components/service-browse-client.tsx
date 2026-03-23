"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ServiceListingBrowseItem } from "@/dal/service-listing.dal";
import { formatServiceUsd } from "@/features/services/lib/service-labels";
import { cn } from "@/lib/utils";

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

function ListingCard({ item }: { item: ServiceListingBrowseItem }) {
  const name = providerName(item.providerFirstName, item.providerLastName);
  const initials =
    `${item.providerFirstName?.[0] ?? ""}${item.providerLastName?.[0] ?? ""}` ||
    "?";
  const rating =
    item.aggregateRating != null && Number(item.aggregateRating) > 0
      ? Number.parseFloat(item.aggregateRating)
      : null;
  const isNew = !rating && item.reviewCount === 0;

  return (
    <Link
      href={`/dashboard/services/listings/${item.id}`}
      className="bg-card hover:border-primary/50 flex flex-col rounded-lg border p-4 shadow-sm transition-colors"
    >
      <div className="mb-3 flex items-start gap-3">
        <Avatar className="size-10">
          <AvatarImage src={item.providerProfileImageUrl ?? undefined} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-sm">{name}</p>
          <h3 className="leading-snug font-semibold">{item.title}</h3>
        </div>
      </div>
      <div className="text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {item.pricingType === "hourly"
            ? `${formatServiceUsd(item.price)}/hr`
            : formatServiceUsd(item.price)}{" "}
          · {item.pricingType === "hourly" ? "Hourly" : "Fixed"}
        </span>
        {isNew ? (
          <Badge variant="secondary">New</Badge>
        ) : (
          <span className="text-foreground">
            ★ {rating?.toFixed(1)} ({item.reviewCount})
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Category tabs + responsive grid for HOA service marketplace browse.
 */
export function ServiceBrowseClient({
  listings,
  categories,
  canCreateListing,
}: ServiceBrowseClientProps) {
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    if (categoryId === "all") return listings;
    return listings.filter((l) => l.categoryId === categoryId);
  }, [listings, categoryId]);

  return (
    <div className="space-y-6">
      <Tabs
        value={categoryId}
        onValueChange={(v) => setCategoryId(v as typeof categoryId)}
        className="w-full"
      >
        <TabsList className="no-scrollbar h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="all" className="shrink-0">
            All
          </TabsTrigger>
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="shrink-0">
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
          <Briefcase className="mx-auto mb-3 size-10 opacity-40" />
          <p className="text-foreground mb-4 text-lg font-medium">
            No services available in your community yet
          </p>
          {canCreateListing ? (
            <Button asChild>
              <Link href="/dashboard/services/listings/create">
                Create a listing
              </Link>
            </Button>
          ) : (
            <p className="text-sm">
              Complete Stripe Connect onboarding under Payments → Earnings to
              offer services here.
            </p>
          )}
        </div>
      ) : (
        <div className={cn("grid gap-4 sm:grid-cols-2", "lg:grid-cols-3")}>
          {filtered.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
