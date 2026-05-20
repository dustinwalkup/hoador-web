"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingStatus } from "@/features/payments/lib/payout-readiness";

const DISMISS_KEY = "payout-readiness-banner-dismissed";
const CTA_HREF = "/dashboard/payments/earnings-and-payouts";

type CopyVariant = Exclude<OnboardingStatus, "verified">;

const COPY: Record<CopyVariant, { message: string; cta: string }> = {
  not_started: {
    message:
      "Connect your payout account so you can accept bookings the moment a request comes in.",
    cta: "Connect now",
  },
  pending: {
    message: "Finish setting up your payout account to accept bookings.",
    cta: "Finish setup",
  },
  restricted: {
    message:
      "Your payout account needs an update. Bookings can't be accepted until this is fixed.",
    cta: "Update now",
  },
};

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getDismissedSnapshot(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// Treat the banner as dismissed during SSR — it will hydrate to the real
// value after mount via useSyncExternalStore.
function getDismissedServerSnapshot(): boolean {
  return true;
}

function dismissBanner() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // best effort — sessionStorage can throw in privacy modes
  }
  for (const listener of listeners) listener();
}

export interface PayoutReadinessBannerProps {
  onboardingStatus: CopyVariant;
  className?: string;
}

export function PayoutReadinessBanner({
  onboardingStatus,
  className,
}: PayoutReadinessBannerProps) {
  const dismissed = useSyncExternalStore(
    subscribe,
    getDismissedSnapshot,
    getDismissedServerSnapshot,
  );

  if (dismissed) return null;

  const { message, cta } = COPY[onboardingStatus];

  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-amber-900 dark:text-amber-100">{message}</p>
        <div className="mt-3">
          <Button asChild size="sm">
            <Link href={CTA_HREF}>{cta}</Link>
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss payout setup reminder"
        onClick={dismissBanner}
        className="-mt-1 -mr-1 h-7 w-7 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
