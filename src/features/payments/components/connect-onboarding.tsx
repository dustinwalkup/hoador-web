"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
}

interface ConnectOnboardingProps {
  onComplete?: () => void;
}

export function ConnectOnboarding({ onComplete }: ConnectOnboardingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);

  useEffect(() => {
    // Initialize Stripe Connect
    const initializeConnect = async () => {
      try {
        // Fetch client secret function - called by Connect components when needed
        const fetchClientSecret = async (): Promise<string> => {
          const response = await fetch("/api/stripe/create-account-session", {
            method: "POST",
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "Failed to create account session",
            );
          }

          const data = await response.json();
          return data.clientSecret;
        };

        const connect = await loadConnectAndInitialize({
          publishableKey: STRIPE_PUBLISHABLE_KEY!,
          fetchClientSecret,
        });
        setConnectInstance(connect);
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing Stripe Connect:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize");
        setIsLoading(false);
      }
    };

    initializeConnect();
  }, []);

  const handleComplete = async () => {
    // Update user status in database
    try {
      const response = await fetch("/api/stripe/update-onboarding-status", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to update onboarding status");
      }

      onComplete?.();
    } catch (err) {
      console.error("Error updating onboarding status:", err);
      setError("Failed to complete onboarding. Please refresh the page.");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!connectInstance) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600">
            Loading onboarding form...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Connect Setup Required</CardTitle>
        <CardDescription>
          Set up your payment account to list items and receive payouts from
          rentals. This process is secure and takes just a few minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <ConnectAccountOnboarding onExit={handleComplete} />
        </ConnectComponentsProvider>
      </CardContent>
    </Card>
  );
}
