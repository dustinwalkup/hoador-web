"use client";

import { useEffect, useState } from "react";
import { usePayment, PaymentIframe, PaymentProvider } from "@/services/stripe";
import { Button } from "@/components/ui/button";

const RETURN_URL = process.env.NEXT_PUBLIC_PAYMENT_CONFIRMATION_URL;
const CREATE_PAYMENT_INTENT_URL = "/api/create-payment-intent";

export function PaymentForm({ amount }: { amount: number }) {
  return (
    <div>
      <PaymentProvider amount={amount}>
        <CCForm amount={amount} />
      </PaymentProvider>
    </div>
  );
}

function CCForm({ amount }: { amount: number }) {
  const { stripe, elements } = usePayment();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      const response = await fetch(CREATE_PAYMENT_INTENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: Math.round(amount * 100) }),
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    };
    createPaymentIntent();
  }, [amount]);

  if (!RETURN_URL) {
    throw new Error("NEXT_PUBLIC_PAYMENT_CONFIRMATION_URL is not set");
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (!stripe || !elements || !clientSecret) {
      setIsLoading(false);
      return;
    }

    const { error: submitError } = await elements.submit();

    if (submitError) {
      console.error(submitError);
      setErrorMessage(submitError.message);
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: RETURN_URL,
        payment_method_data: {
          billing_details: {
            address: {
              country: "US",
            },
          },
        },
      },
    });

    if (confirmError) {
      console.error(confirmError);
      setErrorMessage(confirmError.message);
    }

    setIsLoading(false);
  };

  if (!clientSecret || !stripe || !elements) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md py-10">
      <form onSubmit={handleSubmit}>
        {clientSecret && stripe && elements && (
          <>
            <PaymentIframe />
            <Button
              className="mt-4 w-full"
              type="submit"
              disabled={isLoading || !stripe}
            >
              {isLoading ? "Processing..." : "Pay"}
            </Button>
          </>
        )}
        {errorMessage && <div>{errorMessage}</div>}
      </form>
    </div>
  );
}
