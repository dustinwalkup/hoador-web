"use client";

import { useEffect, useState } from "react";
import { usePayment, PaymentIframe, PaymentProvider } from "@/services/stripe";
import { Button } from "@/components/ui/button";

interface PaymentMethod {
  id: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
}

const CREATE_SETUP_INTENT_URL = "/api/create-setup-intent";
const GET_PAYMENT_METHODS_URL = "/api/get-payment-methods";

export function PaymentForm({
  onSuccess,
}: {
  onSuccess: (methodId: string) => void;
}) {
  return (
    <div>
      <PaymentProvider>
        <CCForm onSuccess={onSuccess} />
      </PaymentProvider>
    </div>
  );
}

function CCForm({ onSuccess }: { onSuccess: (methodId: string) => void }) {
  const { stripe, elements } = usePayment();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<PaymentMethod[]>([]);
  const [showNewCardForm, setShowNewCardForm] = useState(false);

  useEffect(() => {
    // Load saved payment methods first
    const loadSavedMethods = async () => {
      const response = await fetch(GET_PAYMENT_METHODS_URL);
      const data = await response.json();
      setSavedMethods(data.paymentMethods || []);

      // If no saved methods, show new card form immediately
      if (data.paymentMethods?.length === 0) {
        setShowNewCardForm(true);
        // Create setup intent for new card
        const setupResponse = await fetch(CREATE_SETUP_INTENT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const setupData = await setupResponse.json();
        setClientSecret(setupData.clientSecret);
      }
    };

    loadSavedMethods();
  }, []);

  const handleUseExistingMethod = (methodId: string) => {
    onSuccess(methodId);
  };

  const handleAddNewCard = async () => {
    setShowNewCardForm(true);
    if (!clientSecret) {
      const response = await fetch(CREATE_SETUP_INTENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (!stripe || !elements || !clientSecret) {
      setIsLoading(false);
      return;
    }

    // Submit the elements first
    const { error: submitError } = await elements.submit();
    if (submitError) {
      console.error("Submit error:", submitError);
      setErrorMessage(submitError.message);
      setIsLoading(false);
      return;
    }

    // confirm the setup
    const result = await stripe.confirmSetup({
      elements,
      clientSecret,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required", // Prevents unnecessary redirects
    });

    console.log("result", result);

    if (result.error) {
      console.error("ERROR", result.error);
      setErrorMessage(result.error.message);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      onSuccess(result.setupIntent.payment_method as string);
    }
  };

  // Show saved payment methods if they exist
  if (savedMethods.length > 0 && !showNewCardForm) {
    return (
      <div className="mx-auto max-w-md py-6">
        <h3 className="mb-4 text-lg font-semibold">Select Payment Method</h3>

        {savedMethods.map((method: PaymentMethod) => (
          <div
            key={method.id}
            className="mb-3 cursor-pointer rounded-lg border p-4 hover:bg-gray-50"
            onClick={() => handleUseExistingMethod(method.id)}
          >
            <div className="flex items-center justify-between">
              <span>•••• •••• •••• {method.last4}</span>
              <span className="text-sm text-gray-600">
                {method.brand.toUpperCase()} {method.exp_month}/
                {method.exp_year}
              </span>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={handleAddNewCard}
        >
          Add New Card
        </Button>
      </div>
    );
  }
  // Show new card form
  if (!clientSecret || !stripe || !elements) {
    return (
      <div className="mx-auto max-w-md py-6">
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6">
      {savedMethods.length > 0 && (
        <Button
          variant="ghost"
          onClick={() => setShowNewCardForm(false)}
          className="mb-4"
        >
          ← Back to saved cards
        </Button>
      )}

      <form onSubmit={handleSubmit}>
        <PaymentIframe />
        <Button
          className="mt-4 w-full"
          type="submit"
          disabled={isLoading || !stripe}
        >
          {isLoading ? "Processing..." : "Continue"}
        </Button>
        {errorMessage && (
          <div className="mt-2 text-sm text-red-600">{errorMessage}</div>
        )}
      </form>
    </div>
  );
}
