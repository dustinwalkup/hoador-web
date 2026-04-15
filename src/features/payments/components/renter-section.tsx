"use client";

import Link from "next/link";
import { CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type RentalPayment, type PaginatedResult } from "@/dal/types";
import { PaymentHistoryItem } from "./payment-history-item";
import { EmptyStateCoach } from "@/components/empty-state-coach";

interface RenterSectionProps {
  paymentHistory: RentalPayment[];
  pagination: PaginatedResult<RentalPayment>["pagination"];
  currentPage: number;
}

/**
 * Renter section component displaying payment history
 * Shows all rental payments made by the user (as renter)
 */
export function RenterSection({
  paymentHistory,
  pagination,
  currentPage,
}: RenterSectionProps) {
  const { total, totalPages, limit } = pagination;
  const offset = (currentPage - 1) * limit;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>
              All payments you&apos;ve made for rentals
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {paymentHistory.length === 0 ? (
            <EmptyStateCoach
              icon={CreditCard}
              iconColor="text-muted-foreground"
              iconBg="bg-muted"
              headline="No payments yet"
              description="When you rent something, your payment history will appear here"
              cta={{ label: "Browse listings", href: "/dashboard/explore" }}
            />
          ) : (
            <>
              <div className="divide-y">
                {paymentHistory.map((payment) => (
                  <PaymentHistoryItem key={payment.id} payment={payment} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 space-y-4">
                  <div className="text-muted-foreground text-center text-sm sm:text-left">
                    Showing {offset + 1} to {Math.min(offset + limit, total)} of{" "}
                    {total} payments
                  </div>

                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <Link
                              key={pageNum}
                              href={{
                                pathname: "/dashboard/payments",
                                query: {
                                  page: pageNum.toString(),
                                },
                              }}
                            >
                              <Button
                                variant={
                                  pageNum === currentPage
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                className="min-w-[40px]"
                              >
                                {pageNum}
                              </Button>
                            </Link>
                          );
                        },
                      )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={{
                          pathname: "/dashboard/payments",
                          query: {
                            page: Math.max(1, currentPage - 1).toString(),
                          },
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          className="flex items-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Previous</span>
                        </Button>
                      </Link>

                      <Link
                        href={{
                          pathname: "/dashboard/payments",
                          query: {
                            page: Math.min(
                              totalPages,
                              currentPage + 1,
                            ).toString(),
                          },
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages}
                          className="flex items-center gap-2"
                        >
                          <span className="hidden sm:inline">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
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
