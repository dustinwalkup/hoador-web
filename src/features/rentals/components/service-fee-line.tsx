"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ServiceFeeLineProps {
  amount: number;
  className?: string;
}

/**
 * Displays a "Service fee" line item with an info icon and tooltip explaining payment processing costs.
 */
export function ServiceFeeLine({ amount, className }: ServiceFeeLineProps) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <span className="flex items-center gap-1">
        <span className="text-xs">Service fee</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground h-3.5 w-3.5 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="">
              <p>This fee covers Stripe&apos;s payment processing costs.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
      <span>${amount.toFixed(2)}</span>
    </div>
  );
}
