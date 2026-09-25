# Plan R-ARCH-07: Add durable, cross-instance rate limiting

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 25e2233..HEAD -- src/services/better-auth/build-auth-options.ts src/app/api/auth/forgot-password/route.ts src/app/api/auth/resend-verification/route.ts src/app/api/auth/signup/route.ts src/app/api/auth/reset-password/route.ts src/app/api/push/subscribe/route.ts src/app/api/push/test/route.ts "src/app/api/(payments)/create-setup-intent/route.ts" src/app/api/stripe/payment-sheet-params/route.ts src/features/notifications/lib/validators.ts src/dal/notifications.dal.ts src/lib/api/route-helpers.ts src/dal/errors.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED
- **Depends on**: none. R-PERF-02 already landed as commit `25e2233` (not
  in-flight); this plan adds to `src/dal/errors.ts` and
  `src/lib/api/route-helpers.ts` next to its `NeedLimitReachedError`,
  following the same pattern.
- **Category**: security / architecture
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: ARCH-07, SEC-04, SEC-13, SEC-21

## Why this matters

Every rate limiter today is in-memory (per serverless instance — a 5-instance
deploy gives an attacker 5× the effective limit) or absent. `POST
/api/auth/forgot-password`/`resend-verification`/`signup`/`reset-password`
call `auth.api.*` server-side, which never passes through better-auth's HTTP
router — the only place its built-in limiter runs — so they have zero
throttling (SEC-04): loop `forgot-password` with a victim's email and Resend
sends one email per call, unbounded. `POST /api/push/subscribe` accepts any
string as an `endpoint` with no per-user cap, and `POST /api/push/test` sends
to every active one — register 10,000 endpoints pointed at a target host,
then call `/api/push/test`, and Hoador's egress becomes a DDoS reflector
(SEC-13). `create-setup-intent`/`payment-sheet-params` mint unlimited
SetupIntents/ephemeral keys with only Stripe Radar as a backstop (SEC-21).

## Current state

- `src/services/better-auth/build-auth-options.ts` has **no `rateLimit` key**
  — the default applies (`enabled: isProduction`, `storage: "memory"`, per
  `node_modules/better-auth/dist/context/create-context.mjs:174`).
- `forgot-password/route.ts:8-67`, `resend-verification/route.ts:7-78`,
  `signup/route.ts:14-99`, `reset-password/route.ts:8-56` each call
  `auth.api.*` with no throttling. Two of them even scan the thrown error's
  message for `"rate limit"`, expecting a limiter that structurally can't
  reach this path.
- `src/features/notifications/lib/validators.ts:19` —
  `webSubscribeBodySchema.endpoint` is `z.string().min(1)`: no scheme/host
  check.
- `src/dal/notifications.dal.ts` — `PushSubscriptionDAL.create` (~line 599)
  and `.createNative` (~line 726) each update an existing row by
  endpoint/token, then fall through to an unguarded insert for a new one.
- `push-service.ts:119` — `webpush.sendNotification(subscription, payloadStr)`,
  no timeout.
- `push/subscribe/route.ts` and `push/test/route.ts` POST handlers, and
  `create-setup-intent/route.ts:10-47` / `payment-sheet-params/route.ts:32-114`,
  have no rate limit after auth.
- `src/app/api/listings/[listingId]/route.ts:18` has an existing
  `// TODO: Add distributed rate limiting for image uploads` — not in this
  plan's scope (see Scope / Maintenance notes).
- `src/lib/api/ai-rate-limit.ts` (SEC-14) and `src/lib/auth/failed-auth-store.ts`
  (log-only) are the other in-memory limiters ARCH-07 names; neither is in
  the roadmap's list for this item — left alone.
- `src/dal/errors.ts:157-163` `NeedLimitReachedError` (429,
  `NEED_LIMIT_REACHED`) is the pattern to match: a `DALError` subclass mapped
  in `handleApiError` (`route-helpers.ts:170-175`) to `{error, code}` and
  added to the `shouldCaptureError` skip-list. This plan adds two more, plus
  a `Retry-After` header on one.
- `src/db/db.ts` — drizzle on `neon-serverless`, `Pool({ max: 10 })`.
- `drizzleAdapter(db, { provider: "pg" })` (`services/better-auth/index.ts:16`)
  passes no `schema`, so better-auth's adapter resolves models against
  `db._.fullSchema` — i.e. `src/db/schemas/index.ts`'s exported `schema`.

## Decisions for the maintainer

**1. Store — Upstash Redis vs. a Postgres table.**

|                          | Upstash Redis                                                   | Postgres table (this repo's Neon)                                   |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| New vendor               | Yes — account, env vars, a service to monitor                   | No — reuses the existing connection                                 |
| Cost pre-launch          | Free tier covers it; a metered line later                       | $0 marginal                                                         |
| Latency                  | Lower (~5-10ms edge REST)                                       | Higher (~10-40ms), fine for these non-hot-loop routes               |
| Load on `Pool({max:10})` | None                                                            | One extra UPSERT per limited call, self-limiting                    |
| Local/test ergonomics    | Needs a mock or real instance in CI/local (neither exists here) | Works with the existing `docker compose` Postgres + real-DB harness |

**Recommendation: Postgres.** Pre-launch, this repo already avoids new infra
where a table suffices (crons are GitHub Actions, not Vercel cron;
R-TEST-HARNESS chose real Postgres over mocks). Steps below assume Postgres.

**2. How to wire better-auth — `rateLimit.customStorage`, not
`secondaryStorage` or `storage: "database"`.** The roadmap note says "point
`secondaryStorage`" — checked against the installed `better-auth@1.6.23`
types and rejected:

- `secondaryStorage` isn't rate-limit-scoped: setting it also relocates
  **session and verification-token storage** app-wide
  (`node_modules/better-auth/dist/db/internal-adapter.mjs`, gated only on
  `if (secondaryStorage)`). Without also setting
  `session.storeSessionInDatabase`/`verification.storeInDatabase`, losing
  that store would log everyone out — a far bigger change than "durable rate
  limiting."
- `storage: "database"` needs a model literally named `rateLimit` inside
  `db._.fullSchema` with fields `key`/`count`/`lastRequest`
  (`@better-auth/core/dist/db/schema/rate-limit.mjs`) — a **second** table
  duplicating the one this plan adds for the app's own routes.
- `rateLimit.customStorage` takes a plain `{get, set, consume}` object.
  better-auth calls `consume` exclusively when present
  (`rate-limiter/index.mjs:342`), so one table + one atomic upsert serves
  **both** better-auth's built-in limiter and the app's own routes, with zero
  change to session/verification behavior. Steps below use this.

## Commands you will need

| Purpose            | Command                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| Install            | `bun install`                                                                    |
| Typecheck          | `bun run type-check`                                                             |
| Lint               | `bun run lint`                                                                   |
| Generate migration | `bun run db:generate --name=add_rate_limit_buckets`                              |
| Unit/mocked tests  | `bun run test:run <path>`                                                        |
| Real-DB tests      | `docker compose up -d && bun run db:push:e2e && bun run test:integration <path>` |

## Scope

**In scope**: `src/db/schemas/rate-limit.schema.ts` (new) + `schemas/index.ts`;
one migration; `src/dal/rate-limit.dal.ts` (new) + `dal/index.ts`;
`src/dal/errors.ts` (`RateLimitedError`, `SubscriptionLimitReachedError`);
`src/lib/api/rate-limit.ts` (new); `src/constants/rate-limits.ts` (new);
`src/lib/api/route-helpers.ts`; `build-auth-options.ts`; the four custom auth
routes (SEC-04); `notifications/lib/validators.ts` + `dal/notifications.dal.ts`

- `push/subscribe/route.ts` + `push/test/route.ts` + `push-service.ts`
  (SEC-13); `create-setup-intent/route.ts` + `payment-sheet-params/route.ts`
  (SEC-21); `src/test/integration/setup.ts` (`TRUNCATE_LIST`); tests for all of
  the above.

**Out of scope**: `ai-rate-limit.ts`, `failed-auth-store.ts` (not in the
roadmap's list for this item); the listings upload-rate-limit TODO (same —
see Maintenance notes for the now-trivial follow-up); better-auth's
`rateLimit.enabled` gate (left at its default); Stripe Radar config
(dashboard, not code).

## Git workflow

Work directly on `develop`. Do not commit or push.

## Steps

### Step 1: The table

`src/db/schemas/rate-limit.schema.ts`:

```ts
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
```

Add `import * as rateLimit from "./rate-limit.schema";` to
`src/db/schemas/index.ts` and spread it into `schema`.

Generate: `bun run db:generate --name=add_rate_limit_buckets` (confirm the
next free number under `src/db/migrations/` first — `0075` as of this
writing). Confirm the generated SQL is a single `CREATE TABLE`.

**Verify**: `bun run type-check` → exit 0; one new migration file.

### Step 2: `RateLimitDAL`

`src/dal/rate-limit.dal.ts` — one atomic UPSERT does decide-and-increment in
a single statement, under Postgres's row lock on `key`, so concurrent
requests for the same key can't both read a stale count before either
writes:

```ts
import { eq, sql } from "drizzle-orm";
import { schema } from "@/db/schemas";
import { BaseDAL } from "./base";
import { DALError } from "./errors";

const { rateLimitBuckets } = schema;

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimitDAL extends BaseDAL {
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

      if (!row)
        throw new DALError("Rate limit upsert returned no row", "UNKNOWN", 500);

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

  // Fallback for BetterAuthRateLimitStorage.get/set — dead code while
  // .consume is implemented; kept only to satisfy the interface.
  async getRaw(
    key: string,
  ): Promise<{ count: number; lastRequest: number } | null> {
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
```

Add `export const rateLimitDAL = new RateLimitDAL();` to `src/dal/index.ts`.

**Verify**: `bun run type-check` → exit 0.

### Step 3: Two new typed errors

In `src/dal/errors.ts`, next to `NeedLimitReachedError`:

```ts
/** Thrown by enforceRateLimit (src/lib/api/rate-limit.ts). handleApiError
 * adds a Retry-After header alongside the usual {error, code} body. */
export class RateLimitedError extends DALError {
  constructor(
    public readonly retryAfterSeconds: number,
    message = "Too many requests. Please try again later.",
  ) {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitedError";
  }
}

/** SEC-13: unlimited push endpoints per user is what makes the route usable
 * as an HTTPS reflector. */
export class SubscriptionLimitReachedError extends DALError {
  constructor(message: string) {
    super(message, "SUBSCRIPTION_LIMIT_REACHED", 429);
    this.name = "SubscriptionLimitReachedError";
  }
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 4: Map both in `handleApiError`

In `src/lib/api/route-helpers.ts`: import both from `@/dal/errors`; add both
to the `shouldCaptureError` skip-list; add response branches next to
`NeedLimitReachedError`'s:

```ts
if (error instanceof RateLimitedError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    {
      status: error.statusCode,
      headers: { "Retry-After": String(error.retryAfterSeconds) },
    },
  );
}
if (error instanceof SubscriptionLimitReachedError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.statusCode },
  );
}
```

**Verify**: extend `src/lib/api/__tests__/route-helpers.test.ts` (mirror the
existing `NeedLimitReachedError` case) — the `RateLimitedError` case must
assert `response.headers.get("Retry-After")`.

### Step 5: The app-facing helper and the better-auth adapter

`src/constants/rate-limits.ts`:

```ts
export const RATE_LIMITS = {
  FORGOT_PASSWORD_PER_EMAIL: { limit: 3, windowSeconds: 15 * 60 },
  FORGOT_PASSWORD_PER_IP: { limit: 10, windowSeconds: 15 * 60 },
  RESEND_VERIFICATION_PER_EMAIL: { limit: 3, windowSeconds: 15 * 60 },
  RESEND_VERIFICATION_PER_IP: { limit: 10, windowSeconds: 15 * 60 },
  SIGNUP_PER_IP: { limit: 5, windowSeconds: 60 * 60 },
  RESET_PASSWORD_PER_IP: { limit: 10, windowSeconds: 15 * 60 },
  PUSH_SUBSCRIBE_PER_USER: { limit: 20, windowSeconds: 60 * 60 },
  PUSH_TEST_PER_USER: { limit: 5, windowSeconds: 60 * 60 },
  SETUP_INTENT_PER_USER: { limit: 10, windowSeconds: 60 * 60 },
} as const;

/** Standing cap, not a time window (SEC-13). */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;
```

`src/lib/api/rate-limit.ts`:

```ts
// `better-auth` re-exports `@better-auth/core`, which is not a direct dependency.
import type { BetterAuthRateLimitStorage } from "better-auth";
import { rateLimitDAL } from "@/dal";
import { RateLimitedError } from "@/dal/errors";

/** Throws RateLimitedError once `key` exceeds `limit` within `windowSeconds`.
 * Call inside a route's existing try/catch — handleApiError maps the throw. */
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

/** Adapter onto the same table for better-auth's rateLimit.customStorage
 * (see build-auth-options.ts). better-auth calls .consume exclusively when
 * present; .get/.set are dead code then, kept only to satisfy the type. */
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
```

**Verify**: `bun run type-check` → exit 0 (pins that
`BetterAuthRateLimitStorage`'s shape still matches this `better-auth`
version — a mismatch here is a STOP condition, not something to force with
`as`).

### Step 6: Wire better-auth

In `build-auth-options.ts`, import `betterAuthRateLimitStorage` from
`@/lib/api/rate-limit` and add a top-level key (order doesn't matter):

```ts
// ARCH-07: durable, cross-instance limiting for every built-in better-auth
// route. `enabled` stays at better-auth's own default (production only) —
// only the storage backend changes. See this plan's "Decisions for the
// maintainer" for why customStorage, not secondaryStorage/storage:"database".
rateLimit: {
  customStorage: betterAuthRateLimitStorage,
},
```

**Verify**: `bun run type-check` → exit 0;
`bun run test:run src/services/better-auth` → all pass.

### Step 7: SEC-04 — the four custom auth routes

Add `enforceRateLimit` call(s) **before** the `auth.api.*`/service call,
inside the existing `try` block, so a throw reaches the unchanged outer
`catch (error) { return handleApiError(error); }`. `forgot-password`,
`resend-verification` and `reset-password` need a new `getClientIP` import
from `@/lib/api/route-helpers` (`signup` already has it). Pattern:
`await enforceRateLimit(key, RATE_LIMITS.<X>.limit, RATE_LIMITS.<X>.windowSeconds)`.

| Route                          | Insert after                                   | Key(s)                                                                                                           | Constant(s)                                                   |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `forgot-password/route.ts`     | `validation.success` check                     | `` `auth:forgot-password:ip:${ip}` ``, `` `auth:forgot-password:email:${validation.data.email.toLowerCase()}` `` | `FORGOT_PASSWORD_PER_IP`, `FORGOT_PASSWORD_PER_EMAIL`         |
| `resend-verification/route.ts` | `!email` check                                 | `` `auth:resend-verification:ip:${ip}` ``, `` `auth:resend-verification:email:${email.toLowerCase()}` ``         | `RESEND_VERIFICATION_PER_IP`, `RESEND_VERIFICATION_PER_EMAIL` |
| `signup/route.ts`              | existing `ipAddress`/`userAgent` (lines 50-51) | `` `auth:signup:ip:${ipAddress}` `` (skipped when null)                                                          | `SIGNUP_PER_IP`                                               |
| `reset-password/route.ts`      | `validation.success` check                     | `` `auth:reset-password:ip:${ip}` `` (IP-only — the token, not an email, is the identity here)                   | `RESET_PASSWORD_PER_IP`                                       |

Where a row needs `ip`, add `const ip = getClientIP(request);` right before
it (once per route), and **skip the IP-keyed call when `ip` is null**. Do not
fall back to a shared `"unknown"` key: if a proxy ever strips the headers,
every caller would share one bucket and 5 signups an hour would lock out the
whole platform. The per-email limits still apply. For `signup`, use the
existing `ipAddress` the same way. (On Vercel, `x-forwarded-for` is set by
the edge, so its first entry is not client-spoofable there.)

**Verify**: `bun run type-check` → exit 0.

### Step 8: SEC-13 — push endpoint validation, subscription cap, test-route limit

**Endpoint validation** (`notifications/lib/validators.ts`): add an
allow-list and tighten `webSubscribeBodySchema.endpoint`:

```ts
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
] as const;

function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return ALLOWED_PUSH_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

export const webSubscribeBodySchema = z.object({
  endpoint: z.string().min(1).refine(isAllowedPushEndpoint, {
    message: "endpoint must be an https URL on a known push service",
  }),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  expirationTime: z.number().nullable().optional(),
});
```

The existing fixture `https://fcm.googleapis.com/fcm/send/abc123`
(`push/subscribe/route.test.ts:35`) already matches.

**Subscription cap** (`dal/notifications.dal.ts`): in both
`PushSubscriptionDAL.create` and `.createNative`, add a count check right
before the fall-through "insert a new row" branch — **after**, not before,
the `if (existing) { ...; return updated; }` block, so a device refreshing
its own row is never blocked by its own cap:

```ts
const activeCount = (await this.getActiveByUserId(userId)).length;
if (activeCount >= MAX_PUSH_SUBSCRIPTIONS_PER_USER) {
  throw new SubscriptionLimitReachedError(
    `You can have up to ${MAX_PUSH_SUBSCRIPTIONS_PER_USER} active push subscriptions. Remove one from another device first.`,
  );
}
```

Import `MAX_PUSH_SUBSCRIPTIONS_PER_USER` from `@/constants/rate-limits`,
`SubscriptionLimitReachedError` from `./errors`.

**Rate-limit the routes**: right after `userId` is resolved in
`push/subscribe/route.ts` POST and `push/test/route.ts` POST:

```ts
await enforceRateLimit(
  `push:subscribe:user:${userId}`,
  RATE_LIMITS.PUSH_SUBSCRIBE_PER_USER.limit,
  RATE_LIMITS.PUSH_SUBSCRIBE_PER_USER.windowSeconds,
);
// and, in push/test:
await enforceRateLimit(
  `push:test:user:${userId}`,
  RATE_LIMITS.PUSH_TEST_PER_USER.limit,
  RATE_LIMITS.PUSH_TEST_PER_USER.windowSeconds,
);
```

**Timeout** (`push-service.ts:119`, cheap one-liner from the same finding):

```ts
await webpush.sendNotification(subscription, payloadStr, { timeout: 5000 });
```

**Verify**: `bun run type-check` → exit 0.

### Step 9: SEC-21 — SetupIntent / ephemeral-key minting

Both routes share one bucket keyed by user id (`setup-intent:user:${id}`),
so alternating web/mobile can't double the effective limit. Add, using
`RATE_LIMITS.SETUP_INTENT_PER_USER`:

- `create-setup-intent/route.ts`, after `const { user } = authResult;`:
  `await enforceRateLimit(\`setup-intent:user:${user.id}\`, RATE_LIMITS.SETUP_INTENT_PER_USER.limit, RATE_LIMITS.SETUP_INTENT_PER_USER.windowSeconds);`
- `payment-sheet-params/route.ts`, after `const { userId } = authResult;`:
  same call with `${userId}`.

**Verify**: `bun run type-check` → exit 0.

### Step 10: Real-DB test isolation

In `src/test/integration/setup.ts`, add `"rate_limit_buckets"` to
`TRUNCATE_LIST` — no FK to `user` or anything else there, so `CASCADE` never
reaches it (same reason `legal_documents` is listed explicitly).

**Verify**: `bun run db:push:e2e` → exit 0.

## Test plan

- **`src/dal/__tests__/rate-limit.integration.test.ts`** (new, real Postgres):
  5 concurrent `rateLimitDAL.consume(key, 3, 60)` via `Promise.all` on the
  same key → exactly 3 `allowed: true`, 2 `allowed: false` (proves the UPSERT
  is atomic under real concurrency, not just single-threaded JS). Second
  test: `consume(key, 1, 1)`, sleep ~1.1s, `consume(key, 1, 1)` again →
  `allowed: true` (window reset).
- **`src/lib/api/__tests__/rate-limit.test.ts`** (new, mocked `rateLimitDAL`):
  with `vi.stubEnv("NODE_ENV", "production")`, `enforceRateLimit` resolves on
  `allowed: true` and throws `RateLimitedError` with `retryAfterSeconds` on
  `false`; with NODE_ENV `test` it never calls the DAL; `betterAuthRateLimitStorage.consume`
  maps to `{allowed, retryAfter}` correctly, including `retryAfter: null`.
- **`route-helpers.test.ts`**: the two cases from Step 4.
- **Route tests**: extend the two existing files
  (`forgot-password/route.test.ts`, `push/subscribe/route.test.ts`) with a
  case mocking `@/lib/api/rate-limit`'s `enforceRateLimit` to reject with
  `RateLimitedError`, asserting 429 + `Retry-After`. Add one equivalent new
  minimal test file per remaining route (`resend-verification`, `signup`,
  `reset-password`, `push/test`, `create-setup-intent`,
  `payment-sheet-params`) — same mock, same assertion, mirroring
  `forgot-password/route.test.ts`'s mocking style.
- **`validators.test.ts`**: rejects non-https and unlisted-host endpoints;
  accepts the four allow-listed hosts.
- **`notifications.dal.test.ts`**: `create`/`createNative` throw
  `SubscriptionLimitReachedError` at 10 existing active rows for a new
  endpoint/token; still succeed for an existing endpoint/token (refresh path,
  cap not checked).

**Verify**: `bun run test:run` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `bun run test:integration` (after `db:push:e2e`) → exit 0, including `rate-limit.integration.test.ts`
- [ ] `bun run db:generate` produced exactly one new migration for
      `rate_limit_buckets`
- [ ] Concurrency test proves `RateLimitDAL.consume` is atomic
- [ ] Each of the 8 routes in Scope calls `enforceRateLimit` (or gets the
      DAL-level cap) before its expensive/abusable work
- [ ] `rateLimit.customStorage` wired in `build-auth-options.ts`
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `10-remediation-roadmap.md`

## STOP conditions

- Any "Current state" excerpt doesn't match the live file.
- `BetterAuthRateLimitStorage`'s shape has changed from what Step 5 assumes
  — `bun run type-check` failing on `rate-limit.ts` is the signal; re-derive
  from the live type rather than forcing it with `as`.
- The concurrency test shows more than 3 `allowed: true` for
  `consume(key, 3, 60)` — the UPSERT isn't atomic on this Postgres version;
  stop and report rather than patching with an application-level lock.
- `bun run db:generate` produces anything other than a single `CREATE TABLE`.
- Any test fails twice after a reasonable fix attempt.

## Mobile compatibility

No contract change. `hoador-mobile/src/api/errors.ts:86` already classifies
**any** `429` as `kind: 'rate-limited'` regardless of `code`, and neither
`RATE_LIMITED` nor `SUBSCRIPTION_LIMIT_REACHED` needs specific handling
beyond that — `ApiErrorCode` in the same file lists the codes the app
branches on by name and these two aren't among them, by design.

`hoador-mobile/src/features/auth/lib/auth-actions.ts` posts to
`forgot-password`/`resend-verification`/`reset-password` directly and reads
only the HTTP status (`apiFetch` throws on any non-2xx; it never reads a
`success` field), so the new `{error, code}` 429 body — which only replaces
those routes' old `{success:false, error}` 429 for the _new_ rate-limited
case — needs no client change. `payment-sheet.contract.ts` and
`push.contract.ts` model only the success body; a 429 never reaches schema
validation. No row needed in the roadmap's "Mobile client follow-ups" table.

## Production cutover

Add to `13-production-cutover.md`'s "Step status" table:

| #   | Step                                                            | From      | dev  | staging | prod |
| --- | --------------------------------------------------------------- | --------- | ---- | ------- | ---- |
| M4  | `bun run db:migrate` for the new `rate_limit_buckets` migration | R-ARCH-07 | TODO | TODO    | TODO |

No new environment variables and no third-party account — the Postgres
recommendation means this ships entirely inside the existing Neon database.
If load ever makes Postgres-backed limiting a bottleneck, a future move to
Upstash would add env vars and a cutover row then, not now (see Maintenance
notes).

## Maintenance notes

- **The upload-rate-limit TODO** (`listings/[listingId]/route.ts:18`) is now
  a one-line follow-up: `await enforceRateLimit(...)` with the same helper.
  Not done here — not in this item's roadmap scope.
- `ai-rate-limit.ts` (SEC-14) and `failed-auth-store.ts` are still
  per-process; out of scope here, could move onto `enforceRateLimit` later.
- **Row growth**: `rate_limit_buckets` grows one row per distinct key ever
  seen (overwritten in place on reuse), not per request — bounded by
  distinct callers, not traffic volume. If it ever needs pruning:
  `DELETE FROM rate_limit_buckets WHERE reset_at < now() - interval '30 days'`.
- **Scaling out later**: swap `RateLimitDAL.consume`'s body for an Upstash
  call behind the same method signature — `enforceRateLimit`, the error
  classes, and every call site stay unchanged.
- `RATE_LIMITS` values are starting points; revisit after real traffic.
