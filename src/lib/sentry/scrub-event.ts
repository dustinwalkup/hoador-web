import type * as Sentry from "@sentry/nextjs";

/**
 * Shared beforeSend for the server, edge and client Sentry configs
 * (PRIV-07). Filters expected 4xx/validation errors, then strips PII the
 * SDK's own defaults would otherwise attach: request cookies/headers and
 * anything on event.user beyond `id`.
 */
export function scrubSentryEvent(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint,
): Sentry.ErrorEvent | null {
  // Don't send errors in development
  if (process.env.NODE_ENV !== "production") return null;

  const error = hint.originalException;

  // Filter out expected HTTP errors (404, 400, 401)
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: number }).status;
    if (status === 404 || status === 400 || status === 401) return null;
  }

  // Filter out validation, not-found and auth errors by message
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("not found") ||
      message.includes("validation") ||
      message.includes("unauthorized") ||
      message.includes("authentication required")
    ) {
      return null;
    }
  }

  // The session cookie (and the mobile app's Cookie header) is a bearer
  // credential, so neither may reach Sentry.
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
  }
  if (event.user) {
    event.user =
      event.user.id !== undefined ? { id: event.user.id } : undefined;
  }

  return event;
}
