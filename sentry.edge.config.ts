// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry/scrub-event";

// Only initialize Sentry in production
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production";

if (isProduction) {
  Sentry.init({
    // SENTRY_DSN is required for edge runtime
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

    // Release tracking from package.json
    release: `hoador-web@${process.env.npm_package_version || "0.1"}`,

    // Filter expected errors and strip cookies/headers/user PII
    beforeSend: scrubSentryEvent,
  });
}
