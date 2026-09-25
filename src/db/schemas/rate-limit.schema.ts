import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Durable rate-limit buckets (ARCH-07). One row per key
 * (`"<scope>:<dimension>:<value>"`, e.g. `"auth:forgot-password:email:a@b.com"`).
 * Backs `enforceRateLimit()` (app routes) and better-auth's
 * `rateLimit.customStorage`. No FK to `user`: a key is often an email or IP.
 */
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at").notNull(),
});

export type RateLimitBucketRow = typeof rateLimitBuckets.$inferSelect;
