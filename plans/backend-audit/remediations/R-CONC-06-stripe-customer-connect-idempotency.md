# Plan R-CONC-06: Idempotent Stripe Customer / Connect account get-or-create

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/dal/user.dal.ts src/services/stripe/connect.ts "src/app/api/(payments)/create-setup-intent/route.ts" src/app/api/stripe/payment-sheet-params/route.ts src/app/api/stripe/create-account-session/route.ts src/app/api/stripe/create-account-link/route.ts src/features/rentals/services/rental-service.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: S · **Risk**: LOW · **Depends on**: none
- **Category**: concurrency · **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: CONC-06

## Why this matters

Two parallel requests for the same user (a double-tap, or two screens
mounting at once) can both read `stripeCustomerId`/`stripeConnectedAccountId`
as `null`, both call Stripe's create endpoint, and both write their own id
back with no idempotency key and no conditional write — last write wins. No
money is lost, but the loser's Stripe object is orphaned (invisible to the
user forever) and support has to manually re-link the account: a card saved
against the orphaned customer disappears ("No payment method" at approve
time), and Connect onboarding completed against the orphaned account leaves
payouts permanently blocked. There are actually **three** independent
check-then-create implementations today, not two — a third, undiscovered by
the audit's file list, duplicates the customer-creation logic inline in
`create-setup-intent/route.ts` using a stale session-cached `user` object
instead of even reading the DB fresh.

## Current state

- `src/dal/user.dal.ts:1206-1247` `getOrCreateStripeCustomerId(userId)` —
  reads `user` by id, returns `stripeCustomerId` if present, else
  `PAYMENT_SERVER_INSTANCE.customers.create({email, name, metadata:{userId}})`
  with **no `idempotencyKey`**, then an unconditional
  `UPDATE user SET stripe_customer_id = ... WHERE id = userId`.
- `src/dal/user.dal.ts:1253-1288` `getOrCreateConnectedAccount(userId)` — same
  shape: reads, then `createConnectedAccount(userId, userData.email)`
  (`src/services/stripe/connect.ts:35-54`, `accounts.create({type:"express",
country:"US", email, metadata:{userId}})`, also **no `idempotencyKey`**),
  then an unconditional `UPDATE`.
- **Callers of `getOrCreateStripeCustomerId`**:
  `src/app/api/stripe/payment-sheet-params/route.ts:55`,
  `src/features/rentals/services/rental-service.ts:481` (inside the rental
  approve/charge path — the highest-traffic caller).
- **Callers of `getOrCreateConnectedAccount`**:
  `src/app/api/stripe/create-account-session/route.ts:42`,
  `src/app/api/stripe/create-account-link/route.ts:46`.
- **A third, separate implementation** (not in the audit's file list — found
  during this plan's research):
  `` `src/app/api/(payments)/create-setup-intent/route.ts:29-41` `` does its
  own inline check-then-create, reading `user.stripeCustomerId` off the
  **session's cached user object** (`getAuthenticatedUserResponse()`'s
  result, potentially staler than a fresh DB read) rather than calling
  `userDAL.getOrCreateStripeCustomerId`, and calls
  `PAYMENT_SERVER_INSTANCE.customers.create({email, name:
"${firstName} ${lastName}"})` directly — no idempotency key, no CAS, and a
  **different `name` construction** than `getOrCreateStripeCustomerId`'s
  (`userData.name` vs `` `${firstName} ${lastName}` ``), which matters for
  Step 2 below.
- `src/dal/user.dal.ts:540-548` `getStripeCustomerId(userId)` already exists
  as a plain read helper — reusable for the "re-read after losing the CAS"
  step.
- No idempotency key is used by either creation call today:
  `grep -n "idempotencyKey" src/dal/user.dal.ts src/services/stripe/connect.ts`
  → no matches. Every other Stripe write call in this codebase (`payout.ts`,
  `deposit-hold.ts`, `refund.ts`, `service-payments.ts`) already uses a
  deterministic key — this is the one pair (three call sites) that doesn't.
- `Stripe.errors.StripeIdempotencyError` is available from the installed SDK
  (`node_modules/stripe/cjs/Error.d.ts:105`) — thrown when the same key is
  reused with different request parameters within its 24h retention window.
  Not currently imported or handled anywhere in this codebase.

## Decisions for the maintainer

**Weighing CAS vs. an idempotency key:**

- **CAS alone** (`UPDATE ... WHERE stripe_customer_id IS NULL RETURNING`, no
  idempotency key): makes the _database_ single-writer-safe — only one id is
  ever stored — but does nothing about Stripe. Two concurrent calls still
  create **two distinct Stripe customer objects**; the CAS just picks a
  winner for the DB column, and the loser's object is a **permanent orphan**
  in Stripe with no reference anywhere (Stripe customers/accounts never
  expire on their own, unlike idempotency keys).
- **Idempotency key alone** (`customer-{userId}` / `connect-account-{userId}`,
  no CAS): for a genuine concurrent race with identical request parameters,
  Stripe's own idempotency layer returns the **same object** to both callers
  — no orphan is ever created in that case. But (a) the DB write is still two
  unconditional `UPDATE`s racing each other — harmless _only_ because both
  calls got the same id back, which is only guaranteed when both requests
  build byte-identical parameters; today they don't (the `name` field differs
  between `getOrCreateStripeCustomerId` and `create-setup-intent`'s inline
  copy) — a same-key-different-params race throws `StripeIdempotencyError`
  instead of deduping; and (b) a **crash between the Stripe call succeeding
  and the DB write landing** (process restart, deploy) leaves
  `stripeCustomerId` null in the DB with a real, unlinked Stripe customer
  already created. A retry **within 24h** replays the same key and recovers
  cleanly (same object, DB write now lands). A retry **after 24h** creates a
  **second, different** Stripe object — the first is now a permanent orphan.
  This failure mode is irreducible without durably persisting the
  create-attempt's outcome before returning (R-ARCH-04 territory), and is the
  "loser's orphan customer" the audit's own recommended fix flags.

**Recommendation: use both, and consolidate to one implementation.**
Idempotency key as the primary defense (it's the only thing that prevents an
orphan in the actual concurrent-race scenario CONC-06 describes — a
double-tap or two screens mounting at once, which by construction send
identical parameters from the _same_ code path); CAS as a cheap, unconditional
backstop so the DB never stores two different ids for one user regardless of
how Stripe responds; and a `StripeIdempotencyError` catch that re-reads the
DB and returns the winner's id rather than surfacing a 500, covering the case
where two _different_ call sites (Step 1 collapses this from three
implementations to one, but a defensive catch costs nothing) somehow race
with mismatched parameters. The residual >24h-crash orphan is accepted and
left to a manual ops query (Maintenance notes) — not solved here.

**Review (2026-09-25): don't rethrow on an unresolvable
`StripeIdempotencyError`.** After Step 3 there's only one caller, so the
realistic trigger is a first attempt whose DB write never landed, followed
within 24h by a retry after the user changed their `name`/`email` (the key
is the same, the params differ). Rethrowing then fails **every** call for
that user until the key expires: they can't save a card or be charged for a
day. That's worse than today. Instead, retry once with a one-off key
(`customer-${userId}-${Date.now()}`, resp. `connect-account-…`), CAS-write
the result, and `captureNonCriticalError` with the orphan's context. That's
no worse than today's behavior, and the orphan is the one Maintenance notes
already accepts.

## Commands

| Purpose        | Command                                                                                                                                                                                                                                                                                          | Expected |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Typecheck      | `bun run type-check`                                                                                                                                                                                                                                                                             | exit 0   |
| Lint           | `bun run lint`                                                                                                                                                                                                                                                                                   | exit 0   |
| Targeted tests | `bun run test:run src/dal/__tests__/user.dal.test.ts "src/app/api/(payments)/create-setup-intent" src/app/api/stripe/create-account-session src/app/api/stripe/create-account-link src/app/api/stripe/payment-sheet-params src/features/rentals/services/approve-rental-request-deposit.test.ts` | all pass |
| Real-DB test   | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                                                                                                                                                                        | all pass |
| Full tests     | `bun run test:run`                                                                                                                                                                                                                                                                               | all pass |

## Scope

**In scope**: `src/dal/user.dal.ts` (`getOrCreateStripeCustomerId`,
`getOrCreateConnectedAccount`); `` `src/app/api/(payments)/create-setup-intent/route.ts` ``
(delete its inline duplicate, call the DAL method instead);
`src/services/stripe/connect.ts` (`createConnectedAccount` gains a required
`idempotencyKey` parameter, Step 2; its only caller is
`getOrCreateConnectedAccount`, confirmed in review with
`grep -rn "createConnectedAccount(" src`); tests for all three.

**Out of scope**: `payment-sheet-params/route.ts`,
`create-account-session/route.ts`, `create-account-link/route.ts` (already
correctly call the DAL methods — no change needed, they inherit the fix);
`rental-service.ts:481` (same — already calls the DAL method); an ops
reconciliation job for pre-existing orphans (Maintenance notes, not built
here — cross-plan decision: other Phase 2 plans must not depend on
R-ARCH-04's durable queue unless unavoidable, and this doesn't need to).

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### 1: Idempotent, CAS-guarded `getOrCreateStripeCustomerId`

Replace the body in `user.dal.ts:1206-1247`:

```ts
async getOrCreateStripeCustomerId(userId: string): Promise<string> {
  try {
    const userData = await this.db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (!userData) {
      throw new NotFoundError("User", userId);
    }
    if (userData.stripeCustomerId) {
      return userData.stripeCustomerId;
    }

    const { PAYMENT_SERVER_INSTANCE } = await import("@/services/stripe/server");

    let customerId: string;
    try {
      const customer = await PAYMENT_SERVER_INSTANCE.customers.create(
        { email: userData.email, name: userData.name, metadata: { userId: userData.id } },
        { idempotencyKey: `customer-${userId}` },
      );
      customerId = customer.id;
    } catch (error) {
      const Stripe = (await import("stripe")).default;
      if (error instanceof Stripe.errors.StripeIdempotencyError) {
        // Another call already created a customer under this key with
        // different parameters (a stale key, or a mismatched caller).
        // Re-read: if it landed, use it; otherwise there is nothing to
        // recover from Stripe's side without a fresh key, so rethrow.
        const winner = await this.getStripeCustomerId(userId);
        if (winner) return winner;
        // Nothing landed: same key, changed params (see Decision). Retry once
        // under a one-off key rather than locking the user out for 24h; the
        // first attempt's customer is the accepted orphan.
        const { captureNonCriticalError } = await import("@/lib/api/route-helpers");
        captureNonCriticalError(error, {
          route: "UserDAL.getOrCreateStripeCustomerId",
          action: "idempotency_conflict_fresh_key",
        });
        const retry = await PAYMENT_SERVER_INSTANCE.customers.create(
          { email: userData.email, name: userData.name, metadata: { userId: userData.id } },
          { idempotencyKey: `customer-${userId}-${Date.now()}` },
        );
        customerId = retry.id;
      } else {
        throw error;
      }
    }

    // CAS: only write if nobody beat us to it. On loss, the winner's id is
    // authoritative (and — because the key above is deterministic — is the
    // SAME Stripe object we just got back in the concurrent-race case).
    const [row] = await this.db
      .update(user)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(and(eq(user.id, userId), isNull(user.stripeCustomerId)))
      .returning({ stripeCustomerId: user.stripeCustomerId });

    if (row) {
      return row.stripeCustomerId!;
    }
    const winner = await this.getStripeCustomerId(userId);
    return winner ?? customerId;
  } catch (error) {
    this.handleError(error, "getOrCreateStripeCustomerId");
  }
}
```

Add `isNull` to this file's `drizzle-orm` import (`:1-14`, not currently
imported). The dynamic `import("stripe")` for the error class mirrors the
existing dynamic `import("@/services/stripe/server")` pattern already used
two lines above it in this same function — keep the style consistent rather
than adding a static top-level `import Stripe from "stripe"` to a DAL file
that otherwise has none. **Verify**: `bun run type-check` → exit 0.

### 2: Idempotent, CAS-guarded `getOrCreateConnectedAccount`

Mirror Step 1 in `user.dal.ts:1253-1288`. `createConnectedAccount` needs an
`idempotencyKey` parameter added — update its signature in
`src/services/stripe/connect.ts:35-54`:

```ts
export async function createConnectedAccount(
  userId: string,
  email: string,
  idempotencyKey: string,
): Promise<Stripe.Account> {
  try {
    const account = await PAYMENT_SERVER_INSTANCE.accounts.create(
      { type: "express", country: "US", email, metadata: { userId } },
      { idempotencyKey },
    );
    return account;
  } catch (error) {
    console.error("Error creating connected account:", error);
    throw error;
  }
}
```

Check `grep -rn "createConnectedAccount(" src --include=*.ts` for other
callers before changing the signature — if any exist beyond
`getOrCreateConnectedAccount`, add the new parameter there too (with
`` `connect-account-${userId}` `` as the key) rather than making it optional.
In `getOrCreateConnectedAccount`:

```ts
async getOrCreateConnectedAccount(userId: string): Promise<string> {
  try {
    const userData = await this.db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!userData) {
      throw new NotFoundError("User", userId);
    }
    if (userData.stripeConnectedAccountId) {
      return userData.stripeConnectedAccountId;
    }

    const { createConnectedAccount } = await import("@/services/stripe/connect");
    let accountId: string;
    try {
      const account = await createConnectedAccount(
        userId,
        userData.email,
        `connect-account-${userId}`,
      );
      accountId = account.id;
    } catch (error) {
      const Stripe = (await import("stripe")).default;
      if (error instanceof Stripe.errors.StripeIdempotencyError) {
        const winner = await this.getConnectedAccountId(userId);
        if (winner) return winner;
        // Same one-off-key fallback as Step 1 (with captureNonCriticalError).
        const retry = await createConnectedAccount(
          userId,
          userData.email,
          `connect-account-${userId}-${Date.now()}`,
        );
        accountId = retry.id;
      } else {
        throw error;
      }
    }

    const [row] = await this.db
      .update(user)
      .set({ stripeConnectedAccountId: accountId, updatedAt: new Date() })
      .where(and(eq(user.id, userId), isNull(user.stripeConnectedAccountId)))
      .returning({ stripeConnectedAccountId: user.stripeConnectedAccountId });

    if (row) {
      return row.stripeConnectedAccountId!;
    }
    const winner = await this.getConnectedAccountId(userId);
    return winner ?? accountId;
  } catch (error) {
    this.handleError(error, "getOrCreateConnectedAccount");
  }
}
```

`getConnectedAccountId` already exists (`user.dal.ts:1346-1359`) as the
plain-read helper to reuse. **Verify**: `bun run type-check` → exit 0.

### 3: Collapse `create-setup-intent`'s duplicate into the DAL method

In `` `src/app/api/(payments)/create-setup-intent/route.ts` ``, delete the
inline block (`:29-41`, the `let stripeCustomerId = ...` through the
`updateUser` call) and replace with:

```ts
const stripeCustomerId = await userDAL.getOrCreateStripeCustomerId(user.id);
```

This removes the third implementation entirely (fixing the "same
idempotency key, different `name` construction" mismatch by construction —
there is now only one place that builds the `customers.create` params) and
also fixes the pre-existing staleness bug where this route trusted the
session-cached `user.stripeCustomerId` instead of a fresh read.
`PAYMENT_SERVER_INSTANCE` may become unused in this file after the deletion
— remove the import only if `grep -n "PAYMENT_SERVER_INSTANCE"` shows no
other use in the file (it's still used for `setupIntents.create` below, so
it will stay). **Verify**: `bun run type-check` → exit 0;
`grep -n "customers.create" "src/app/api/(payments)/create-setup-intent/route.ts"`
→ no matches.

### 4: Tests

- **DAL** (`user.dal.test.ts`): extend or add cases for
  `getOrCreateStripeCustomerId`/`getOrCreateConnectedAccount`: existing id
  present → Stripe never called; Stripe create called with
  `idempotencyKey: "customer-{userId}"` / `"connect-account-{userId}"`; CAS
  write uses `WHERE ... AND stripe_customer_id IS NULL` (render the query per
  this file's existing pattern, or assert via a mocked `.returning()` result
  of length 0 → the function falls back to `getStripeCustomerId` and returns
  its value instead of throwing; `StripeIdempotencyError` thrown by the mock
  → caught, `getStripeCustomerId` called, its result returned (not rethrown);
  `StripeIdempotencyError` and `getStripeCustomerId` → `null` → a second
  `customers.create` with a key matching `/^customer-<id>-\d+$/`, and the
  CAS writes that id.
- **Route** (`create-setup-intent/__tests__/route.test.ts`, extend
  existing): mock `userDAL.getOrCreateStripeCustomerId` instead of
  `PAYMENT_SERVER_INSTANCE.customers.create`/`userDAL.updateUser` directly —
  update any existing test that asserted the old inline behavior.
- **Real-DB** (new file
  `src/dal/__tests__/stripe-customer-cas.integration.test.ts`, modeled on
  `deposit-hold-claim.integration.test.ts`'s `raceTwo` pattern): mock
  `@/services/stripe/server` so `customers.create` returns a fixed
  `{id: "cus_race"}` regardless of call count (simulating Stripe's own
  idempotency-key dedup, which a local test can't exercise against the real
  Stripe API); seed a real user with `stripeCustomerId: null`; fire two
  concurrent `userDAL.getOrCreateStripeCustomerId(user.id)` calls via
  `raceTwo`; assert both resolve to `"cus_race"`, exactly one `UPDATE`
  affected a row (the other's CAS returned 0 and fell back to the read), and
  a final `db.select` shows `stripeCustomerId === "cus_race"` (not
  overwritten by a second, different value). Repeat for
  `getOrCreateConnectedAccount`.

**Verify**: the targeted command in Commands, then
`docker compose up -d && bun run db:push:e2e && bun run test:integration` →
all pass.

## Test plan

Step 4 covers the CAS write (real-DB race — the actual concurrency claim),
the idempotency key (unit, since a local test can't hit real Stripe
dedup — the mock stands in for it), and the `StripeIdempotencyError` fallback
path (unit). Full regression: `bun run test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration`
      → exit 0, includes the new CAS race test(s)
- [ ] `grep -n "idempotencyKey" src/dal/user.dal.ts src/services/stripe/connect.ts`
      shows hits in both files
- [ ] `grep -n "customers.create" "src/app/api/(payments)/create-setup-intent/route.ts"`
      → no matches (duplicate removed)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 2 step outline item 9, and its own Execution-order row once one
      exists)

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`).
- `grep -rn "createConnectedAccount(" src --include=*.ts` finds a caller
  other than `getOrCreateConnectedAccount` — add the new required parameter
  there too rather than silently breaking it; if there are several and
  making the parameter required is disruptive, make it optional with a
  fallback (`idempotencyKey ?? undefined`, i.e. no key) only for those other
  callers, and say so in this plan's Maintenance notes.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

No API shape change on any of the four routes — same success response, same
error shape on failure (a `StripeIdempotencyError` is absorbed by the DB
re-read or the one-off-key retry; any other Stripe error still reaches
`handleApiError`'s generic path, as today). No new
`code`, no roadmap Mobile client follow-ups row needed. The mobile Connect
provider's own concurrency behavior (Open question 6 in
`05-concurrency-findings.md`: "does the mobile Connect provider call
`create-account-session` concurrently on first mount?") is exactly the
scenario this plan protects against regardless of the answer — no
mobile-side change is needed either way.

## Production cutover

No migration, no manual step. This plan changes application code only — no
new row needed in `13-production-cutover.md`.

## Maintenance notes

- **Residual risk, not fixed here**: a crash between a successful Stripe
  `create` and the DB `UPDATE` landing, followed by a retry more than 24h
  later, still orphans the first Stripe object (Decision section). If this
  becomes a real incident class, an ops query to find orphans:
  `stripe customers list --limit 100` (paginate) cross-referenced against
  `SELECT id FROM "user" WHERE stripe_customer_id IS NOT NULL` — any Stripe
  customer whose `metadata.userId` doesn't match a `user.stripe_customer_id`
  pointing back to it is an orphan. Same approach for Connect accounts via
  `stripe accounts list`. Building this as an automated reconciliation job
  belongs with R-ARCH-04, not here.
- If a future feature needs to _force_ a fresh Stripe customer even when one
  already exists (e.g. after PRIV-09's retention window expires and the old
  customer is deleted), that's a new method, not a change to
  `getOrCreateStripeCustomerId` — this method's contract stays "return the
  one durable customer for this user, creating it at most once."
