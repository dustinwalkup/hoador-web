"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SecurityDepositLineProps {
  amount: number;
  className?: string;
}

/**
 * Displays a "Refundable security deposit hold" line item with an info icon and tooltip.
 * Renders nothing when amount is zero or not set.
 */
export function SecurityDepositLine({
  amount,
  className,
}: SecurityDepositLineProps) {
  if (amount <= 0 || !Number.isFinite(amount)) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <span className="flex items-center gap-1 text-xs">
        Security deposit hold
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground h-3.5 w-3.5 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-40">
              <p>
                Held on your payment method and not included in Total due now.
                It is only charged for damage or policy violations; otherwise it
                is released when the rental is complete.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
      <span>${amount.toFixed(2)}</span>
    </div>
  );
}
