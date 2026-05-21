"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OnboardingStatus } from "@/features/payments/lib/payout-readiness";

type GatedStatus = Exclude<OnboardingStatus, "verified">;

const COPY: Record<
  GatedStatus,
  { title: string; description: string; cta: string }
> = {
  not_started: {
    title: "Connect your payout account",
    description:
      "Before you can accept this booking, connect a payout account so we can pay you when the renter is charged.",
    cta: "Connect now",
  },
  pending: {
    title: "Finish setting up your payout account",
    description:
      "Your payout setup isn't finished yet. Complete a few more details so we can pay you when this booking is charged.",
    cta: "Finish setup",
  },
  restricted: {
    title: "Your payout account needs an update",
    description:
      "Your payout account is missing information. Update it so this booking can be accepted and you can get paid.",
    cta: "Update now",
  },
};

export interface PayoutSetupRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onboardingStatus: GatedStatus;
}

export function PayoutSetupRequiredDialog({
  open,
  onOpenChange,
  onboardingStatus,
}: PayoutSetupRequiredDialogProps) {
  const router = useRouter();
  const { title, description, cta } = COPY[onboardingStatus];

  const handleConnect = () => {
    const returnTo = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    router.push(
      `/dashboard/payments/earnings-and-payouts?returnTo=${returnTo}`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button type="button" onClick={handleConnect}>
            {cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
