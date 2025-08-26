"use client";

import { useEffect, useState } from "react";
import { usePayment, PaymentIframe, PaymentProvider } from "@/services/stripe";
import { Button } from "@/components/ui/button";

const CREATE_SETUP_INTENT_URL = "/api/create-setup-intent";

export function PaymentForm({
  amount,
  onSuccess,
}: {
  amount: number;
  onSuccess: (methodId: string) => void;
}) {
  return (
    <div>
      <PaymentProvider amount={amount}>
        <CCForm onSuccess={onSuccess} />
      </PaymentProvider>
    </div>
  );
}

function CCForm({ onSuccess }: { onSuccess: (methodId: string) => void }) {
  const { stripe, elements, CardElement } = usePayment();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    // Load the client secret for the setup intent
    const createSetupIntent = async () => {
      const response = await fetch(CREATE_SETUP_INTENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    };
    createSetupIntent();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    // If the stripe instance is not found, return
    if (!stripe || !elements || !clientSecret) {
      setIsLoading(false);
      return;
    }

    // Get the card element
    const cardElement = elements.getElement(CardElement);

    // Confirm the card setup
    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardElement!,
      },
    });

    if (result.error) {
      console.error("ERROR", result.error);
      setErrorMessage(result.error.message);
    } else {
      setIsLoading(false);
      onSuccess(result.setupIntent.payment_method as string);
    }
  };

  // If the client secret, stripe instance, or card elements are not found, show a loading spinner
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
              {isLoading ? "Processing..." : "Store Payment Method"}
            </Button>
          </>
        )}
        {errorMessage && <div>{errorMessage}</div>}
      </form>
    </div>
  );
}
