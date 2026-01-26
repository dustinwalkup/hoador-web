"use client";

import { useState } from "react";
import Link from "next/link";
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
import { useDisputes } from "@/features/disputes/hooks/use-disputes";
import { DisputeStatusBadge } from "@/features/disputes/components/dispute-status-badge";
import {
  formatDisputeId,
  formatDisputeIdentifier,
} from "@/features/disputes/utils/format-dispute-id";

const ITEMS_PER_PAGE = 20;

/**
 * Get reason code label for display
 */
function getReasonCodeLabel(code: string): string {
  const labels: Record<string, string> = {
    damage: "Damage",
    non_delivery: "Non-Delivery",
    quality_issue: "Quality Issue",
    cancellation: "Cancellation",
    payment_issue: "Payment Issue",
    other: "Other",
  };
  return labels[code] || code;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DisputeReviewHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "resolved" | "closed"
  >("all");

  const { data, isLoading, error } = useDisputes({
    page,
    limit: ITEMS_PER_PAGE,
  });

  // Filter for resolved/closed disputes
  let resolvedDisputes =
    data?.data.filter(
      (d) => d.status === "resolved" || d.status === "closed",
    ) || [];

  // Apply status filter
  if (statusFilter === "resolved") {
    resolvedDisputes = resolvedDisputes.filter((d) => d.status === "resolved");
  } else if (statusFilter === "closed") {
    resolvedDisputes = resolvedDisputes.filter((d) => d.status === "closed");
  }

  // Calculate pagination for filtered results
  const totalResolved = resolvedDisputes.length;
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDisputes = resolvedDisputes.slice(startIndex, endIndex);
  const totalPages = Math.ceil(totalResolved / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>Previously resolved disputes</CardDescription>
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
          <CardDescription>Previously resolved disputes</CardDescription>
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
              <CardDescription>Previously resolved disputes</CardDescription>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as "all" | "resolved" | "closed");
                setPage(1); // Reset to first page when filter changes
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedDisputes.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>No review history found</p>
              <p className="mt-2 text-sm">
                {statusFilter === "all"
                  ? "No disputes have been resolved yet."
                  : `No ${statusFilter} disputes found.`}
              </p>
            </div>
          ) : (
            <>
              <div className="text-muted-foreground mb-4 text-sm">
                Showing {paginatedDisputes.length} of {totalResolved} dispute
                {totalResolved !== 1 ? "s" : ""}
              </div>
              <div className="space-y-4">
                {paginatedDisputes.map((dispute) => {
                  const disputeIdentifier = formatDisputeIdentifier(
                    dispute.referenceNumber,
                    dispute.rental?.listing?.name,
                  );

                  return (
                    <Link
                      key={dispute.id}
                      href={`/dashboard/disputes/${dispute.id}`}
                      className="block"
                    >
                      <Card className="hover:bg-accent transition-colors">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <DisputeStatusBadge status={dispute.status} />
                                <span className="text-muted-foreground font-mono text-sm">
                                  {formatDisputeId(dispute.referenceNumber)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">
                                  {disputeIdentifier}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                  {getReasonCodeLabel(dispute.reasonCode)}
                                </p>
                              </div>
                              <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
                                <span>
                                  Created: {formatDate(dispute.createdAt)}
                                </span>
                                {dispute.resolvedAt && (
                                  <span>
                                    Resolved: {formatDate(dispute.resolvedAt)}
                                  </span>
                                )}
                                {dispute.resolutionOutcome && (
                                  <span className="text-green-600 dark:text-green-400">
                                    Outcome:{" "}
                                    {dispute.resolutionOutcome.replace(
                                      /_/g,
                                      " ",
                                    )}
                                  </span>
                                )}
                              </div>
                              {dispute.resolutionReason && (
                                <p className="text-muted-foreground line-clamp-2 text-sm">
                                  {dispute.resolutionReason}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t pt-6">
                  <div className="text-muted-foreground text-sm">
                    Page {page} of {totalPages} ({totalResolved} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages}
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
