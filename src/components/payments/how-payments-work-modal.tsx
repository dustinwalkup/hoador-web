"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface HowPaymentsWorkModalProps {
  /** Additional classes for the trigger link */
  className?: string;
}

/**
 * Inline link that opens a dialog explaining platform payments: when you are
 * charged, platform hold, 24-hour dispute window, payouts to owners/providers,
 * cancellation tiers, service fee, and rental deposit holds.
 *
 * @param className - Optional extra classes for the trigger link
 * @returns Dialog with trigger and educational content
 */
export function HowPaymentsWorkModal({ className }: HowPaymentsWorkModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-primary text-xs hover:underline",
            className,
          )}
        >
          Learn how payments work
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How payments work</DialogTitle>
          <DialogDescription>
            Straight answers on charges, timing, refunds, and deposits.
          </DialogDescription>
        </DialogHeader>
        <div className="text-muted-foreground space-y-4 text-sm">
          <section className="space-y-2">
            <h4 className="text-foreground font-medium">When you&apos;re charged</h4>
            <p>
              Your card is charged when the owner (for rentals) or provider (for
              services) <strong className="text-foreground font-medium">accepts</strong>{" "}
              your request—not when you send it. If they don&apos;t accept, you&apos;re
              never charged.
            </p>
          </section>
          <section className="space-y-2">
            <h4 className="text-foreground font-medium">Where your money sits</h4>
            <p>
              Once approved, your payment is held by the platform—not sent to the
              owner or provider yet. It stays there until the rental or service is
              complete and a short window for disputes passes.
            </p>
          </section>
          <section className="space-y-2">
            <h4 className="text-foreground font-medium">The 24-hour dispute window</h4>
            <p>
              After the owner confirms the tool is back (or the service is done),
              there&apos;s a <strong className="text-foreground font-medium">24-hour</strong>{" "}
              window for either side to flag a problem. No money moves during that
              window.
            </p>
            <p>
              Once 24 hours pass with no dispute, the payment is automatically
              released to the owner or provider.
            </p>
          </section>
          <section className="space-y-2">
            <h4 className="text-foreground font-medium">Cancellations</h4>
            <ul className="list-disc space-y-2 pl-4">
              <li>
                <span className="text-foreground font-medium">Before they accept:</span>{" "}
                no charge at all.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  After acceptance, 24+ hours before pickup:
                </span>{" "}
                full refund of the rental or service price. The service fee is not
                refunded.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  After acceptance, less than 24 hours before pickup (rentals):
                </span>{" "}
                50% refund of the rental price. The service fee is not refunded.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  If the owner or provider cancels on you:
                </span>{" "}
                full refund—rental or service price and service fee both come back.
              </li>
              <li>
                <span className="text-foreground font-medium">Active rentals:</span>{" "}
                cancellation isn&apos;t available.
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <h4 className="text-foreground font-medium">Service fee</h4>
            <p>
              The service fee covers payment processing (Stripe charges about 2.9% +
              $0.30 per transaction). You&apos;ll always see it broken out in the price
              summary before you confirm. It&apos;s not refunded if you cancel.
            </p>
          </section>
          <section className="space-y-2">
            <h4 className="text-foreground font-medium">Security deposit (rentals)</h4>
            <p>
              Some tools have a security deposit. This is an{" "}
              <strong className="text-foreground font-medium">authorization hold</strong>
              —no money leaves your account. It just reserves the funds temporarily.
            </p>
            <p>
              If there&apos;s no dispute after the rental, the hold is released
              automatically. You&apos;re only charged if a damage claim is filed and
              upheld during the dispute window.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
