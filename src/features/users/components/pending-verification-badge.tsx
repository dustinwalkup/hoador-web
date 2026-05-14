import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * "Verification Pending" badge surfaced on a user's profile while their
 * primary community membership is still awaiting admin verification (R2.6).
 *
 * It is purely a trust signal — verification never gates any marketplace
 * action (browse / list / message / rent stay fully available while pending).
 */
export function PendingVerificationBadge() {
  return (
    <Badge
      variant="secondary"
      className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
      title="We're confirming your community membership. You keep full access while we review."
    >
      <Clock className="h-3 w-3" />
      Verification Pending
    </Badge>
  );
}
