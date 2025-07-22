import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RentalDetailLoading() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-row items-center justify-between gap-4">
          <Skeleton className="h-7 w-20" />

          <Skeleton className="h-7 w-24" />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-6 w-14" />
                </div>
              </CardContent>
            </Card>

            {/* Tool Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-32" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <Skeleton className="h-32 w-32 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-6 w-48" />
                    <div className="mb-4 grid grid-cols-2 gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="mb-4 h-16 w-full" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rental Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-28" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Skeleton className="mb-1 h-4 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div>
                    <Skeleton className="mb-1 h-4 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div>
                    <Skeleton className="mb-1 h-4 w-20" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div>
                    <Skeleton className="mb-1 h-4 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>

            {/* Messages Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="mb-2 flex items-center space-x-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-20" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>

            {/* Protection Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
