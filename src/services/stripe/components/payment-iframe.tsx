"use client";

import { PaymentElement } from "@stripe/react-stripe-js";

export function PaymentIframe() {
  return (
    <PaymentElement
      options={{
        layout: "accordion", // Changed from "tabs" - tabs layout can show Link
        // Removed paymentMethodTypes - it's not a valid PaymentElement option
        // PaymentElement gets allowed methods from the SetupIntent configuration
        // Billing details will be collected automatically by Stripe
      }}
    />
  );
}
