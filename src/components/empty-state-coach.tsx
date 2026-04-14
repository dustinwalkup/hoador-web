import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CtaProps {
  label: string;
  href: string;
}

interface EmptyStateCoachProps {
  /** Lucide icon component to display in the colored circle */
  icon: LucideIcon;
  /** Tailwind class(es) for the icon color, e.g. "text-teal-400" */
  iconColor: string;
  /** Tailwind class(es) for the icon circle background, e.g. "bg-teal-500/10" */
  iconBg: string;
  /** Short, action-oriented headline */
  headline: string;
  /** One-sentence supporting description */
  description: string;
  /** Primary CTA rendered as a filled Button */
  cta?: CtaProps;
  /** Secondary CTA rendered as a plain link */
  secondaryCta?: CtaProps;
  /** Optional custom secondary action (e.g. modal trigger) shown below the primary CTA */
  secondarySlot?: ReactNode;
  className?: string;
}

/**
 * Reusable empty-state coaching component.
 * Renders an icon in a soft colored circle, a headline, description, and optional CTAs.
 * Purely presentational - no data fetching.
 *
 * @param icon - Lucide icon for the soft circle
 * @param iconColor - Tailwind classes for icon color
 * @param iconBg - Tailwind classes for the circle background
 * @param headline - Short headline
 * @param description - Supporting line
 * @param cta - Optional primary button link
 * @param secondaryCta - Optional text link below
 * @param secondarySlot - Optional custom secondary control (e.g. modal trigger)
 * @param className - Optional wrapper classes
 */
export function EmptyStateCoach({
  icon: Icon,
  iconColor,
  iconBg,
  headline,
  description,
  cta,
  secondaryCta,
  secondarySlot,
  className,
}: EmptyStateCoachProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-8 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          iconBg,
        )}
      >
        <Icon className={cn("h-7 w-7", iconColor)} aria-hidden />
      </div>

      <p className="mt-4 text-sm font-medium">{headline}</p>

      <p className="text-muted-foreground mt-1 max-w-xs text-sm">
        {description}
      </p>

      {cta && (
        <Button asChild size="default" className="mt-4">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}

      {secondaryCta && (
        <Link
          href={secondaryCta.href}
          className="text-muted-foreground coarse:min-h-11 hover:text-foreground mt-2 text-xs underline-offset-4 hover:underline"
        >
          {secondaryCta.label}
        </Link>
      )}

      {secondarySlot && (
        <div className="mt-3 flex w-full justify-center">{secondarySlot}</div>
      )}
    </div>
  );
}
