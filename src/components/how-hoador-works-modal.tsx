"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ownerProviderSteps,
  renterClientSteps,
} from "@/components/how-hoador-works-data";
import { HowPaymentsWorkModal } from "@/components/payments/how-payments-work-modal";

export interface HowHoadorWorksModalProps {
  /** Custom control for the dialog trigger; defaults to a text-style button */
  trigger?: ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Controlled open change */
  onOpenChange?: (open: boolean) => void;
  /** Extra classes on the dialog content panel */
  className?: string;
}

/**
 * Condensed “How Hoador works” explainer in a dialog. Same 3+3 steps as the
 * public `/how-it-works` page, with a link to the full guide in a new tab.
 */
export function HowHoadorWorksModal({
  trigger,
  open,
  onOpenChange,
  className,
}: HowHoadorWorksModalProps) {
  const controlled = open !== undefined && onOpenChange !== undefined;

  return (
    <Dialog {...(controlled ? { open, onOpenChange } : {})}>
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button
              type="button"
              variant="link"
              className="text-muted-foreground h-auto p-0 text-xs font-normal underline-offset-4"
            >
              How does Hoador work?
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        className={cn(
          "scrollbar-hover-reveal max-h-[85vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto sm:max-w-3xl",
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle>How Hoador works</DialogTitle>
          <DialogDescription>
            Rent anything from neighbors. Offer what you own or do.
          </DialogDescription>
        </DialogHeader>
        <HowHoadorWorksModalBody />
      </DialogContent>
    </Dialog>
  );
}

/** Scrollable body used inside the dialog. */
function HowHoadorWorksModalBody() {
  return (
    <div className="text-muted-foreground space-y-6 pt-2 text-sm">
      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="how-modal-renters-heading"
          className="space-y-3"
        >
          <h3
            id="how-modal-renters-heading"
            className="text-foreground text-sm font-semibold"
          >
            For renters &amp; clients
          </h3>
          <ol className="space-y-3">
            {renterClientSteps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <step.Icon
                      className="text-foreground h-4 w-4 shrink-0"
                      aria-hidden
                    />
                    <span className="text-foreground font-medium">
                      {step.title}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section
          aria-labelledby="how-modal-owners-heading"
          className="space-y-3"
        >
          <h3
            id="how-modal-owners-heading"
            className="text-foreground text-sm font-semibold"
          >
            For owners &amp; providers
          </h3>
          <ol className="space-y-3">
            {ownerProviderSteps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <step.Icon
                      className="text-foreground h-4 w-4 shrink-0"
                      aria-hidden
                    />
                    <span className="text-foreground font-medium">
                      {step.title}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <div className="space-y-2 border-t pt-4 text-center">
        <HowPaymentsWorkModal className="text-sm" />
        <p>
          <a
            href="/how-it-works"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            See full guide →
          </a>
        </p>
      </div>
    </div>
  );
}
