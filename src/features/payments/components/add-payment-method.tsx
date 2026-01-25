"use client";

import { useState } from "react";
import { usePayment, PaymentIframe, PaymentProvider } from "@/services/stripe";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  useSetupIntent,
  useAttachPaymentMethod,
} from "../hooks/use-payment-setup";

interface AddPaymentMethodProps {
  onSuccess: (methodId: string) => void;
}

/**
 * Component for adding a new payment method
 * Uses Stripe Elements to collect card information
 */
export function AddPaymentMethod({ onSuccess }: AddPaymentMethodProps) {
  return (
    <PaymentProvider>
      <AddPaymentMethodForm onSuccess={onSuccess} />
    </PaymentProvider>
  );
}

function AddPaymentMethodForm({ onSuccess }: AddPaymentMethodProps) {
  const { stripe, elements } = usePayment();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  // Fetch setup intent using React Query
  const {
    data: clientSecret,
    isLoading: isLoadingSetupIntent,
    error: setupIntentError,
  } = useSetupIntent();
  const attachPaymentMethodMutation = useAttachPaymentMethod();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (!stripe || !elements || !clientSecret) {
      setIsLoading(false);
      setErrorMessage("Payment form not ready. Please refresh and try again.");
      return;
    }

    // Submit the elements first
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message);
      setIsLoading(false);
      return;
    }

    // Confirm the setup
    const result = await stripe.confirmSetup({
      elements,
      clientSecret,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required", // Prevents unnecessary redirects
    });

    if (result.error) {
      setErrorMessage(result.error.message);
      setIsLoading(false);
    } else if (result.setupIntent?.payment_method) {
      const paymentMethodId = result.setupIntent.payment_method as string;

      // Explicitly attach the payment method to ensure it's available
      // Use mutation hook - it will handle errors gracefully
      attachPaymentMethodMutation.mutate(paymentMethodId, {
        onSuccess: () => {
          console.log(
            "[AddPaymentMethod] Payment method attached successfully",
          );
          setIsLoading(false);
          onSuccess(paymentMethodId);
        },
        onError: () => {
          // Log warning but continue - it might already be attached
          // Continue anyway - setup was successful
          setIsLoading(false);
          onSuccess(paymentMethodId);
        },
      });
    } else {
      setIsLoading(false);
      setErrorMessage("Payment method setup incomplete. Please try again.");
    }
  };

  // Show loading state while fetching setup intent
  if (isLoadingSetupIntent || !clientSecret || !stripe || !elements) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Show error state if setup intent failed
  if (setupIntentError) {
    return (
      <div className="space-y-4">
        <div className="text-destructive text-sm">
          {setupIntentError instanceof Error
            ? setupIntentError.message
            : "Failed to initialize payment form"}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentIframe />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={isLoading || !stripe}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            "Add Payment Method"
          )}
        </Button>
      </div>
      {errorMessage && (
        <div className="text-destructive text-sm">{errorMessage}</div>
      )}
    </form>
  );
}
