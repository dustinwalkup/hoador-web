"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function GarageLoadingSkeleton() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GarageFiltersLoadingSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-[140px]" />
        <Skeleton className="h-9 w-[160px]" />
        <Skeleton className="h-9 w-[140px]" />
      </div>
    </div>
  );
}
