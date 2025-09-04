import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AddListingLoading() {
  return (
    <div className="container max-w-4xl py-6">
      <div className="mb-6">
        <Skeleton className="mb-4 h-10 w-20" />
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="mb-2 h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
      </div>

      {/* Progress Steps Skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="mt-2 text-center">
                  <Skeleton className="mb-1 h-4 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              {step < 4 && <Skeleton className="mx-4 h-0.5 w-16" />}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>

          <div className="flex justify-between pt-6">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-16" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
