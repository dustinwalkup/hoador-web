"use client";

import { Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { EmptyStateCoach } from "@/components/empty-state-coach";
import { HowHoadorWorksModal } from "@/components/how-hoador-works-modal";
import { EmptyStateNeedCTA } from "@/features/neighborhood-needs/components/empty-state-need-cta";

interface ExplorePageEmptyWithGuideProps {
  basePath?: string;
}

/**
 * Explore no-results state with browse CTA and optional "how it works" modal link.
 */
export function ExplorePageEmptyWithGuide({
  basePath = "/dashboard/explore",
}: ExplorePageEmptyWithGuideProps) {
  return (
    <div className="flex min-h-100 flex-col items-center justify-center gap-6">
      <EmptyStateCoach
        icon={Search}
        iconColor="text-muted-foreground"
        iconBg="bg-muted"
        headline="Nothing found"
        description="Try adjusting your search or browse everything available"
        cta={{ label: "Browse all", href: basePath }}
        secondarySlot={
          <HowHoadorWorksModal
            trigger={
              <button
                type="button"
                className="text-muted-foreground coarse:min-h-11 hover:text-foreground text-xs underline-offset-4 hover:underline"
              >
                How does Hoador work?
              </button>
            }
          />
        }
      />
      <Separator className="max-w-xs" />
      <EmptyStateNeedCTA type="rental" />
    </div>
  );
}
