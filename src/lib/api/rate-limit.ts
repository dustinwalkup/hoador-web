// `better-auth` re-exports `@better-auth/core`, which is not a direct dependency.
import type { BetterAuthRateLimitStorage } from "better-auth";
import { rateLimitDAL } from "@/dal";
import { RateLimitedError } from "@/dal/errors";

/**
 * Throws `RateLimitedError` once `key` exceeds `limit` within `windowSeconds`
 * (ARCH-07). Call inside a route's existing try/catch — `handleApiError` maps
 * the throw to a 429 with `Retry-After`.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  // Same gate as better-auth's own limiter (`enabled` defaults to production
  // only). Without it, local dev and the Playwright suite (every signup and
  // password reset comes from one localhost IP, `E2E_TEST=1`) trip the
  // per-IP limits. Vercel previews and staging run NODE_ENV=production, so
  // they enforce.
  if (process.env.NODE_ENV !== "production") return;
  const result = await rateLimitDAL.consume(key, limit, windowSeconds);
  if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds);
}

/**
 * Adapter onto the same table for better-auth's `rateLimit.customStorage`
 * (see build-auth-options.ts). better-auth calls `consume` exclusively when
 * present; `get`/`set` are dead code then, kept only to satisfy the type.
 */
export const betterAuthRateLimitStorage: BetterAuthRateLimitStorage = {
  async get(key) {
    const row = await rateLimitDAL.getRaw(key);
    return row ? { key, count: row.count, lastRequest: row.lastRequest } : null;
  },
  async set(key, value) {
    await rateLimitDAL.setRaw(key, value.count, value.lastRequest);
  },
  async consume(key, rule) {
    const result = await rateLimitDAL.consume(key, rule.max, rule.window);
    return {
      allowed: result.allowed,
      retryAfter: result.allowed ? null : result.retryAfterSeconds,
    };
  },
};
