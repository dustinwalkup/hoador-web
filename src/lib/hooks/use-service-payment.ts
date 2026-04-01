import { useQuery } from "@tanstack/react-query";

import type {
  ServiceFinancialMetrics,
  ServicePaymentMetrics,
} from "@/dal/service-payment-lifecycle.dal";
import type { ServicePaymentLifecycleRecord } from "@/db/schemas/service-payment-lifecycle.schema";

export type ServicePaymentMetricsResponse = {
  paymentMetrics: ServicePaymentMetrics;
  financialMetrics: ServiceFinancialMetrics;
  days: number;
};

/**
 * Fetches service payment lifecycle for a booking detail view (requester/provider).
 */
export function useServicePaymentLifecycle(bookingId: string | null) {
  return useQuery<ServicePaymentLifecycleRecord>({
    queryKey: ["services", "booking", bookingId, "payment-lifecycle"],
    queryFn: async () => {
      if (!bookingId) throw new Error("bookingId required");

      const response = await fetch(
        `/api/services/bookings/${bookingId}/payment-lifecycle`,
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            "Failed to fetch payment lifecycle",
        );
      }

      return response.json();
    },
    enabled: Boolean(bookingId),
    staleTime: 30 * 1000,
  });
}

/**
 * Admin: aggregate service payment metrics and financial KPIs.
 */
export function useServicePaymentMetrics(days: number = 30) {
  return useQuery<ServicePaymentMetricsResponse>({
    queryKey: ["admin", "services", "payment-metrics", days],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("days", String(days));

      const response = await fetch(
        `/api/admin/services/payment-metrics?${params.toString()}`,
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            "Failed to fetch service payment metrics",
        );
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
