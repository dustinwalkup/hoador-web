"use client";

import { MessageCircle } from "lucide-react";
import { EmptyStateCoach } from "@/components/empty-state-coach";
import { HowHoadorWorksModal } from "@/components/how-hoador-works-modal";

/**
 * Empty messages widget body with primary browse CTA and secondary “how it works” modal.
 */
export function UnreadMessagesEmptyState() {
  return (
    <EmptyStateCoach
      icon={MessageCircle}
      iconColor="text-sky-400"
      iconBg="bg-sky-500/10"
      headline="No messages yet"
      description="Your conversations will appear here when you book or accept a rental or service"
      cta={{ label: "Browse services", href: "/dashboard/services" }}
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
  );
}
