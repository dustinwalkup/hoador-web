import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ToolCardSkeleton() {
  return (
    <Card className="overflow-hidden pt-0 pb-2">
      <div className="relative">
        <Skeleton className="aspect-[4/3] w-full" />

        {/* Heart button skeleton */}
        <Skeleton className="absolute top-2 right-2 h-8 w-8 rounded-full" />
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex grow items-start justify-between">
          <Skeleton className="mr-2 h-4 w-3/4" />
          <Skeleton className="h-4 w-16" />
        </div>

        <div className="mb-2 flex items-center gap-1">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-20" />
        </div>

        <div className="mb-4 flex items-center gap-1">
          <Skeleton className="h-4 w-3" />
          <Skeleton className="h-4 w-20" />
        </div>

        <div className="mb-3 flex items-center gap-1">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="ml-1 h-3 w-8" />
          <Skeleton className="h-3 w-16" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}
