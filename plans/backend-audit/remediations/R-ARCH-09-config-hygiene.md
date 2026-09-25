# Plan R-ARCH-09: Validated env schema, explicit Stripe API version, CSP tightening, remote-image cleanup

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- next.config.ts src/services/stripe/server.ts src/instrumentation.ts .env.example src/db/db.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P3 · **Effort**: M (the priority matrix estimated S; the
  `NEXT_PUBLIC_APP_URL` cleanup alone touches ~24 files, all mechanical) ·
  **Risk**: LOW · **Depends on**: none
- **Category**: architecture / config hygiene
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: ARCH-09

## Why this matters

None of this is exploitable on its own — that's why it's LOW/opportunistic —
but each piece removes a way the app can misbehave silently:

- No env schema means a missing or misspelled var fails at first _use_, in
  whatever code path happens to touch it (a webhook 500, a notification link
  pointing at a stale fallback domain, a cron silently no-op-ing), not at
  boot where it's obvious and cheap to fix.
- The Stripe client comment says calls use "the account's default version",
  but stripe-node ^22 actually pins its own default
  (`2026-05-27.dahlia`) and sends it on every call whether the comment
  admits it or not. A `stripe` package bump silently changes the version
  every charge, transfer, refund and webhook is evaluated against — comment
  and behavior currently disagree, and neither is under anyone's control.
- CSP ships `'unsafe-eval'` in production without needing to (Next.js only
  needs it in dev, for the dev-mode bundler runtime).
- Two remote-image hosts in `next.config.ts` are allowlisted but unused,
  which is a live, if narrow, open proxy surface via `/_next/image` for
  those hosts.

## Current state

- **No env schema anywhere.** `grep -rln "z.object" src/lib src/config 2>/dev/null` (no `src/config` dir exists) turns up nothing env-related. Every
  var is read ad hoc via `process.env.X`, with three different failure modes
  in the wild: a hard throw at import time (`src/services/stripe/server.ts:5-7`,
  `STRIPE_SECRET_KEY`), a silent fallback to a placeholder connection string
  (`src/db/db.ts:26-28`, `DATABASE_URL || "postgresql://mock:mock@..."`), and
  a hard-coded production URL fallback duplicated ~24 times (below).
- **`NEXT_PUBLIC_APP_URL` fallback duplication** — two different fallback
  values, neither centrally defined:
  - `process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app"` in:
    `src/app/api/admin/listings/[listingId]/reject/route.ts:119`,
    `src/app/api/admin/listings/[listingId]/approve/route.ts:91`,
    `src/app/api/admin/users/bulk-actions/route.ts:173`,
    `src/app/api/push/test/route.ts:58`,
    `src/features/rentals/notifications/deposit-hold-failure.ts:23,139`,
    `src/features/rentals/notifications/rental-denied.ts:26`,
    `src/features/rentals/notifications/rental-started.ts:20`,
    `src/features/rentals/notifications/rental-cancelled.ts:24`,
    `src/features/rentals/notifications/payment-failure.ts:27,160`,
    `src/features/rentals/notifications/rental-ended.ts:20`,
    `src/features/rentals/notifications/rental-request-created.ts:30`,
    `src/features/rentals/notifications/rental-approved.ts:31`,
    `src/features/rentals/notifications/payment-succeeded.ts:29,167`,
    `src/features/rentals/notifications/instructions-updated.ts:24`,
    `src/features/rentals/services/cancellation-service.ts:359`,
    `src/features/messages/notifications/message-received.ts:26`,
    `src/features/listings/notifications/listing-pending-review.ts:6`,
    `src/features/disputes/notifications/deadline-notifications.ts:57`,
    `src/features/disputes/notifications/dispute-notifications.ts:19,139,326`,
    `src/features/services/notifications/service-notifications.ts:11`,
    `src/features/services/services/service-booking-service.ts:70`,
    `src/features/reviews/notifications/blind-review-released.ts:4`.
  - `process.env.NEXT_PUBLIC_APP_URL ?? "https://hoador.com"` (a
    _different_ fallback host) in:
    `src/features/neighborhood-needs/services/neighborhood-needs-service.ts:237,333`.
  - Two test files intentionally stub the var and are not part of this list:
    `src/app/api/stripe/create-account-link/__tests__/route.test.ts`,
    `src/services/better-auth/__tests__/mobile-cookie-transport.test.ts`.
- **Stripe API version** — `src/services/stripe/server.ts:9-17`: comment
  says _"No `apiVersion` is pinned: every call uses the account's default
  version, and that is deliberate."_ False today: `stripe` is pinned at
  `^22.2.0` (`package.json:120`), and stripe-node 22.2 hardcodes
  `exports.ApiVersion = '2026-05-27.dahlia'`
  (`node_modules/stripe/cjs/apiVersion.js:5`), used as
  `DEFAULT_API_VERSION` whenever the constructor isn't given one
  (`node_modules/stripe/cjs/stripe.core.js:97,168`). `PAYMENT_SERVER_INSTANCE`
  (the only `new Stripe(...)` call for platform operations — confirmed via
  `grep -rn "PAYMENT_SERVER_INSTANCE" src | wc -l` → 130 call sites, all
  consumers, one constructor) has no `apiVersion` option, so every one of
  those 130 call sites silently moves to whatever `stripe.core.js`'s
  built-in default is on the next `bun update stripe`.
- **CSP** — `next.config.ts`'s `headers()` (`:97-127`) sets one CSP for
  every route (`source: "/:path*"`), unconditionally including
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ...` — `'unsafe-eval'` is
  only required by Next's dev-mode bundler, not by the production build
  (Stripe.js/Connect embedded components need `'unsafe-inline'`/specific
  hosts, not `eval`).
- **Unused `remotePatterns`** — `next.config.ts:37-43,54-59`: `avatars.githubusercontent.com`
  and `cdn.jsdelivr.net` are allowlisted for `next/image`, but
  `grep -rn "avatars.githubusercontent.com\|cdn.jsdelivr.net" src --include=*.ts --include=*.tsx`
  (excluding `next.config.ts` itself) returns no hits — nothing in the app
  references either host.
- **`instrumentation.ts`** (`:1-21`) already exists and is the correct place
  to add boot-time validation: `register()` runs once per server instance
  (both the `nodejs` and `edge` runtimes), and already gates Sentry init on
  `isProduction`.

## Decisions for the maintainer

**1. Fail-fast strictness.** A hard `throw` in `register()` for a missing
required var would also fire during `next build` if Next invokes
`register()` at build time in this version — CI's build job
(`.github/workflows/ci.yml:166-178`) only sets
`NEXT_PUBLIC_APP_URL`/`STRIPE_SECRET_KEY`/`DATABASE_URL`/`OPENCAGE_API_KEY`/
`BETTER_AUTH_SECRET`/`RESEND_API_KEY`, not `BLOB_READ_WRITE_TOKEN`/
`CRON_SECRET`/`INTERNAL_API_SECRET`/`STRIPE_WEBHOOK_SECRET`/VAPID keys/
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — a naive "throw always" would break
CI's build step for vars it doesn't provide.

**Recommendation**: use `next/constants`'s `PHASE_PRODUCTION_BUILD` to skip
validation during `next build` (Step 1 gives the exact code — this is a
real, documented Next.js constant, not a guess: verified present in
`node_modules/next/dist/shared/lib/constants.js:50-51` and re-exported from
`next/constants`), and throw only at actual runtime boot
(`next dev`/`next start`) when `NODE_ENV === "production"`. In development,
log and continue rather than throw, so an incomplete local `.env.local`
(e.g. no push/VAPID keys) doesn't block `bun run dev` for someone not
touching that feature. **Verify this empirically** (Step 1's Verify line) —
don't take the phase-detection claim on faith.

**2. CSP `'unsafe-inline'`.** Removing it needs a per-request nonce threaded
through every inline script (a bigger change: proxy/middleware nonce
generation + `<Script nonce=...>` everywhere Next or a third party injects
inline script). Out of scope for this LOW-severity plan.

**Recommendation**: drop `'unsafe-eval'` from the production CSP now (zero
risk, concrete win — Next's production build doesn't need it); leave
`'unsafe-inline'` as a documented accepted risk, revisited only if the web
UI is kept long-term (R-ARCH-10) enough to justify the nonce plumbing.

## Commands

| Purpose   | Command                                                                   |
| --------- | ------------------------------------------------------------------------- |
| Typecheck | `bun run type-check`                                                      |
| Lint      | `bun run lint`                                                            |
| Tests     | `bun run test:run src/env src/services/stripe/__tests__ src/__tests__`    |
| Build     | `bun run build` (proves Step 1's phase-skip claim and that nothing broke) |
| Full      | `bun run ci`                                                              |

## Scope

**In scope**:

- `src/env.ts` (new)
- `src/env/__tests__/env.test.ts` (new)
- `src/instrumentation.ts`
- `src/services/stripe/server.ts`
- `next.config.ts`
- `.env.example` (add a short comment pointing at `src/env.ts` as the source
  of truth for what's required)
- The ~24 files listed in "Current state" (`NEXT_PUBLIC_APP_URL` fallback
  cleanup)

**Out of scope**:

- Nonce-based strict CSP (Decision 2).
- `src/db/db.ts`'s `DATABASE_URL` mock fallback — that one is deliberate
  (lets `db.ts` import cleanly in contexts that mock the DB entirely, e.g.
  some unit tests); leave it.
- `STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION` (`server.ts`'s other exported
  constant) — already pinned and documented for its own, unrelated reason
  (matching the mobile Stripe SDK's floor version); do not touch.
- Any Apple/Google/Meta credential validation beyond marking the fields
  optional in the schema — `build-auth-options.ts` already validates "all
  four Apple vars or none" itself; don't duplicate that logic here.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### Step 1: The env schema

Create `src/env.ts`:

```ts
import { z } from "zod";

/**
 * Validated at boot (ARCH-09). Required-in-production vars throw during a
 * real server start (`next start`/`next dev`); everything else stays
 * optional so a partial local `.env.local` doesn't block `bun run dev`.
 *
 * Skipped during `next build` (see `register()` in `instrumentation.ts`) —
 * the build phase doesn't have runtime secrets like `CRON_SECRET` or
 * `BLOB_READ_WRITE_TOKEN`, and CI's build job doesn't set them.
 */
const envSchema = z.object({
  // Core — required everywhere the app actually serves traffic.
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: z.string().min(1),

  // Cron / internal service-to-service auth
  CRON_SECRET: z.string().min(1),
  INTERNAL_API_SECRET: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().min(1),

  // Web push
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),

  // Optional / feature-gated — never required, whatever the environment.
  BETTER_AUTH_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENCAGE_API_KEY: z.string().optional(),
  SERP_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  OPS_ALERT_EMAIL: z.string().email().optional(),
  STALE_PROCESSING_THRESHOLD_MINUTES: z.string().optional(),
  MIN_APP_VERSION: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  GOOGLE_SHEETS_CLIENT_ID: z.string().optional(),
  GOOGLE_SHEETS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_SHEETS_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  META_PIXEL_ID: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_TEST_EVENT_CODE: z.string().optional(),
  NEXT_PUBLIC_PAYMENT_CONFIRMATION_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Idempotent — safe to call from every server-instance entry point. */
export function validateEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const message = [
      "Invalid or missing environment variables:",
      ...result.error.issues.map(
        (i) => `  - ${i.path.join(".")}: ${i.message}`,
      ),
    ].join("\n");
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    // Dev/test: warn, don't crash a local server over a var you're not
    // exercising yet.
    console.error(message);
  }
  // Cast either way: a dev-mode warning still needs a usable object for the
  // getters below, and `process.env` already has every var as a string.
  cached = (result.success ? result.data : process.env) as Env;
  return cached;
}

/** For call sites that just need the app's own base URL (ARCH-09: this used
 *  to be duplicated as `process.env.NEXT_PUBLIC_APP_URL || "<hard-coded
 *  fallback>"` in ~24 files, with two different, undocumented fallback
 *  hosts). Boot-time validation guarantees this is set; no fallback needed
 *  here. */
export function getAppUrl(): string {
  return validateEnv().NEXT_PUBLIC_APP_URL;
}
```

In `src/instrumentation.ts`, add the phase-gated call:

```ts
import * as Sentry from "@sentry/nextjs";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production";

export async function register() {
  // `next build` has no runtime secrets (CI's build job doesn't set
  // CRON_SECRET, BLOB_READ_WRITE_TOKEN, etc.) — only validate when a real
  // server instance is starting.
  if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
    const { validateEnv } = await import("./env");
    validateEnv();
  }

  if (!isProduction) {
    return;
  }
  // ...existing Sentry init, unchanged
}
```

**Verify**:

- `bun run type-check` → exit 0.
- **Empirically confirm the phase-skip claim**: temporarily rename
  `BLOB_READ_WRITE_TOKEN` in your local `.env.local`, set
  `NODE_ENV=production` and run `bun run build`. If it throws, the
  `PHASE_PRODUCTION_BUILD` check isn't working as expected in this Next
  version — STOP and re-investigate before continuing (do not weaken the
  check without understanding why); if it succeeds, restore the var and
  confirm `NODE_ENV=production bun run start` (after building with the var
  present) DOES throw with it removed again. This is the one non-obvious
  behavioral claim in this plan — verify it before trusting it.
- `bun run test:run src/env` → all pass (Step 4 adds this file).

### Step 2: Stripe API version

In `src/services/stripe/server.ts`, replace the constructor and its comment:

```ts
/**
 * Pinned explicitly (ARCH-09). stripe-node ^22 has always sent a default
 * API version on every call whether this file names it or not — the prior
 * comment claiming "the account's default version" was wrong. Pinning here
 * means a `stripe` package upgrade is a *visible* diff (this literal has to
 * be bumped by hand) instead of a silent re-versioning of every charge,
 * transfer, refund and webhook path.
 *
 * Deliberately a hard-coded literal, NOT `Stripe.API_VERSION` — that
 * constant tracks whatever version ships with the installed `stripe`
 * package, which is exactly the silent-drift this pin exists to prevent.
 * Bumping this string is itself the "upgrade the API version" decision;
 * do it deliberately, read Stripe's changelog for the versions in between,
 * and re-run the Stripe-touching test suites.
 */
export const PAYMENT_SERVER_INSTANCE = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});
```

Leave `STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION` and its documentation
untouched.

**Verify**: `bun run type-check` → exit 0. `bun run test:run src/services/stripe` → all pass (existing Stripe mocks construct their own mock client and don't assert on `apiVersion`, so this should be a no-op for tests — if any test mocks `new Stripe(...)` and asserts its call args, update the expected options).

### Step 3: CSP + remote-image cleanup

In `next.config.ts`, change the `script-src` line to drop `'unsafe-eval'`
outside development:

```ts
const isDev = process.env.NODE_ENV !== "production";
// ...
`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://connect-js.stripe.com https://va.vercel-scripts.com https://connect.facebook.net`,
```

Remove the two unused entries from `images.remotePatterns`:
`avatars.githubusercontent.com` and `cdn.jsdelivr.net`.

**Verify**:

- `bun run type-check` → exit 0.
- `grep -n "unsafe-eval" next.config.ts` → present only inside the
  `isDev` conditional.
- `grep -n "avatars.githubusercontent.com\|cdn.jsdelivr.net" next.config.ts` → no match.
- Load the app locally (`bun run dev`) and confirm Stripe Connect's
  embedded onboarding component still renders (manual smoke check — it's
  the one third-party script CSP is scoped around).

### Step 4: Replace the `NEXT_PUBLIC_APP_URL` fallback everywhere

In each of the ~24 files listed in "Current state", replace
`process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app"` (or the
`?? "https://hoador.com"` variant in `neighborhood-needs-service.ts`) with
`getAppUrl()`, importing it from `@/env`. This is mechanical — the
surrounding code (building a link, computing a `baseUrl`) doesn't change.

**Verify**:

- `bun run type-check` → exit 0.
- `grep -rn "NEXT_PUBLIC_APP_URL ||\|NEXT_PUBLIC_APP_URL ??" src --include=*.ts --include=*.tsx | grep -v __tests__` → no matches.
- `grep -rln "getAppUrl" src | wc -l` → ~24 (one per file above, some files
  have 2 call sites collapsing to 1 import each).

### Step 5: Tests

Create `src/env/__tests__/env.test.ts` (or co-locate as
`src/__tests__/env.test.ts` — match whatever convention `src/env.ts` sibling
tests use elsewhere in this repo):

- All required vars present, valid → `validateEnv()` returns them, no throw,
  no `console.error` call.
- A required var missing, `NODE_ENV=production` (use `vi.stubEnv`) →
  throws, message names the missing var.
- A required var missing, `NODE_ENV` unset/`"test"` → does not throw, calls
  `console.error` once (spy it).
- `getAppUrl()` returns `NEXT_PUBLIC_APP_URL` with no fallback logic.

**Verify**: `bun run test:run src/env` → all pass.

## Test plan

Covered by Step 5, plus the manual/empirical checks in Steps 1 and 3's
Verify lines. `bun run ci` → exit 0 (this is the one plan in this batch
worth running the full `ci` script for, since it touches the build and the
boot sequence).

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0; `bun run test:run` → exit 0
- [ ] `bun run build` succeeds locally with `NODE_ENV=production` and a
      `.env.local` missing a non-build-time var (Step 1's empirical check)
- [ ] `NODE_ENV=production bun run start` throws a clear error when a
      required var (e.g. `STRIPE_SECRET_KEY`) is unset
- [ ] `grep -rn "NEXT_PUBLIC_APP_URL ||\|NEXT_PUBLIC_APP_URL ??" src` → no
      matches outside test files
- [ ] `PAYMENT_SERVER_INSTANCE` is constructed with an explicit `apiVersion`
- [ ] Production CSP no longer includes `'unsafe-eval'`; dev CSP still does
- [ ] `next.config.ts`'s `remotePatterns` has no unused host
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      ("Execution order & status")

## STOP conditions

- The `PHASE_PRODUCTION_BUILD` skip does not actually prevent `register()`
  from throwing during `bun run build` (Step 1's empirical Verify) — do not
  paper over this by weakening validation to "always warn, never throw";
  investigate why the phase constant isn't behaving as documented and report
  back instead.
- Any of the ~24 `NEXT_PUBLIC_APP_URL` call sites turns out to run in a
  context where `@/env` can't be imported (e.g. an edge-runtime-only file
  that can't pull in `zod`'s full validation path) — check before assuming;
  if found, give that one file its own minimal inline fallback and note why
  in the PR instead of forcing the shared import.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

None of this plan changes any API response shape, status code, or error
`code`. `NEXT_PUBLIC_APP_URL` only ever appears inside links embedded in
emails/push notifications the app receives as opaque strings — no contract
change. No roadmap Mobile-follow-ups row needed.

## Production cutover

No schema or migration change. One manual step: **before this lands on
staging/prod, confirm every "required" var in `src/env.ts`'s schema is
actually set in that environment's Vercel project settings** — the schema
will now throw at boot (not silently degrade) if one is missing. Add a row
to `13-production-cutover.md` for this pre-flight check, per environment,
listing the 11 required vars from Step 1's schema.

## Maintenance notes

- `src/env.ts`'s schema is the new source of truth for "what does this app
  need to run" — keep it in sync with `.env.example` when either changes.
- If a future var needs to be required only in one environment (e.g.
  staging but not dev), extend `validateEnv()` with an env-aware branch
  rather than loosening the base schema.
- Revisit CSP's `'unsafe-inline'` (Decision 2) if the web UI (R-ARCH-10)
  is kept long-term.
