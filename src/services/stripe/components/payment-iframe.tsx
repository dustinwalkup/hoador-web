"use client";

import { PaymentElement } from "@stripe/react-stripe-js";

export function PaymentIframe() {
  return (
    <PaymentElement
      options={{
        fields: {
          billingDetails: {
            address: {
              country: "never",
            },
          },
        },
      }}
    />
  );
}
