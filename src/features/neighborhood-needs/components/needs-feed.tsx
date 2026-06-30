"use client";

import { useState } from "react";
import { Loader2, HandHelping } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { EmptyStateCoach } from "@/components/empty-state-coach";
import {
  useNeedsFeed,
  type NeedsFeedFilters,
} from "@/features/neighborhood-needs/hooks/use-needs";
import { NeedCard } from "./need-card";
import { NeedFilters } from "./need-filters";

function NeedCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-auto space-y-2 pt-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    </Card>
  );
}

export function NeedsFeed() {
  const [filters, setFilters] = useState<NeedsFeedFilters>({ openOnly: true });

  const { data, isLoading, error } = useNeedsFeed(filters);

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 rounded-xl border px-4 py-3">
        <p className="text-destructive text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NeedFilters filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NeedCardSkeleton key={i} />
          ))}
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((need) => (
              <NeedCard key={need.id} need={need} />
            ))}
          </div>
          {data.pagination.total > data.data.length && (
            <p className="text-muted-foreground text-center text-sm">
              Showing {data.data.length} of {data.pagination.total} needs
            </p>
          )}
        </>
      ) : (
        <div className="flex min-h-64 items-center justify-center">
          <EmptyStateCoach
            icon={HandHelping}
            iconColor="text-muted-foreground"
            iconBg="bg-muted"
            headline="No needs found"
            description="Your neighbors haven't posted any needs yet, or none match your filters."
            cta={{ label: "Post a need", href: "/dashboard/needs/new" }}
          />
        </div>
      )}

      {!isLoading && data?.data && data.data.length > 0 && (
        <div className="flex justify-center pb-2">
          <Loader2 className="text-muted-foreground hidden h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
