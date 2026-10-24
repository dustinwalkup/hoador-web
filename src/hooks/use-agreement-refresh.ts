"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** How long after acceptance a missing agreement counts as being prepared. */
export const AGREEMENT_PREPARE_WINDOW_MS = 90_000;
/** How often the page asks the server again meanwhile. */
export const AGREEMENT_REFRESH_INTERVAL_MS = 3_000;

/**
 * Waiting for a just-accepted booking's agreement (Flow 6).
 *
 * The rental and service agreement PDFs are generated after the accept call
 * returns and land a few seconds later. The detail pages are server-rendered,
 * so without this the page kept its "no agreement" (services) or generic
 * terms (rentals) until a reload. For a short window after the server's
 * acceptance time the page refreshes itself until the agreement is there, and
 * `preparing` lets it say so. After the window it stops, and the page reads
 * as it did before.
 */
export function useAgreementRefresh({
  acceptedAt,
  ready,
}: {
  acceptedAt: string | Date | null | undefined;
  ready: boolean;
}): { preparing: boolean } {
  const router = useRouter();
  const accepted = acceptedAt ? new Date(acceptedAt).getTime() : NaN;
  const endsAt =
    ready || Number.isNaN(accepted)
      ? null
      : accepted + AGREEMENT_PREPARE_WINDOW_MS;
  const [now, setNow] = useState(() => Date.now());
  const preparing = endsAt !== null && now < endsAt;

  useEffect(() => {
    if (endsAt === null || Date.now() >= endsAt) return;
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= endsAt) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, AGREEMENT_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [endsAt, router]);

  return { preparing };
}
