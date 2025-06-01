import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <Skeleton className="mb-6 h-10 w-96" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-64" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
