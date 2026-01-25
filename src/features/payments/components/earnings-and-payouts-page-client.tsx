"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import { PaymentsPageSkeleton } from "./payments-page-skeleton";
import { PaymentsPageError } from "./payments-page-error";
import { OwnerSection } from "./owner-section";
import { InitiateStripeOnboarding } from "./initiate-stripe-onboarding";
import { useAccountSession } from "../hooks/use-stripe-connect";

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
  const queryClient = useQueryClient();
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Fetch account session using React Query
  const {
    data: clientSecret,
    isLoading,
    error: accountSessionError,
    refetch: refetchAccountSession,
  } = useAccountSession("payments", isOnboarded);

  // Initialize Stripe Connect when client secret is available
  useEffect(() => {
    if (!isOnboarded || !clientSecret) return;

    const initializeConnect = async () => {
      try {
        // Fetch client secret function - called by Connect components when needed
        // Use ensureQueryData to get cached or refetch if needed
        const fetchClientSecret = async (): Promise<string> => {
          return queryClient.ensureQueryData({
            queryKey: ["account-session", "payments"],
            queryFn: async (): Promise<string> => {
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
            },
          });
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
      }
    };

    initializeConnect();
  }, [isOnboarded, clientSecret, queryClient]);

  // Show loading state while fetching account session
  if (isLoading) {
    return <PaymentsPageSkeleton />;
  }

  // Show error state if account session failed or initialization failed
  const error = accountSessionError || initError;
  if (error) {
    return (
      <PaymentsPageError
        error={error instanceof Error ? error.message : String(error)}
        onRetry={() => {
          setInitError(null);
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
    </div>
  );
}
