import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Highly visible disclaimer rendered adjacent to the Safety Notes field when
 * AI has prefilled safety-related text (Req 7.6). Owner-responsibility framing
 * with warning styling; non-dismissible, no collapse.
 *
 * Uses the destructive `Alert` variant so it stands apart from the general
 * `DraftNotice` at the top of the form.
 */
export function SafetyDisclaimer() {
  return (
    <Alert variant="destructive" data-testid="ai-safety-disclaimer">
      <AlertTriangle />
      <AlertTitle>
        AI-drafted safety guidance is a starting point only
      </AlertTitle>
      <AlertDescription>
        It may be incomplete or inaccurate. As the listing owner, you are
        responsible for reviewing and providing complete, accurate safety
        information for your item before submitting.
      </AlertDescription>
    </Alert>
  );
}
