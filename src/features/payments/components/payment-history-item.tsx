"use client";

import Link from "next/link";
import { Calendar, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils/date.utils";
import { type RentalPayment } from "@/dal/types";
import { Badge } from "@/components/ui/badge";

interface PaymentHistoryItemProps {
  payment: RentalPayment;
}

/**
 * Formats a currency amount as USD
 */
const formatCurrency = (amount: string | number): string => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

/**
 * Gets badge variant based on payment status
 */
const getStatusVariant = (
  status: RentalPayment["status"],
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "succeeded":
    case "completed":
      return "default";
    case "pending":
    case "processing":
      return "secondary";
    case "failed":
      return "destructive";
    case "refunded":
      return "outline";
    default:
      return "outline";
  }
};

/**
 * Formats status text for display
 */
const formatStatus = (status: RentalPayment["status"]): string => {
  switch (status) {
    case "succeeded":
      return "Paid";
    case "completed":
      return "Completed";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
};

/**
 * Individual payment history item component
 * Displays payment information with link to rental details
 */
export function PaymentHistoryItem({ payment }: PaymentHistoryItemProps) {
  return (
    <div className="group border-border hover:bg-muted/30 relative -mx-6 border-b px-6 py-4 transition-all duration-200 first:pt-0 last:border-b-0 hover:shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Link
                href={`/dashboard/rental/${payment.rentalId}`}
                className="hover:text-primary font-medium transition-all duration-200 hover:underline"
              >
                {payment.listingName}
              </Link>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                <div className="group-hover:text-foreground/80 flex items-center gap-1 transition-colors duration-200">
                  <Calendar className="h-3 w-3 transition-transform duration-200 group-hover:scale-110" />
                  <span>
                    {formatDate(payment.rentalStartDate, "MMM d")} -{" "}
                    {formatDate(payment.rentalEndDate, "MMM d")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-end gap-4 sm:flex-col">
          <div className="text-right">
            <div className="group-hover:text-primary font-semibold transition-colors duration-200">
              {formatCurrency(payment.amount)}
            </div>
            <div className="text-muted-foreground group-hover:text-foreground/70 text-xs transition-colors duration-200">
              Paid {formatDate(payment.paymentDate, "PPP")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={getStatusVariant(payment.status)}
              className="transition-all duration-200 group-hover:scale-105"
            >
              {formatStatus(payment.status)}
            </Badge>
            <Link
              href={`/dashboard/rental/${payment.rentalId}`}
              className="text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110"
              aria-label={`View rental details for ${payment.listingName}`}
            >
              <ExternalLink className="h-4 w-4 transition-transform duration-200" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
