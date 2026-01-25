import { useQuery } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { paymentKeys } from "./use-payment-methods";

/**
 * Hook for fetching setup intent client secret
 * Setup intents are single-use, so we don't cache them
 */
export function useSetupIntent() {
  return useQuery({
    queryKey: ["setup-intent"],
    queryFn: async (): Promise<string> => {
      const response = await fetch("/api/create-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create setup intent");
      }

      const data = await response.json();
      return data.clientSecret;
    },
    staleTime: 0, // Setup intents are single-use, shouldn't be cached
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for attaching a payment method to the customer
 * Invalidates payment methods query on success
 */
export function useAttachPaymentMethod() {
  return useCreateMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch("/api/stripe/attach-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to attach payment method");
      }

      return response.json();
    },
    // No success message - handled by parent component
    invalidateQueryKeys: [paymentKeys.all],
  });
}
