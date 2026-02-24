import { getLogger } from "@/lib/logger";

const FAILED_AUTH_THRESHOLD = parseInt(
  process.env.FAILED_AUTH_THRESHOLD || "5",
  10,
);
const FAILED_AUTH_WINDOW_MS = parseInt(
  process.env.FAILED_AUTH_WINDOW_MS || String(15 * 60 * 1000),
  10,
);

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

/**
 * Prune entries outside the current time window.
 */
function prune(now: number): void {
  const cutoff = now - FAILED_AUTH_WINDOW_MS;
  for (const [key, entry] of store.entries()) {
    if (entry.windowStart < cutoff) {
      store.delete(key);
    }
  }
}

/**
 * Record a failed authentication attempt for an identifier (e.g. IP or email).
 * When the count for this identifier in the window exceeds FAILED_AUTH_THRESHOLD,
 * logs a warning-level security event (LOG-SEC-004).
 *
 * @param identifier - Identifier for the attempt (e.g. IP address or email)
 */
export function recordFailedAuth(identifier: string): void {
  const now = Date.now();
  prune(now);

  const key = identifier;
  const existing = store.get(key);
  let entry: Entry;
  if (existing) {
    const inWindow = existing.windowStart + FAILED_AUTH_WINDOW_MS > now;
    if (inWindow) {
      existing.count += 1;
      entry = existing;
    } else {
      entry = { count: 1, windowStart: now };
      store.set(key, entry);
    }
  } else {
    entry = { count: 1, windowStart: now };
    store.set(key, entry);
  }

  if (entry.count >= FAILED_AUTH_THRESHOLD) {
    getLogger().warn(
      {
        message: "auth.failed_threshold_exceeded",
        identifier: key,
        count: entry.count,
        threshold: FAILED_AUTH_THRESHOLD,
        windowMs: FAILED_AUTH_WINDOW_MS,
      },
      "Repeated failed authentication attempts exceeded threshold",
    );
  }
}
