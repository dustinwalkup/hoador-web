"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectOnboarding } from "@/features/payments/components/connect-onboarding";

interface InitiateStripeOnboardingProps {
  onStartOnboarding?: () => void;
}

/**
 * Preview component for non-onboarded users
 * Shows disabled/grayed-out preview of components with CTA to complete onboarding
 */
export function InitiateStripeOnboarding({
  onStartOnboarding,
}: InitiateStripeOnboardingProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleStartOnboarding = () => {
    setShowOnboarding(true);
    onStartOnboarding?.();
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Refresh the page to show the full owner section
    window.location.reload();
  };

  // If user clicked to start onboarding, show the onboarding component
  if (showOnboarding) {
    return <ConnectOnboarding onComplete={handleOnboardingComplete} />;
  }

  // Show preview state with disabled components
  return (
    <div className="space-y-6">
      <Card className="border-primary/50 bg-primary/5">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <CardHeader className="w-full flex-1">
            <CardTitle>Set up payouts to start earning</CardTitle>
            <CardDescription>
              Secure Stripe setup. Takes ~2 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button
              onClick={handleStartOnboarding}
              size="lg"
              className="w-full"
            >
              Continue to Stripe
            </Button>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
