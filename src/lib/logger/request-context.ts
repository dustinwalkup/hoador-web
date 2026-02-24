import { AsyncLocalStorage } from "async_hooks";

/**
 * Per-request context for logging and audit (LOG-003, LOG-004, LOG-AUD-002, LOG-AUD-020).
 * Stored in AsyncLocalStorage so getLogger() and Sentry can read requestId, userId, route.
 */
export interface RequestContext {
  requestId: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Route pattern for logging and Sentry (e.g. GET /api/rentals) */
  route?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Returns the current request context if running inside runWithRequestContext.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Generates a unique request ID (e.g. for x-request-id or logging).
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Runs fn with the given context set in AsyncLocalStorage. Used by API route
 * wrappers so that getLogger() and audit calls can read requestId, userId, etc.
 *
 * @param context - At least requestId; userId, ipAddress, userAgent optional
 * @param fn - Async function to run with context
 * @returns Result of fn
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return requestContextStorage.run(context, fn);
}
