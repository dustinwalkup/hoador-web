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
 * Displays a "Security deposit" line item with an info icon and tooltip.
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
      <span className="flex items-center gap-1">
        Security deposit
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground h-3.5 w-3.5 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Held on your payment method. It will only be charged if there is
                damage to the item; otherwise it will be released when the
                rental is complete.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
      <span>${amount.toFixed(2)}</span>
    </div>
  );
}
