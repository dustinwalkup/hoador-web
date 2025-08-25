"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error("STRIPE_PUBLISHABLE_KEY is not set");
}

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

export function PaymentProvider({
  amount,
  children,
}: {
  amount: number;
  children: React.ReactNode;
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: Math.round(amount * 100),
        currency: "usd",
      }}
    >
      {children}
    </Elements>
  );
}
