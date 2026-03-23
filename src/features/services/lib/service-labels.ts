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

/** USD formatting for service prices stored as numeric strings. */
export function formatServiceUsd(amount: string | number): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}
