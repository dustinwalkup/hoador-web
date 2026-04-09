/**
 * True when Sentry should be active.
 * Mirrors the isProduction check used during Sentry.init() in instrumentation files.
 * Use this to guard captureException calls so they stay consistent with
 * whether the SDK was actually initialized.
 *
 * NEXT_PUBLIC_ prefix makes this safe to reference in client bundles.
 */
export const isSentryEnabled: boolean =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production";
