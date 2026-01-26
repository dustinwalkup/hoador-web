import * as Sentry from "@sentry/nextjs";

// Only register Sentry in production
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production";

export async function register() {
  // Only initialize Sentry in production
  if (!isProduction) {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
