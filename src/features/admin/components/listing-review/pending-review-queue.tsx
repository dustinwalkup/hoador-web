"use client";

import { useState } from "react";
import { ListingReviewCard } from "./listing-review-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePendingReviews } from "@/features/admin/hooks/use-pending-reviews";

const ITEMS_PER_PAGE = 20;

export function PendingReviewQueue() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePendingReviews(page, ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>Listings awaiting admin approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>Listings awaiting admin approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive py-12 text-center">
            <p>Failed to load pending reviews</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>Listings awaiting admin approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-12 text-center">
            <p>No listings pending review</p>
            <p className="mt-2 text-sm">
              All listings have been reviewed and processed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>
            {data.pagination.total} listing
            {data.pagination.total !== 1 ? "s" : ""} awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.data.map((listing) => (
              <ListingReviewCard key={listing.id} listing={listing} />
            ))}
          </div>

          {/* Pagination Controls */}
          {data.pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t pt-6">
              <div className="text-muted-foreground text-sm">
                Page {data.pagination.page} of {data.pagination.totalPages} (
                {data.pagination.total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!data.pagination.hasPrev || page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.pagination.hasNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
