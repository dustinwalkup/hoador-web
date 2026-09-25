// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry/scrub-event";

// Only initialize Sentry in production
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production";

if (isProduction) {
  Sentry.init({
    // NEXT_PUBLIC_SENTRY_DSN is required for client-side (browser can't access SENTRY_DSN)
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment name (optional - falls back to NODE_ENV)
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "production",

    // Performance monitoring: 50% sampling for cost control
    tracesSampleRate: 0.5,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // No user PII: a session cookie or email in Sentry is a leak (PRIV-07)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: false,

    // Release tracking from package.json
    release: `hoador-web@${process.env.npm_package_version || "0.1"}`,

    // Filter expected errors and strip cookies/headers/user PII
    beforeSend: scrubSentryEvent,
  });

  // Track unhandled promise rejections (client-side)
  if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
      Sentry.captureException(event.reason, {
        tags: {
          error_type: "unhandled_promise_rejection",
        },
        contexts: {
          promise: {
            reason:
              event.reason instanceof Error
                ? event.reason.message
                : String(event.reason),
          },
        },
      });
    });
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
