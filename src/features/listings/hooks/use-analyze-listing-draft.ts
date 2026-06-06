import { useCallback, useMemo, useRef, useState } from "react";

import {
  type AiDraft,
  type AiFailureReason,
} from "@/features/listings/ai-listing-assistant/types";

/**
 * Hook that drives the AI Listing Assistant modal's generation step.
 *
 * Semantically a wrapper over `/api/listings/analyze-image`; we do the fetch
 * inline rather than composing `useAnalyzeListingImage` so we can (a) preserve
 * HTTP status for failure mapping and (b) suppress the global mutation toast
 * — both would force breaking changes to the dev test page's hook. The
 * endpoint contract is identical.
 *
 * Responsibilities:
 * - Lazy `File[]` → base64 data URL conversion at generate time (Req 4.6).
 * - One-shot idempotency: subsequent `generate()` calls after a success are
 *   no-ops at the hook layer (Req 4.3; UI also disables, this is belt-and-
 *   braces).
 * - Map server failures to `AiFailureReason` so the modal can render the
 *   correct error copy and recovery actions (Req 9.1, 9.2).
 */
interface UseAnalyzeListingDraftArgs {
  onSuccess: (draft: AiDraft) => void;
  onFailure: (reason: AiFailureReason) => void;
}

interface UseAnalyzeListingDraftResult {
  isPending: boolean;
  generate: (files: File[]) => Promise<void>;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader returned a non-string result"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function mapHttpStatusToReason(status: number): AiFailureReason {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "network";
  return "server";
}

export function useAnalyzeListingDraft(
  args: UseAnalyzeListingDraftArgs,
): UseAnalyzeListingDraftResult {
  const [isPending, setIsPending] = useState(false);
  const hasSucceededRef = useRef(false);

  // Refs let `generate` close over the latest callbacks without
  // re-creating the function on every render.
  const onSuccessRef = useRef(args.onSuccess);
  onSuccessRef.current = args.onSuccess;
  const onFailureRef = useRef(args.onFailure);
  onFailureRef.current = args.onFailure;

  const generate = useCallback(async (files: File[]) => {
    if (hasSucceededRef.current) return;
    if (files.length === 0) return;

    setIsPending(true);
    try {
      let imageUrls: string[];
      try {
        imageUrls = await Promise.all(files.map(readAsDataUrl));
      } catch {
        onFailureRef.current("server");
        return;
      }

      let response: Response;
      try {
        response = await fetch("/api/listings/analyze-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrls }),
        });
      } catch {
        onFailureRef.current("network");
        return;
      }

      if (!response.ok) {
        onFailureRef.current(mapHttpStatusToReason(response.status));
        return;
      }

      let payload: {
        success: boolean;
        data: AiDraft | null;
        failureKind?: AiFailureReason;
      };
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        onFailureRef.current("server");
        return;
      }

      if (payload.data === null) {
        // Route may tag the null with a specific reason (e.g.
        // `unsuitable_content` for model refusals). Default to
        // `low_confidence` for untagged nulls.
        onFailureRef.current(payload.failureKind ?? "low_confidence");
        return;
      }

      // Route already enforces this — repeat the check at the hook layer so
      // a future server change that loosens the check still produces
      // sensible UX (Req 9.1).
      if (payload.data.name === null && payload.data.categoryId === null) {
        onFailureRef.current("low_confidence");
        return;
      }

      hasSucceededRef.current = true;
      onSuccessRef.current(payload.data);
    } finally {
      setIsPending(false);
    }
  }, []);

  return useMemo(() => ({ isPending, generate }), [isPending, generate]);
}
