"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ConnectOnboarding } from "@/features/users/components/connect-onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface OnboardingBannerProps {
  hasListings: boolean;
  isOnboarded: boolean;
}

export function OnboardingBanner({
  hasListings,
  isOnboarded,
}: OnboardingBannerProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (isOnboarded) {
    return null;
  }

  if (showOnboarding) {
    return (
      <div className="mb-6">
        <ConnectOnboarding
          onComplete={() => {
            setShowOnboarding(false);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Payment Setup Required
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        {hasListings
          ? "You have listings but haven't completed payment setup. Complete Stripe onboarding to receive payments from rentals."
          : "Complete Stripe onboarding to start listing items and receiving payments from rentals."}
        <div className="mt-4">
          <Button
            onClick={() => setShowOnboarding(true)}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700"
          >
            Complete Payment Setup
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
