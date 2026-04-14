"use client";

import { useEffect, useState, useRef } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import { PaymentsPageError } from "./payments-page-error";
import { OwnerSection } from "./owner-section";
import { InitiateStripeOnboarding } from "./initiate-stripe-onboarding";
import { useAccountSession } from "../hooks/use-stripe-connect";
import { PaymentExplainerSection } from "./payment-explainer-section";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
}

interface EarningsAndPayoutsPageClientProps {
  isOnboarded: boolean;
}

/**
 * Client component for the earnings and payouts page
 * Handles Stripe Connect initialization and renders owner section
 */
export function EarningsAndPayoutsPageClient({
  isOnboarded,
}: EarningsAndPayoutsPageClientProps) {
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const isInitializingRef = useRef(false);

  // Use account session hook only for error checking, not to block initialization
  // We initialize Connect immediately when onboarded - don't wait for this hook
  const { error: accountSessionError, refetch: refetchAccountSession } =
    useAccountSession("payments", isOnboarded);

  // Initialize Stripe Connect immediately when user is onboarded
  // Don't wait for useAccountSession - this speeds up initialization significantly
  useEffect(() => {
    if (!isOnboarded || isInitializingRef.current) return;

    const initializeConnect = async () => {
      // Prevent double initialization (e.g., from React Strict Mode)
      isInitializingRef.current = true;

      try {
        // Fetch client secret function - called by Connect components when needed
        // Always create a fresh account session - Stripe handles session management
        // Each component may need its own session, so we create fresh ones
        const fetchClientSecret = async (): Promise<string> => {
          const response = await fetch(
            "/api/stripe/create-account-session?mode=payments",
            {
              method: "POST",
            },
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errorMessage =
              errorData.error || "Failed to create account session";

            // Provide user-friendly messages for specific error cases
            if (response.status === 401) {
              errorMessage = "Please sign in to access payment settings.";
            } else if (response.status === 404) {
              errorMessage =
                "Payment account not found. Please complete onboarding.";
            } else if (response.status >= 500) {
              errorMessage = "Server error. Please try again later.";
            }

            throw new Error(errorMessage);
          }

          const data = await response.json();

          if (!data.clientSecret) {
            throw new Error("Invalid response from server");
          }

          return data.clientSecret;
        };

        const connect = await loadConnectAndInitialize({
          publishableKey: STRIPE_PUBLISHABLE_KEY!,
          fetchClientSecret,
        });

        setConnectInstance(connect);
        setInitError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to initialize Stripe Connect";
        setInitError(errorMessage);
        isInitializingRef.current = false;
      }
    };

    initializeConnect();

    // Cleanup function to reset initialization flag if component unmounts
    return () => {
      isInitializingRef.current = false;
    };
  }, [isOnboarded]);

  // Show error state if account session failed or initialization failed
  const error = accountSessionError || initError;
  if (error) {
    return (
      <PaymentsPageError
        error={error instanceof Error ? error.message : String(error)}
        onRetry={() => {
          setInitError(null);
          isInitializingRef.current = false; // Reset to allow reinitialization
          refetchAccountSession();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {isOnboarded && connectInstance ? (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <OwnerSection />
        </ConnectComponentsProvider>
      ) : (
        <InitiateStripeOnboarding />
      )}
      <PaymentExplainerSection activeTab="owner" />
    </div>
  );
}
