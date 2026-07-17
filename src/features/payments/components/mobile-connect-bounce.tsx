"use client";

import { useEffect, useState } from "react";

/**
 * Bounces a Stripe Connect onboarding redirect back into the mobile app.
 *
 * Stripe requires public https `return_url`/`refresh_url` and rejects custom
 * schemes, so it lands the user here; this page forwards to the `hoador://`
 * deep link. Once the universal-link association files (AASA / assetlinks.json,
 * task 3.7) are served the OS opens the app before this page ever renders — the
 * visible tap-through is the fallback for the window before that, and for any
 * device where the automatic open does not fire.
 *
 * No session material or Stripe data is read here; the app re-syncs onboarding
 * status itself after it reopens (Req 2.3.3).
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.4
 */
export function MobileConnectBounce({
  deepLink,
  heading,
  description,
}: {
  deepLink: string;
  heading: string;
  description: string;
}) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Attempt the hand-off immediately. If a universal link already opened the
    // app this code never runs; if it didn't, this is what forwards the user.
    window.location.href = deepLink;

    // Reveal the manual link only if we are still here shortly after — i.e. the
    // automatic open did not take.
    const timer = setTimeout(() => setShowFallback(true), 1200);
    return () => clearTimeout(timer);
  }, [deepLink]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{heading}</h1>
      <p style={{ maxWidth: "28rem", color: "#4b5563" }}>{description}</p>
      {showFallback && (
        <a
          href={deepLink}
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.5rem",
            background: "#111827",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Return to the Hoador app
        </a>
      )}
    </main>
  );
}
