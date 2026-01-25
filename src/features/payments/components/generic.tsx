import * as React from "react";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenericCardIconProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Generic card icon fallback for unknown brands
 */
export function GenericCardIcon({ className, style }: GenericCardIconProps) {
  // For generic cards, we'll use a simple card shape with a muted background
  return (
    <div
      className={cn(
        "bg-muted flex items-center justify-center rounded p-2",
        className,
      )}
      style={style}
    >
      <CreditCard className="text-muted-foreground h-full w-full" />
    </div>
  );
}
