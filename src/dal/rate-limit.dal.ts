import { eq, sql } from "drizzle-orm";
import { rateLimitBuckets } from "@/db/schemas/rate-limit.schema";
import { BaseDAL } from "./base";
import { DALError } from "./errors";

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Durable, cross-instance rate-limit buckets (ARCH-07). A fixed window per key:
 * the first hit opens it, and it resets once `reset_at` passes.
 */
export class RateLimitDAL extends BaseDAL {
  /**
   * Records one hit against `key` and says whether it is within `limit` for
   * the current window. One atomic UPSERT decides and increments under
   * Postgres's row lock on `key`, so concurrent requests for the same key
   * cannot all read a stale count before any of them writes.
   */
  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<ConsumeResult> {
    try {
      const [row] = await this.db
        .insert(rateLimitBuckets)
        .values({
          key,
          count: 1,
          resetAt: sql`now() + interval '1 second' * ${windowSeconds}`,
        })
        .onConflictDoUpdate({
          target: rateLimitBuckets.key,
          set: {
            // Reads the row's CURRENT value (not `excluded`): reset if its
            // window elapsed, else increment.
            count: sql`CASE WHEN ${rateLimitBuckets.resetAt} <= now() THEN 1 ELSE ${rateLimitBuckets.count} + 1 END`,
            resetAt: sql`CASE WHEN ${rateLimitBuckets.resetAt} <= now() THEN now() + interval '1 second' * ${windowSeconds} ELSE ${rateLimitBuckets.resetAt} END`,
          },
        })
        .returning({
          count: rateLimitBuckets.count,
          resetAt: rateLimitBuckets.resetAt,
        });

      if (!row) {
        throw new DALError("Rate limit upsert returned no row", "UNKNOWN", 500);
      }

      const allowed = row.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - row.count),
        retryAfterSeconds: allowed
          ? 0
          : Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
      };
    } catch (error) {
      this.handleError(error, "RateLimitDAL.consume");
    }
  }

  // `getRaw`/`setRaw` back better-auth's legacy `get`/`set`. Dead code while
  // `consume` is implemented (better-auth then calls it exclusively); kept only
  // to satisfy `BetterAuthRateLimitStorage`.
  async getRaw(
    key: string,
  ): Promise<{ count: number; lastRequest: number } | null> {
    try {
      const [row] = await this.db
        .select({
          count: rateLimitBuckets.count,
          resetAt: rateLimitBuckets.resetAt,
        })
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.key, key))
        .limit(1);
      return row
        ? { count: row.count, lastRequest: row.resetAt.getTime() }
        : null;
    } catch (error) {
      this.handleError(error, "RateLimitDAL.getRaw");
    }
  }

  async setRaw(key: string, count: number, lastRequest: number): Promise<void> {
    try {
      await this.db
        .insert(rateLimitBuckets)
        .values({ key, count, resetAt: new Date(lastRequest) })
        .onConflictDoUpdate({
          target: rateLimitBuckets.key,
          set: { count, resetAt: new Date(lastRequest) },
        });
    } catch (error) {
      this.handleError(error, "RateLimitDAL.setRaw");
    }
  }
}
