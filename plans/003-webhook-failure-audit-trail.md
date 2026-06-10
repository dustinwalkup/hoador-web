# Plan 003: Record Stripe webhook handler failures and unmatched payment events in the audit log

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- src/services/stripe/webhook-handlers.ts src/app/api/stripe/webhooks/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (observability on the money path)
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

When any Stripe webhook handler throws, the route returns 500 (so Stripe retries — good) but the only trace is a `console.error` in the route: no Sentry capture, no audit-log record. The success-path audit log (`webhook.processed`) is written only after all handlers complete, so a persistently failing event (a code bug, bad data) exhausts Stripe's ~3-day retry schedule and vanishes without any database evidence. Separately, `payment_intent.succeeded` and `charge.refunded` silently no-op when no matching payment record exists — a charge can exist in Stripe with no reconciliation trail on our side.

## Current state

- `src/services/stripe/webhook-handlers.ts:13-80` — `handleWebhookEvent` is a bare `switch` over `event.type` dispatching to `await handle…` functions, followed unconditionally (success path only, since a throw skips it) by:
  ```ts
  await auditLogDAL.create({
    entityType: "webhook",
    entityId: event.id,
    action: "webhook.processed",
    metadata: { eventType },
  });
  ```
- `src/services/stripe/webhook-handlers.ts:108-118` — `handlePaymentIntentSucceeded`:
  ```ts
  const existingPayment = await paymentDAL.getByPaymentIntentId(pi.id);
  if (existingPayment && existingPayment.status !== "succeeded") { …update… }
  ```
  If `existingPayment` is null, the function returns silently — no log at all.
- `src/services/stripe/webhook-handlers.ts:208-215` — `handleChargeRefunded` logs a `getLogger().warn` when no payment record is found, then returns. Warn-level log only, no durable record.
- `src/app/api/stripe/webhooks/route.ts:58-67` — the route:
  ```ts
  await handleWebhookEvent(event);
  return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  ```
- Conventions: structured logging via `getLogger()` from `@/lib/logger` (already imported in both files); `tryCatch` from `@walkup/walkup-utils` for non-throwing awaits (already imported in webhook-handlers.ts); Sentry capture pattern with tags in `src/lib/api/route-helpers.ts:63-76` (`import * as Sentry from "@sentry/nextjs"`).
- `auditLogDAL.create` accepts `{ entityType, entityId, action, metadata }` (see usage above; DAL at `src/dal/audit-log.dal.ts`).
- The known race: `approveRentalRequest` (in `src/features/rentals/services/rental-service.ts`) charges Stripe synchronously and creates the payment record _afterwards_, so a `payment_intent.succeeded` webhook can legitimately arrive before the record exists. Unmatched events must therefore be **recorded, not ops-alerted** — an email per race would be noise.

## Commands you will need

| Purpose        | Command                                                   | Expected on success |
| -------------- | --------------------------------------------------------- | ------------------- |
| Typecheck      | `bun run type-check`                                      | exit 0              |
| Lint           | `bun run lint`                                            | exit 0              |
| Targeted tests | `bun run test:run src/app/api/stripe src/services/stripe` | all pass            |
| Full tests     | `bun run test:run`                                        | all pass            |

## Scope

**In scope**:

- `src/services/stripe/webhook-handlers.ts`
- `src/app/api/stripe/webhooks/route.ts`
- `src/services/stripe/__tests__/webhook-handlers.test.ts` (create if absent)
- `src/app/api/stripe/webhooks/__tests__/route.test.ts` (extend)

**Out of scope**:

- The individual handler business logic (`handleAccountUpdated`, `ChargebackService`, etc.) — do not change what they do, only what happens around them.
- Building a reconciliation job that _acts_ on unmatched events — this plan only makes them visible.
- Webhook signature verification (`constructEvent`) — already correct.
- `sendOpsAlert` calls — do not add new ops emails (see race note above).

## Git workflow

- Branch: `advisor/003-webhook-failure-audit-trail` off `develop`
- Commit per step; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Audit-log and rethrow on handler failure

In `handleWebhookEvent`, wrap the `switch` in `try/catch`. On catch: structured-log the failure, best-effort write a `webhook.failed` audit record (its own failure must not mask the original error — use `tryCatch`), then **rethrow** so the route still returns 500 and Stripe retries:

```ts
try {
  switch (
    eventType
    // …existing cases unchanged…
  ) {
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  getLogger().error(
    {
      message: "webhook.handler_failed",
      eventId: event.id,
      eventType,
      error: errorMessage,
    },
    "Stripe webhook handler threw",
  );
  await tryCatch(
    auditLogDAL.create({
      entityType: "webhook",
      entityId: event.id,
      action: "webhook.failed",
      metadata: { eventType, error: errorMessage },
    }),
  );
  throw error;
}
```

The existing `webhook.processed` audit write stays after the try/catch (success path only). Note: Stripe redelivers events, so on a later successful retry the same `event.id` gets a `webhook.processed` row — that pairing is the intended forensic trail; do not dedupe.

**Verify**: `bun run type-check` → exit 0.

### Step 2: Record unmatched payment events

First, inspect the metadata written by `chargeRentalPayment` (`src/services/stripe/rental-payments.ts:29`) so you know what a _platform rental charge_ PI looks like vs. a deposit-hold PI (deposit holds set `paymentType: "security_deposit_hold"` — see `authorizeSecurityDeposit` in the same file).

In `handlePaymentIntentSucceeded`, when `existingPayment` is null **and** the PI is not a deposit hold (`pi.metadata?.paymentType !== "security_deposit_hold"`), write a durable record instead of silently returning:

```ts
if (!existingPayment) {
  if (pi.metadata?.paymentType !== "security_deposit_hold") {
    getLogger().warn(
      {
        message: "webhook.unmatched_payment_intent",
        paymentIntentId: pi.id,
        amount: pi.amount,
      },
      "payment_intent.succeeded with no matching payment record",
    );
    await tryCatch(
      auditLogDAL.create({
        entityType: "webhook",
        entityId: pi.id,
        action: "webhook.unmatched_payment_intent",
        metadata: {
          eventSource: "payment_intent.succeeded",
          amount: pi.amount,
          metadata: pi.metadata ?? {},
        },
      }),
    );
  }
  return;
}
```

In `handleChargeRefunded`, in the existing `if (!payment)` branch (which already warns), add the same pattern with action `webhook.unmatched_charge_refund` and `entityId: charge.id`, metadata `{ paymentIntentId, amountRefunded: charge.amount_refunded }`.

**Verify**: `bun run type-check` → exit 0. `grep -n "unmatched" src/services/stripe/webhook-handlers.ts` → two actions present.

### Step 3: Replace console.error with structured log + Sentry in the route

In `src/app/api/stripe/webhooks/route.ts`, the outer catch becomes:

```ts
} catch (error) {
  getLogger().error(
    { message: "webhook.route_failed", error: error instanceof Error ? error.message : String(error) },
    "Stripe webhook processing failed",
  );
  Sentry.captureException(error, { tags: { route: "POST /api/stripe/webhooks" } });
  return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
}
```

Add `import * as Sentry from "@sentry/nextjs";` (pattern: `src/lib/api/route-helpers.ts:2`). Keep the 400 paths and the 500 status exactly as they are — the 500 is what makes Stripe retry.

**Verify**: `bun run type-check` → exit 0. `grep -n "console.error" src/app/api/stripe/webhooks/route.ts` → no output.

### Step 4: Tests

**`src/services/stripe/__tests__/webhook-handlers.test.ts`** (create if it doesn't exist; if it exists, extend). Mock `@/dal` (`paymentDAL`, `auditLogDAL`, `userDAL`, `paymentLifecycleDAL`), `@/lib/logger`, `@/features/notifications/lib/ops-alerts`, `@/features/notifications/utils/send-notification`, and `./chargeback-service` — model the mock style on `src/app/api/stripe/webhooks/__tests__/route.test.ts`. Cases:

1. handler throws (e.g. `paymentDAL.getByPaymentIntentId` rejects on a `payment_intent.succeeded` event) → `auditLogDAL.create` called with `action: "webhook.failed"`, and `handleWebhookEvent` rejects (rethrow preserved).
2. `payment_intent.succeeded`, no payment record, metadata without `paymentType` → audit log `webhook.unmatched_payment_intent` created, nothing thrown.
3. `payment_intent.succeeded`, no payment record, metadata `paymentType: "security_deposit_hold"` → NO unmatched audit log (deposit holds excluded).
4. `charge.refunded`, no payment record → audit log `webhook.unmatched_charge_refund`.
5. happy path (`payment_intent.succeeded` with existing non-succeeded payment) → `webhook.processed` audit log, no `webhook.failed`.

**`src/app/api/stripe/webhooks/__tests__/route.test.ts`** (extend): `mockHandleWebhookEvent.mockRejectedValue(new Error("boom"))` → response status 500 and `Sentry.captureException` called (add a `vi.mock("@sentry/nextjs", …)`).

**Verify**: `bun run test:run src/services/stripe src/app/api/stripe` → all pass, including the new cases.

## Test plan

Covered in Step 4. Also run the full suite: `bun run test:run` → exit 0.

## Done criteria

- [ ] A throwing handler produces a `webhook.failed` audit row AND still rejects (route returns 500)
- [ ] Unmatched `payment_intent.succeeded` (non-deposit) and `charge.refunded` events produce durable audit rows
- [ ] No `console.error` remains in the webhook route; Sentry capture added
- [ ] `bun run type-check`, `bun run lint`, `bun run test:run` exit 0; new tests exist and pass
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The "Current state" excerpts don't match the live code (drift).
- `auditLogDAL.create`'s signature rejects the metadata shapes above — report; do not invent schema changes.
- You cannot determine from `rental-payments.ts` how to distinguish deposit-hold PIs from charge PIs — report with what you found instead of guessing a filter.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The audit rows (`webhook.failed`, `webhook.unmatched_*`) are write-only until someone builds a reconciliation view/cron over them. If unmatched volume turns out to be dominated by the approve-flow race, add a time-delay re-check before flagging (deferred from this plan deliberately).
- Reviewer should confirm the rethrow in Step 1 — swallowing the error there would silently disable Stripe's retry, which is worse than the current state.
- If a future change makes payment-record creation happen _before_ the Stripe charge (closing the race), the deposit-hold exclusion in Step 2 can be revisited.
