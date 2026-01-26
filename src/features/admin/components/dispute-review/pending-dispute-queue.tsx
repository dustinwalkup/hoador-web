"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

export function PendingDisputeQueue() {
  const [page, setPage] = useState(1);

  // Get disputes in pending states (open, evidence_requested, under_review)
  // For admin, we need to filter by status - we'll get all and filter client-side
  // or we can make multiple queries. Let's use a single query with status filter
  const { data, isLoading, error } = useDisputes({
    page,
    limit: ITEMS_PER_PAGE,
    // Note: We can't filter by multiple statuses easily, so we'll fetch all and filter
    // Or we can modify the API to accept multiple statuses. For now, let's fetch all pending
  });

  // Filter for pending disputes
  const pendingDisputes =
    data?.data.filter(
      (d) =>
        d.status === "open" ||
        d.status === "evidence_requested" ||
        d.status === "under_review",
    ) || [];

  // Calculate pagination for filtered results
  const totalPending = pendingDisputes.length;
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDisputes = pendingDisputes.slice(startIndex, endIndex);
  const totalPages = Math.ceil(totalPending / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>Disputes awaiting admin review</CardDescription>
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
          <CardDescription>Disputes awaiting admin review</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive py-12 text-center">
            <p>Failed to load pending disputes</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paginatedDisputes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>Disputes awaiting admin review</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-12 text-center">
            <p>No disputes pending review</p>
            <p className="mt-2 text-sm">
              All disputes have been reviewed and processed.
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
            {totalPending} dispute{totalPending !== 1 ? "s" : ""} awaiting
            review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedDisputes.map((dispute) => {
              const rentalInfo = dispute.rental
                ? `Rental #${dispute.rental.requestId || dispute.rental.id.slice(0, 8)}`
                : "Unknown Rental";

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
                              {dispute.id.slice(0, 8)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{rentalInfo}</p>
                            <p className="text-muted-foreground text-sm">
                              {getReasonCodeLabel(dispute.reasonCode)}
                            </p>
                          </div>
                          <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
                            <span>
                              Created: {formatDate(dispute.createdAt)}
                            </span>
                            <span>
                              Updated: {formatDate(dispute.updatedAt)}
                            </span>
                            {dispute.evidenceDeadline && (
                              <span className="text-orange-600 dark:text-orange-400">
                                Deadline: {formatDate(dispute.evidenceDeadline)}
                              </span>
                            )}
                          </div>
                          {dispute.description && (
                            <p className="text-muted-foreground line-clamp-2 text-sm">
                              {dispute.description}
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
                Page {page} of {totalPages} ({totalPending} total)
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
        </CardContent>
      </Card>
    </div>
  );
}
