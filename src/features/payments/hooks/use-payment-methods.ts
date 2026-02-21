import { useQuery } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";

// Query keys for consistent caching
export const paymentKeys = {
  all: ["payment-methods"] as const,
};

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string | null;
}

/**
 * Hook for fetching payment methods and the customer's default payment method.
 * Returns all saved payment methods and which one is set as default in Stripe.
 */
export function usePaymentMethods() {
  return useQuery({
    queryKey: paymentKeys.all,
    queryFn: async (): Promise<PaymentMethodsResponse> => {
      const response = await fetch("/api/get-payment-methods");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch payment methods");
      }

      const data = await response.json();
      return {
        paymentMethods: data.paymentMethods || [],
        defaultPaymentMethodId: data.defaultPaymentMethodId ?? null,
      };
    },
    staleTime: 1 * 60 * 1000, // 1 minute - user's own data
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for setting a payment method as default
 * Invalidates payment methods query on success
 */
export function useSetDefaultPaymentMethod() {
  return useCreateMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch("/api/stripe/set-default-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to set default payment method");
      }

      return response.json();
    },
    successMessage: "Default payment method updated",
    invalidateQueryKeys: [paymentKeys.all],
  });
}

/**
 * Hook for deleting a payment method
 * Invalidates payment methods query on success
 */
export function useDeletePaymentMethod() {
  return useCreateMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch(
        `/api/stripe/delete-payment-method?id=${paymentMethodId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete payment method");
      }

      return response.json();
    },
    successMessage: "Payment method removed",
    invalidateQueryKeys: [paymentKeys.all],
  });
}
