"use client";

import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";

/**
 * Hook for interacting with Stripe.
 * @returns Stripe instance and elements.
 */
export function usePayment() {
  const stripe = useStripe();
  const elements = useElements();

  return { stripe, elements, CardElement };
}
