import type { ServiceBooking } from "@/db/schemas/services.schema";

/** Human-readable label for service booking status badges. */
export function serviceBookingStatusLabel(
  status: ServiceBooking["status"],
): string {
  const map: Record<ServiceBooking["status"], string> = {
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    payment_failed: "Payment Failed",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * Badge variant + optional classes for dashboard booking cards (incoming/outgoing).
 * Keeps status visually distinct: pending (neutral), payment failed (amber), etc.
 */
export function serviceBookingStatusBadgeProps(
  status: ServiceBooking["status"],
): {
  variant: BadgeVariant;
  className?: string;
} {
  switch (status) {
    case "pending":
      return {
        variant: "outline",
        className:
          "border-sky-500/45 bg-sky-500/12 text-sky-950 dark:border-sky-400/50 dark:bg-sky-500/15 dark:text-sky-100",
      };
    case "accepted":
      return { variant: "default" };
    case "declined":
      return { variant: "destructive" };
    case "payment_failed":
      return {
        variant: "outline",
        className:
          "border-red-500/45 bg-red-500/12 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-100",
      };
    case "completed":
      return {
        variant: "outline",
        className:
          "border-emerald-600/55 bg-emerald-500/12 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100",
      };
    case "cancelled":
      return {
        variant: "outline",
        className: "text-muted-foreground border-border bg-muted/40",
      };
    default:
      return { variant: "outline" };
  }
}

/** USD formatting for service prices stored as numeric strings. */
export function formatServiceUsd(amount: string | number): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}
