import { Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Persistent banner shown at the top of the listing form when AI prefill is
 * in play. Implements Req 7.5:
 *   (a) the listing is a draft generated from the user's photos,
 *   (b) AI can make mistakes, and
 *   (c) the user is expected to proofread and edit every field before submit.
 *
 * Non-dismissible by design — there is no close affordance, and the notice
 * remains visible until the form unmounts (i.e. until submission).
 */
export function DraftNotice() {
  return (
    <Alert
      data-testid="ai-draft-notice"
      className="bg-ai-light text-ai border-ai/30 [&>svg]:text-ai"
    >
      <Sparkles />
      <AlertTitle>This is a draft generated from your photos</AlertTitle>
      <AlertDescription className="text-ai/80">
        AI can make mistakes. Please proofread and edit every field before
        submitting.
      </AlertDescription>
    </Alert>
  );
}
