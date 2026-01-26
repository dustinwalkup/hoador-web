// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

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

    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

    // Release tracking from package.json
    release: `hoador-web@${process.env.npm_package_version || "0.1"}`,

    // Filter out expected errors
    beforeSend(event, hint) {
      // Don't send errors in development
      if (process.env.NODE_ENV !== "production") {
        return null;
      }

      const error = hint.originalException;

      // Filter out expected HTTP errors
      if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status?: number }).status;
        // Don't send 404, 400, 401 errors - these are expected
        if (status === 404 || status === 400 || status === 401) {
          return null;
        }
      }

      // Filter out errors with specific messages
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        // Don't send validation errors, not found errors, or auth errors
        if (
          message.includes("not found") ||
          message.includes("validation") ||
          message.includes("unauthorized") ||
          message.includes("authentication required")
        ) {
          return null;
        }
      }

      return event;
    },
  });
}
