"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import { PaymentsPageError } from "./payments-page-error";
import { OwnerSection } from "./owner-section";
import { InitiateStripeOnboarding } from "./initiate-stripe-onboarding";
import { ConnectOnboarding } from "./connect-onboarding";
import { useAccountSession } from "../hooks/use-stripe-connect";
import { PaymentExplainerSection } from "./payment-explainer-section";
import type { OnboardingStatus } from "../lib/payout-readiness";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
}

interface EarningsAndPayoutsPageClientProps {
  isOnboarded: boolean;
  /** Validated dashboard path to navigate to after JIT onboarding completes. */
  returnTo?: string;
  /** Derived readiness from the server; required when `returnTo` is set. */
  onboardingStatus?: OnboardingStatus;
}

/** JIT-mode copy variants by readiness state. */
const JIT_COPY: Record<
  Exclude<OnboardingStatus, "verified">,
  { heading: string; description: string }
> = {
  not_started: {
    heading: "Connect your payout account to accept this booking",
    description:
      "Add a bank account so you can get paid. We use Stripe to keep your info secure.",
  },
  pending: {
    heading: "Finish connecting your payout account",
    description: "A few more details and you're ready to accept bookings.",
  },
  restricted: {
    heading: "Your payout account needs more information",
    description:
      "Stripe needs an update before bookings can be accepted on your account.",
  },
};

/**
 * Client component for the earnings and payouts page.
 * Dispatches to the JIT onboarding view when arriving from the accept flow,
 * otherwise renders the full earnings dashboard.
 */
export function EarningsAndPayoutsPageClient({
  isOnboarded,
  returnTo,
  onboardingStatus,
}: EarningsAndPayoutsPageClientProps) {
  if (returnTo) {
    return (
      <JitOnboardingView
        returnTo={returnTo}
        onboardingStatus={onboardingStatus}
      />
    );
  }
  return <EarningsAndPayoutsDashboardView isOnboarded={isOnboarded} />;
}

/**
 * JIT mode: render only the onboarding form with context copy. On completion,
 * navigate to the originating booking.
 */
function JitOnboardingView({
  returnTo,
  onboardingStatus,
}: {
  returnTo: string;
  onboardingStatus?: OnboardingStatus;
}) {
  const router = useRouter();
  const status =
    onboardingStatus && onboardingStatus !== "verified"
      ? onboardingStatus
      : "not_started";
  const copy = JIT_COPY[status];
  return (
    <ConnectOnboarding
      heading={copy.heading}
      description={copy.description}
      fromJitAccept
      onComplete={() => router.push(returnTo)}
    />
  );
}

/**
 * Default dashboard view — Stripe Connect initialization plus the owner section.
 */
function EarningsAndPayoutsDashboardView({
  isOnboarded,
}: {
  isOnboarded: boolean;
}) {
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
