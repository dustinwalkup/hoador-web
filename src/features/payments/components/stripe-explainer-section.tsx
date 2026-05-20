"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

const STRIPE_TRUST_POINTS = [
  "Trusted by millions of businesses worldwide",
  "Encrypted & PCI-compliant",
  "Fast deposits to your bank account",
  "Identity verification helps protect the marketplace",
];

export function StripeExplainerSection() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-medium">
            Why am I asked for personal information?
          </span>
          {open ? (
            <ChevronUp className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 px-4 pb-4">
            <Separator />
            <p className="text-muted-foreground text-sm">
              Stripe is required to verify identity and banking details to
              comply with financial regulations and help prevent fraud. This is
              standard for marketplaces that support payouts.
            </p>
            <ul className="space-y-1.5">
              {STRIPE_TRUST_POINTS.map((point) => (
                <li
                  key={point}
                  className="text-muted-foreground flex gap-2 text-sm"
                >
                  <span className="text-primary mt-0.5 shrink-0">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
