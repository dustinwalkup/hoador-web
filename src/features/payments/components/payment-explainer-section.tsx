"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { HowPaymentsWorkModal } from "@/components/payments/how-payments-work-modal";

const RENTER_BULLETS = [
  "You're only charged when the owner accepts your request - not before.",
  "If your request is declined or you cancel before acceptance, you won't be charged.",
  "Payment is processed securely through Stripe.",
];

const OWNER_BULLETS = [
  "For rentals: payment is released 24 hours after the tool is returned with no disputes.",
  "For services: payment is released when the service is marked complete.",
  "Funds arrive in your bank account in 1–2 business days via Stripe.",
  "A small service fee is deducted from each transaction before payout.",
];

const MD_UP_QUERY = "(min-width: 768px)";

function subscribeMdUp(onStoreChange: () => void) {
  const mql = window.matchMedia(MD_UP_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getMdUpSnapshot() {
  return window.matchMedia(MD_UP_QUERY).matches;
}

function getMdUpServerSnapshot() {
  return false;
}

interface PaymentExplainerSectionProps {
  activeTab: "owner" | "renter";
}

/**
 * Page-level explainer section for how Hoador payments work.
 * Collapsed by default on mobile, expanded on desktop.
 */
export function PaymentExplainerSection({
  activeTab,
}: PaymentExplainerSectionProps) {
  const isMdUp = useSyncExternalStore(
    subscribeMdUp,
    getMdUpSnapshot,
    getMdUpServerSnapshot,
  );
  /** When null, expanded/collapsed follows viewport (`isMdUp`). */
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [prevIsMdUp, setPrevIsMdUp] = useState(isMdUp);
  if (isMdUp !== prevIsMdUp) {
    setPrevIsMdUp(isMdUp);
    setOpenOverride(null);
  }
  const open = openOverride !== null ? openOverride : isMdUp;

  const isRenter = activeTab === "renter";
  const title = isRenter ? "How charges work" : "How payouts work";
  const bullets = isRenter ? RENTER_BULLETS : OWNER_BULLETS;
  const otherTitle = isRenter
    ? "For Owners & Providers"
    : "For Renters & Clients";
  const otherBullets = isRenter ? OWNER_BULLETS : RENTER_BULLETS;

  return (
    <Collapsible open={open} onOpenChange={setOpenOverride}>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-medium">{title}</span>
          {open ? (
            <ChevronUp className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 px-4 pb-4">
            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                {isRenter ? "For Renters & Clients" : "For Owners & Providers"}
              </h4>
              <ul className="space-y-1.5">
                {bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="text-muted-foreground flex gap-2 text-sm"
                  >
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">{otherTitle}</h4>
              <ul className="space-y-1.5">
                {otherBullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="text-muted-foreground flex gap-2 text-sm"
                  >
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="flex justify-center">
              <HowPaymentsWorkModal className="text-sm" />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
