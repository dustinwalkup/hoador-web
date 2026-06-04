/**
 * In-memory per-user token bucket for the AI listing-draft generation route.
 *
 * Semantics:
 * - `consume(userId)` deducts a token before invoking OpenAI. If the user has
 *   already burned through their quota in the current rolling window, returns
 *   `{ allowed: false }`.
 * - `refund(userId)` returns the most recently consumed token. Called when the
 *   downstream call (OpenAI / parse) fails so failures do not eat quota.
 *
 * The window is rolling: each timestamp expires `windowMs` after it was
 * recorded. We prune expired entries on every call so the map cannot grow
 * unboundedly for an active user.
 *
 * Limits to a single process — adequate for the current single-region Vercel
 * deployment per `2-design.md`. Would migrate to a shared store (e.g. Upstash)
 * for multi-instance.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

const buckets: Map<string, number[]> = new Map();

function prune(timestamps: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  let firstFresh = 0;
  while (firstFresh < timestamps.length && timestamps[firstFresh] <= cutoff) {
    firstFresh++;
  }
  return firstFresh === 0 ? timestamps : timestamps.slice(firstFresh);
}

interface BucketOptions {
  limit?: number;
  windowMs?: number;
  now?: () => number;
}

export function consume(
  userId: string,
  opts: BucketOptions = {},
): RateLimitResult {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const now = (opts.now ?? Date.now)();

  const existing = buckets.get(userId) ?? [];
  const fresh = prune(existing, now, windowMs);

  if (fresh.length >= limit) {
    buckets.set(userId, fresh);
    return { allowed: false, remaining: 0 };
  }

  fresh.push(now);
  buckets.set(userId, fresh);
  return { allowed: true, remaining: limit - fresh.length };
}

export function refund(userId: string): void {
  const existing = buckets.get(userId);
  if (!existing || existing.length === 0) return;
  existing.pop();
  if (existing.length === 0) {
    buckets.delete(userId);
  } else {
    buckets.set(userId, existing);
  }
}

/** Test-only: clear all buckets between tests. */
export function __resetForTests(): void {
  buckets.clear();
}

/** Test-only: read remaining tokens for a user without consuming. */
export function __peekForTests(
  userId: string,
  opts: BucketOptions = {},
): number {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const now = (opts.now ?? Date.now)();
  const fresh = prune(buckets.get(userId) ?? [], now, windowMs);
  return Math.max(0, limit - fresh.length);
}
