"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OnboardingTipsFloat,
  TipsList,
  type OnboardingTip,
} from "./onboarding-tips-float";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
}

const ONBOARDING_TIPS: OnboardingTip[] = [
  { label: 'Select "Individual"', detail: "" },
  { label: "Use hoador.com", detail: "for website" },
  { label: "Enter your legal name", detail: "(matches your ID)" },
  { label: "SSN + DOB are required", detail: "(secure verification)" },
  { label: "Use a bank account", detail: "in your name" },
];

interface ConnectOnboardingProps {
  onComplete?: () => void;
  /** Card title; defaults to "Set up payouts to start earning". */
  heading?: string;
  /** Card description; defaults to "Secure Stripe setup. Takes ~2 minutes.". */
  description?: string;
  /**
   * When true, the completion call tells the server the user arrived from the
   * just-in-time accept flow so it can emit a `connect_onboarding_completed_from_accept`
   * log event. Defaults to false (regular dashboard onboarding).
   */
  fromJitAccept?: boolean;
}

export function ConnectOnboarding({
  onComplete,
  heading,
  description,
  fromJitAccept,
}: ConnectOnboardingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [showFloat, setShowFloat] = useState(false);
  const tipsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = tipsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloat(!entry.isIntersecting),
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [connectInstance]);

  const handleComplete = async () => {
    // Update user status in database
    try {
      const response = await fetch("/api/stripe/update-onboarding-status", {
        method: "POST",
        ...(fromJitAccept && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromJitAccept: true }),
        }),
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>{heading ?? "Set up payouts to start earning"}</CardTitle>
          <CardDescription>
            {description ?? "Secure Stripe setup. Takes ~2 minutes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={tipsRef}>
            <Alert className="bg-primary/10">
              <Info className="size-4" />
              <AlertTitle className="text-primary font-semibold">
                Quick tips - keep these handy
              </AlertTitle>
              <AlertDescription className="mt-2">
                <TipsList tips={ONBOARDING_TIPS} />
              </AlertDescription>
            </Alert>
          </div>
          <p className="text-muted-foreground text-sm">
            Info must match your ID to avoid payout delays.
          </p>
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding onExit={handleComplete} />
          </ConnectComponentsProvider>
        </CardContent>
      </Card>
      <OnboardingTipsFloat tips={ONBOARDING_TIPS} visible={showFloat} />
    </>
  );
}
