import Link from "next/link";
import { Package, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PublicListingNotFound() {
  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card className="text-center">
        <CardHeader>
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Package className="text-muted-foreground h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Listing Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The listing you&apos;re looking for doesn&apos;t exist or may have
            been removed.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/explore">Explore Listings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
