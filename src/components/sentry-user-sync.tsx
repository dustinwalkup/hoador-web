"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSession } from "@/services/better-auth/client";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";

/**
 * Syncs the authenticated user into Sentry scope on the client.
 * Renders nothing. Mounted once near the root of the app (inside Providers).
 */
export function SentryUserSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!isSentryEnabled) return;

    if (session?.user) {
      // id only: email/name are PII that Sentry must not hold (PRIV-07)
      Sentry.setUser({ id: session.user.id });
    } else {
      Sentry.setUser(null);
    }
  }, [session]);

  return null;
}
