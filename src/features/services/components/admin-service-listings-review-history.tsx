"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatServiceUsd } from "@/features/services/lib/service-labels";
import { useServiceReviewHistory } from "@/features/admin/hooks/use-service-review-history";
import {
  OwnerInformation,
  type AdminOwnerInformationRating,
} from "@/features/admin/components/listing-review/owner-information";
import { ReviewHistoryMetadata } from "@/features/admin/components/listing-review/review-history-metadata";
import { sanitizeForDisplay } from "@/lib/utils/sanitize-client";
import { formatActorName } from "@/lib/utils";
import { formatDateTimeLocal } from "@/lib/utils/date.utils";

type ServiceReviewHistoryStatusFilter = "all" | "approved" | "rejected";

const ITEMS_PER_PAGE = 10;

export function AdminServiceListingsReviewHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<ServiceReviewHistoryStatusFilter>("all");

  const { data, isLoading, error } = useServiceReviewHistory(
    statusFilter,
    page,
    ITEMS_PER_PAGE,
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>
            Previously reviewed service listings
          </CardDescription>
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
          <CardDescription>
            Previously reviewed service listings
          </CardDescription>
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

  const listings = data?.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Review History</CardTitle>
              <CardDescription>
                Previously reviewed service listings
              </CardDescription>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as ServiceReviewHistoryStatusFilter);
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
          {listings.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>No review history found</p>
              <p className="mt-2 text-sm">
                {statusFilter === "all"
                  ? "No service listings have been reviewed yet."
                  : `No ${statusFilter} service listings found.`}
              </p>
            </div>
          ) : (
            <>
              <div className="text-muted-foreground mb-4 text-sm">
                Showing {listings.length} of {data?.pagination.total} service
                listing{data?.pagination.total === 1 ? "" : "s"}
              </div>
              <div className="space-y-4">
                {listings.map((listing) => {
                  const priceText =
                    listing.pricingType === "hourly"
                      ? `${formatServiceUsd(listing.price)}/hr`
                      : formatServiceUsd(listing.price);

                  const statusBadge =
                    listing.status === "active" ? (
                      <Badge variant="default">Approved</Badge>
                    ) : listing.status === "inactive" ? (
                      <Badge variant="secondary">Approved (Inactive)</Badge>
                    ) : (
                      <Badge variant="destructive">Rejected</Badge>
                    );

                  return (
                    <div
                      key={listing.id}
                      className="flex flex-col gap-4 rounded-lg border p-4"
                    >
                      <div className="w-full">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{listing.title}</p>
                            {statusBadge}
                          </div>

                          <p className="text-muted-foreground text-sm">
                            {listing.category.name} · {priceText}
                          </p>

                          <div className="bg-muted/50 w-full rounded-lg border p-4">
                            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                              <ReviewHistoryMetadata
                                submittedAt={listing.createdAt}
                                reviewedBy={listing.reviewedBy}
                                reviewedAt={listing.reviewedAt}
                              />
                            </div>

                            {listing.reviewEvents &&
                              listing.reviewEvents.length > 0 && (
                                <div className="mt-4 space-y-3">
                                  {listing.reviewEvents.map((event) => (
                                    <div
                                      key={event.id}
                                      className="bg-background rounded-md border p-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                              variant="secondary"
                                              className="capitalize"
                                            >
                                              {event.eventType ===
                                              "provider_resubmitted"
                                                ? "Resubmitted"
                                                : event.eventType}
                                            </Badge>
                                            <span className="text-muted-foreground text-xs">
                                              {formatDateTimeLocal(
                                                event.createdAt,
                                              )}
                                            </span>
                                          </div>

                                          <div className="text-muted-foreground text-xs">
                                            By {formatActorName(event.actor)}
                                          </div>
                                        </div>
                                      </div>

                                      {event.note &&
                                        event.note.trim().length > 0 && (
                                          <div className="mt-2 text-sm whitespace-pre-wrap">
                                            <span className="font-medium">
                                              Note:
                                            </span>{" "}
                                            {sanitizeForDisplay(event.note)}
                                          </div>
                                        )}
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        </div>

                        {/* Keep top-right quadrant reserved for future actions/labels */}
                        <div className="self-start" />
                      </div>

                      <div className="w-full">
                        <OwnerInformation
                          owner={{
                            firstName: listing.provider.firstName,
                            lastName: listing.provider.lastName,
                            profileImageUrl: listing.provider.profileImageUrl,
                            isVerified: listing.provider.isVerified,
                            email: listing.provider.email,
                            createdAt: listing.provider.createdAt,
                            otherListingsCount:
                              listing.provider.otherListingsCount,
                          }}
                          rating={
                            {
                              averageRating: listing.provider.averageRating,
                              totalCount: listing.provider.totalReviews,
                              totalCountNoun: "review",
                            } satisfies AdminOwnerInformationRating
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {data && data.pagination.totalPages > 1 && (
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
