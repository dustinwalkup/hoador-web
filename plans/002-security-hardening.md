# Plan 002: Guard the database-wipe script, lock down create-payment-intent, make secret comparisons constant-time

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- clear-database-complete.ts "src/app/api/(payments)/create-payment-intent/route.ts" src/lib/api/verify-cron-secret.ts src/app/api/internal/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

Three independent hardening gaps, all small fixes:

1. `clear-database-complete.ts` (repo root, committed) executes `DROP TABLE … CASCADE` on whatever `DATABASE_URL` points to, with no environment check and no confirmation. One accidental `bunx tsx clear-database-complete.ts` in a shell whose env holds the production URL destroys production. This team has prior history of being deliberately careful with prod data operations — this script is the opposite.
2. `POST /api/(payments)/create-payment-intent` lets **any authenticated user** create a Stripe PaymentIntent for an **arbitrary client-supplied amount** with no Zod validation, no upper bound, and no linkage to any rental/booking. Its only legitimate caller is an admin demo page (`src/app/admin/dashboard/how-it-works/payments/page.tsx`).
3. `CRON_SECRET` and `INTERNAL_API_SECRET` are compared with `!==`, a non-constant-time comparison. Practical exploitability over a network is low, but `crypto.timingSafeEqual` is the standard and the fix is a few lines.

## Current state

- `clear-database-complete.ts:1-40` — begins `import { db } from "./src/db/db";` then loops `await db.execute(\`DROP TABLE IF EXISTS "${table}" CASCADE\`)` over every app table including better-auth tables. No guard of any kind.
- `src/app/api/(payments)/create-payment-intent/route.ts` (full handler):
  ```ts
  const authResult = await getAuthenticatedUserResponse();
  if (authResult instanceof NextResponse) return authResult;
  const { amount } = await request.json();
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: "Valid amount is required" },
      { status: 400 },
    );
  }
  const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.create({
    amount,
    currency: "usd",
    capture_method: "manual",
    metadata: { type: "rental_request" },
  });
  ```
  Note `amount` is passed straight to Stripe (units = cents) from the request body.
- `src/lib/api/verify-cron-secret.ts:24` — `if (authHeader !== \`Bearer ${cronSecret}\`)`. (The missing-secret path correctly fails closed with a 500 at lines 13-21; leave that behavior alone.)
- `src/app/api/internal/generate-rental-agreement/route.ts` and `src/app/api/internal/generate-service-agreement/route.ts` — both contain:
  ```ts
  if (authHeader !== `Bearer ${internalSecret}`) {
    console.warn("[pdf-gen-route] auth mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```
- Repo conventions: API routes use `getAuthenticatedUserResponse`/`requireAdminResponse`/`handleApiError` from `src/lib/api/route-helpers.ts`; request bodies validated with Zod (exemplar: `src/app/api/rentals/[id]/approve/route.ts`, which defines a `z.object` schema and `safeParse`s).
- Existing scripts live in `scripts/` (e.g. `scripts/e2e-setup.ts`); unit tests live in sibling `__tests__/` directories.

## Commands you will need

| Purpose        | Command                        | Expected on success |
| -------------- | ------------------------------ | ------------------- |
| Typecheck      | `bun run type-check`           | exit 0              |
| Lint           | `bun run lint`                 | exit 0              |
| Targeted tests | `bun run test:run src/lib/api` | all pass            |
| Full tests     | `bun run test:run`             | all pass            |

## Scope

**In scope**:

- `clear-database-complete.ts` → moved to `scripts/clear-database-complete.ts` with guard
- `src/app/api/(payments)/create-payment-intent/route.ts`
- `src/lib/api/timing-safe-equal.ts` (create)
- `src/lib/api/verify-cron-secret.ts`
- `src/app/api/internal/generate-rental-agreement/route.ts` (the comparison line only)
- `src/app/api/internal/generate-service-agreement/route.ts` (the comparison line only)
- `src/lib/api/__tests__/verify-cron-secret.test.ts` (create)
- `src/lib/api/__tests__/timing-safe-equal.test.ts` (create)

**Out of scope**:

- `src/app/admin/dashboard/how-it-works/payments/page.tsx` — the demo page; it already sits behind the admin area. Only touch it if Step 2's verification shows it breaks (then STOP and report instead).
- The 500-on-missing-CRON_SECRET behavior in `verify-cron-secret.ts` — it fails closed; do not change status codes.
- `src/app/api/test/*` routes — separately guarded, intentionally left alone.
- Any other route's auth pattern.

## Git workflow

- Branch: `advisor/002-security-hardening` off `develop`
- Commit per step; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move and guard the database-wipe script

`git mv clear-database-complete.ts scripts/clear-database-complete.ts`. Fix the import path (`./src/db/db` → `../src/db/db`). Then add this guard at the very top of the file, **before** any other statement that touches `db` (imports may stay above it — the pool connects lazily on first query):

```ts
const dbUrl = process.env.DATABASE_URL ?? "";
const isLocalDb = /localhost|127\.0\.0\.1/.test(dbUrl);
if (process.env.NODE_ENV === "production" || !isLocalDb) {
  console.error(
    "REFUSING to clear a non-local database.\n" +
      `DATABASE_URL host is not localhost (or NODE_ENV is production).\n` +
      "This script DROPS ALL TABLES. It only runs against local databases.",
  );
  process.exit(1);
}
```

Deliberately **no** override env var — if someone truly needs to wipe a remote dev database, they can edit the script locally; an override flag would eventually be set in someone's shell profile.

**Verify**:

- `DATABASE_URL="postgresql://u:p@some-remote-host.neon.tech/db" bunx tsx scripts/clear-database-complete.ts` → prints REFUSING, exit code 1 (`echo $?` → 1). No DB connection is attempted.
- `git status` shows the root file deleted and the scripts/ file added.
- `bun run type-check` → exit 0.

### Step 2: Lock down create-payment-intent

In `src/app/api/(payments)/create-payment-intent/route.ts`:

1. Replace `getAuthenticatedUserResponse()` with `requireAdminResponse()` (import from `@/lib/api/route-helpers`; it returns a `NextResponse` on failure, `null` on success — note the different contract from `getAuthenticatedUserResponse`).
2. Validate the body with Zod (import `z` from `"zod"`, matching `src/app/api/rentals/[id]/approve/route.ts`):
   ```ts
   const bodySchema = z.object({
     amount: z.number().int().positive().max(1_000_000), // cents; $10,000 cap
   });
   ```
   `safeParse` the parsed JSON; on failure return 400 with `{ error: "Invalid amount" }`.
3. Keep the Stripe call and response shape (`{ clientSecret }`) unchanged.

Rationale recorded for the reviewer: the route's only caller in the codebase is the admin "how-it-works" demo (`grep -rn "create-payment-intent" src --include="*.tsx"`), so admin-gating cannot break end-user flows. Real rental charges go through `chargeRentalPayment` server-side and never touch this route.

**Verify**:

- `bun run type-check` → exit 0.
- `grep -n "requireAdminResponse" "src/app/api/(payments)/create-payment-intent/route.ts"` → match.
- `grep -rn "create-payment-intent" src --include="*.ts" --include="*.tsx" | grep -v "app/api"` → only the admin how-it-works page (confirms no other caller appeared since planning).

### Step 3: Add a constant-time string comparison helper

Create `src/lib/api/timing-safe-equal.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string equality for secret comparison.
 * Length mismatch returns false without leaking timing on the contents.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 4: Use it in the three secret checks

1. `src/lib/api/verify-cron-secret.ts:24` — replace
   `if (authHeader !== \`Bearer ${cronSecret}\`)`with`if (!authHeader || !timingSafeEqualStrings(authHeader, \`Bearer ${cronSecret}\`))`.
2. Same one-line substitution in `src/app/api/internal/generate-rental-agreement/route.ts` and `src/app/api/internal/generate-service-agreement/route.ts` (the `authHeader !== \`Bearer ${internalSecret}\`` lines). Keep their surrounding placeholder-secret checks and status codes exactly as they are.

**Verify**: `grep -rn 'Bearer \${' src/lib/api/verify-cron-secret.ts src/app/api/internal/ | grep '!=='` → no output. `bun run type-check` → exit 0.

### Step 5: Tests

Create `src/lib/api/__tests__/timing-safe-equal.test.ts`: equal strings → true; different same-length → false; different lengths → false; empty vs empty → true.

Create `src/lib/api/__tests__/verify-cron-secret.test.ts` (vitest; construct `NextRequest` like `src/app/api/stripe/webhooks/__tests__/route.test.ts` does). Set/restore `process.env.CRON_SECRET` per test:

- secret set + correct `Authorization: Bearer <secret>` → `{ authorized: true }`
- secret set + wrong header → `authorized: false`, response status 401
- secret set + missing header → 401
- secret unset → `authorized: false`, response status 500

**Verify**: `bun run test:run src/lib/api` → all pass.

## Test plan

Covered by Step 5. Existing cron route tests (`src/app/api/cron/__tests__/`) must continue to pass: `bun run test:run src/app/api/cron` → all pass (they may mock `verifyCronSecret`; if any asserts on the comparison internals, update the assertion to the new behavior, not the production code).

## Done criteria

- [ ] Root `clear-database-complete.ts` no longer exists; `scripts/clear-database-complete.ts` exits 1 against a non-local `DATABASE_URL`
- [ ] `create-payment-intent` route requires admin and Zod-validates `amount` (int, positive, ≤ 1,000,000)
- [ ] No `!==`-based secret comparison remains in `verify-cron-secret.ts` or `src/app/api/internal/*`
- [ ] `bun run type-check`, `bun run lint` exit 0
- [ ] `bun run test:run` exits 0, including the new test files
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at any "Current state" location doesn't match the excerpt (drift).
- You find a non-admin caller of `create-payment-intent` anywhere in `src/` — the admin-gating assumption is false; report instead of gating.
- The internal routes' secret checks have been refactored into a shared helper already — apply the timing-safe change there instead, and report the deviation.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Follow-up (2026-06-10):** after this plan landed, the `create-payment-intent` route was found to have **zero callers** anywhere in the repo — the admin "how-it-works" page only _documented_ it (and self-flagged it for removal), it never invoked it. The route was deleted as dead code along with its two doc references on the how-it-works page. The Step 2 admin-gating hardening is therefore moot; this note supersedes it. Plan 006 Step 4 (tests for this route) is consequently N/A.
- If a real user-facing flow ever needs client-created PaymentIntents, do NOT reopen this route — build a purpose-specific route that derives the amount server-side from the rental/booking record.
- `timingSafeEqualStrings` should be used for any future shared-secret check (e.g. new internal/cron routes); reviewers should flag new `!== \`Bearer …\`` patterns.
- Deferred deliberately: boot-time env validation (fail deployment when CRON_SECRET/STRIPE_WEBHOOK_SECRET/INTERNAL_API_SECRET are unset). Worth a future plan if a misconfigured deploy ever recurs; today every consumer fails closed.
