import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ExplorePageSkeleton() {
  return (
    <div>
      {/* Category buttons skeleton */}
      <div className="mb-10 flex items-center gap-2">
        <Skeleton className="h-16 w-25" />
        <Skeleton className="h-16 w-25" />
        <Skeleton className="h-16 w-25" />
        <Skeleton className="h-16 w-25" />
        <Skeleton className="h-16 w-[129px]" />
        <Skeleton className="h-16 w-25" />
        <Skeleton className="h-16 w-25" />
        <Skeleton className="h-16 w-25" />
        <Skeleton className="h-16 w-[121px]" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-7 flex items-center justify-between">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-[93px]" />
          <Skeleton className="h-9 w-[155px]" />
          <Skeleton className="h-9 w-25" />
        </div>
      </div>

      {/* Tools grid skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden pt-0">
            <Skeleton className="h-[206px] w-full" />
            <CardContent className="px-4 pt-5">
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton className="mb-2 h-4 w-1/2" />
              <Skeleton className="mb-6 h-4 w-1/4" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-[118px]" />
                <Skeleton className="h-8 w-[118px]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
