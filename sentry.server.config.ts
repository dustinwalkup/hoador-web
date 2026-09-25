// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry/scrub-event";

// Only initialize Sentry in production
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production";

if (isProduction) {
  Sentry.init({
    // SENTRY_DSN is required for server-side
    dsn: process.env.SENTRY_DSN,

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

    // requestData attaches cookies and headers even with sendDefaultPii off,
    // so override the default instance of it.
    integrations: [
      Sentry.requestDataIntegration({
        include: { ip: false, cookies: false, headers: false },
      }),
    ],

    // Release tracking from package version for deployment correlation (LOG-OBS-003)
    release:
      process.env.SENTRY_RELEASE ||
      `hoador-web@${process.env.npm_package_version || "0.1"}`,

    // Filter expected errors and strip cookies/headers/user PII
    beforeSend: scrubSentryEvent,
  });
}
