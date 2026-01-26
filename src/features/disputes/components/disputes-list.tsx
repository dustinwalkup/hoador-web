"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
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
import { useDisputes, type UseDisputesFilters } from "../hooks";
import { DisputeStatusBadge } from "./dispute-status-badge";
import type {
  DisputeStatus,
  DisputeRole,
  DisputeReasonCode,
} from "@/dal/types";

interface DisputesListProps {
  isAdmin?: boolean;
}

/**
 * Client component for displaying disputes list
 * Supports filtering by status, role (for users), and reason code (for admins)
 * Includes pagination
 */
export function DisputesList({ isAdmin = false }: DisputesListProps) {
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "all">(
    "all",
  );
  const [roleFilter, setRoleFilter] = useState<DisputeRole | "all">("all");
  const [reasonCodeFilter, setReasonCodeFilter] = useState<
    DisputeReasonCode | "all"
  >("all");
  const [page, setPage] = useState(1);
  const limit = 12;

  // Build filters for API call
  const filters: UseDisputesFilters = {
    page,
    limit,
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(isAdmin
      ? reasonCodeFilter !== "all" && { reasonCode: reasonCodeFilter }
      : roleFilter !== "all" && { role: roleFilter }),
  };

  const { data, isLoading, error } = useDisputes(filters);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getReasonCodeLabel = (code: DisputeReasonCode) => {
    const labels: Record<DisputeReasonCode, string> = {
      damage: "Damage",
      non_delivery: "Non-Delivery",
      quality_issue: "Quality Issue",
      cancellation: "Cancellation",
      payment_issue: "Payment Issue",
      other: "Other",
    };
    return labels[code] || code;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground text-center">
            Loading disputes...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive text-center">
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            <p>Failed to load disputes</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const disputes = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter disputes by status and other criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as DisputeStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="evidence_requested">
                  Evidence Requested
                </SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            {!isAdmin && (
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value as DisputeRole | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="renter">As Renter</SelectItem>
                  <SelectItem value="provider">As Provider</SelectItem>
                </SelectContent>
              </Select>
            )}

            {isAdmin && (
              <Select
                value={reasonCodeFilter}
                onValueChange={(value) => {
                  setReasonCodeFilter(value as DisputeReasonCode | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Reasons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="non_delivery">Non-Delivery</SelectItem>
                  <SelectItem value="quality_issue">Quality Issue</SelectItem>
                  <SelectItem value="cancellation">Cancellation</SelectItem>
                  <SelectItem value="payment_issue">Payment Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disputes List */}
      <Card>
        <CardHeader>
          <CardTitle>Disputes</CardTitle>
          <CardDescription>
            {pagination
              ? `Showing ${(page - 1) * limit + 1}-${Math.min(
                  page * limit,
                  pagination.total,
                )} of ${pagination.total} disputes`
              : "No disputes found"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground">No disputes found</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {statusFilter !== "all" ||
                roleFilter !== "all" ||
                reasonCodeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "You don't have any disputes yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute) => {
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
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t pt-6">
              <div className="text-muted-foreground text-sm">
                Page {pagination.page} of {pagination.totalPages} (
                {pagination.total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev || page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNext}
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
