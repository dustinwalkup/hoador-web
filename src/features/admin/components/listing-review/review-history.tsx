"use client";

import { useState } from "react";
import { ListingReviewCard } from "./listing-review-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useReviewHistory } from "@/features/admin/hooks/use-review-history";

const ITEMS_PER_PAGE = 20;

export function ReviewHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "approved" | "rejected"
  >("all");

  const { data, isLoading, error } = useReviewHistory(
    statusFilter,
    page,
    ITEMS_PER_PAGE,
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>Previously reviewed listings</CardDescription>
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
          <CardTitle>Review History</CardTitle>
          <CardDescription>Previously reviewed listings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive py-12 text-center">
            <p>Failed to load review history</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review History</CardTitle>
              <CardDescription>Previously reviewed listings</CardDescription>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as "all" | "approved" | "rejected");
                setPage(1); // Reset to first page when filter changes
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!data || data.data.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>No review history found</p>
              <p className="mt-2 text-sm">
                {statusFilter === "all"
                  ? "No listings have been reviewed yet."
                  : `No ${statusFilter} listings found.`}
              </p>
            </div>
          ) : (
            <>
              <div className="text-muted-foreground mb-4 text-sm">
                Showing {data.data.length} of {data.pagination.total} listing
                {data.pagination.total !== 1 ? "s" : ""}
              </div>
              <div className="space-y-6">
                {data.data.map((listing) => (
                  <ListingReviewCard
                    key={listing.id}
                    listing={listing}
                    showReviewMetadata={true}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {data.pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t pt-6">
                  <div className="text-muted-foreground text-sm">
                    Page {data.pagination.page} of {data.pagination.totalPages}{" "}
                    ({data.pagination.total} total)
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
