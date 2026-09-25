# Plan R-SEC-07: Check payment-method ownership before detach; allowlist booking and lifecycle responses

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 25e2233..HEAD -- src/app/api/stripe/delete-payment-method/route.ts src/services/stripe/payment-method.ts src/dal/service-booking.dal.ts src/app/api/services/bookings/route.ts src/app/api/services/bookings/[id]/payment-lifecycle/route.ts src/dal/service-payment-lifecycle.dal.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none
- **Category**: security / privacy · **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: SEC-07, PRIV-04

## Why this matters

`DELETE /api/stripe/delete-payment-method?id=` never checks that the `pm_`
belongs to the caller — it detaches whatever id it's given with the
platform's Stripe key. A provider who reads a requester's
`selectedPaymentMethodId` off the booking list (see below) can permanently
disable that card: Stripe documents that a detached PM can't be reused
(`node_modules/stripe/cjs/resources/PaymentMethods.d.ts:43`).

Separately, `GET /api/services/bookings?role=` and
`GET /api/services/bookings/[id]/payment-lifecycle` both spread full DB
rows: the list leaks the counterparty's email, Stripe payment-intent/charge/
refund ids, and the requester's `pm_` id (the field that makes the SEC-07
attack possible); the lifecycle route shows a requester the provider's
payout and Stripe transfer/charge ids. `POST /api/services/bookings/[id]`'s
detail route was already allow-listed for exactly this (mobile P-E9-3) — the
list and lifecycle routes were missed.

## Current state

- `src/app/api/stripe/delete-payment-method/route.ts:14-45` `deleteHandler` —
  authenticates but never reads `userId` off the result; goes straight from
  `paymentMethodId` to `detachPaymentMethod(paymentMethodId)` (`:32`). No
  ownership check exists.
- `src/services/stripe/payment-method.ts:159-163` `detachPaymentMethod` —
  thin wrapper, `paymentMethods.detach(paymentMethodId)`, no context. `:172-190`
  `detachAllPaymentMethodsForCustomer` (from R-BIZ-07) already lists PMs
  scoped to a customer before detaching each — the pattern to reuse for
  "retrieve, then check `.customer`."
- `src/dal/service-booking.dal.ts:42-46` `ServiceBookingUserInfo` includes
  `email: string`. `:775-815` `findByRequesterForDashboard` and `:822-862`
  `findByProviderForDashboard` both select `counterparty: {..., email: bookingProvider.email}` /
  `{..., email: bookingRequester.email}` (`:789`, `:836`) and return
  `{...row.booking, listingTitle, counterparty}` — the full `serviceBookings`
  row, including `stripePaymentIntentId`, `stripeChargeId`, `stripeRefundId`,
  `selectedPaymentMethodId` (columns at `services.schema.ts:115-133`).
- `src/app/api/services/bookings/route.ts:41-51` `getListHandler` returns
  `{ bookings: data ?? [] }` — no projection.
- `src/app/api/services/bookings/[id]/payment-lifecycle/route.ts:15-68` —
  authorizes either `requesterId` or `providerId` (`:45`), then
  `return NextResponse.json(lifecycle)` (`:64`) — the full
  `ServicePaymentLifecycleRecord` (`service-payment-lifecycle.schema.ts:22-65`:
  `chargeId`, `providerPayout`, `ownerTransferStatus`, `payoutStatus`,
  `stripeTransferId`, `ownerTransferredAt`, `transferAmount`).
- No consumer reads the lifecycle route today: `grep -rn "payment-lifecycle" hoador-mobile/src`
  and `grep -rn "bookings/\[id\]/payment-lifecycle" src/app src/features` in
  this repo both come up empty (the only string matches are unrelated admin
  _rental_ lifecycle pages). Zero blast radius for narrowing it.
- Web consumers of the list route that must keep working —
  `use-service-bookings.ts`, `service-booking-card.tsx`,
  `services-flow-client.tsx` — only ever read `id`, `listingTitle`,
  `counterparty.{firstName,lastName,profileImageUrl}`, `proposedDate`,
  `proposedTime`, `status`, `totalAmount`, `createdAt` (confirmed by reading
  all three), never `email` or a Stripe/pm field. Mobile has no call site at
  all for `GET /api/services/bookings?role=` (`grep -rn "role=provider\|role=requester" hoador-mobile/src` — no hits; its Schedule reads a different, already-allow-listed aggregate).

## Commands

| Purpose   | Command                                                                                                                                                       | Expected |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck | `bun run type-check`                                                                                                                                          | exit 0   |
| Lint      | `bun run lint`                                                                                                                                                | exit 0   |
| Tests     | `bun run test:run src/app/api/stripe/delete-payment-method src/app/api/services/bookings src/features/services src/dal/__tests__/service-booking.dal.test.ts` | all pass |

## Scope

**In scope**: `src/app/api/stripe/delete-payment-method/route.ts`,
`src/dal/service-booking.dal.ts` (drop `email` from the two dashboard
selects; narrow `ServiceBookingDashboardRow.counterparty`'s type),
`src/features/services/lib/service-booking-projections.ts` (new),
`src/app/api/services/bookings/route.ts`,
`src/app/api/services/bookings/[id]/payment-lifecycle/route.ts`,
`src/features/services/hooks/use-service-bookings.ts`,
`src/features/services/components/service-booking-card.tsx`,
`src/features/services/components/services-flow-client.tsx` (type-only
import swaps), and tests for all of the above.

**Out of scope**: `GET /api/services/bookings/[id]` (already fixed, P-E9-3);
`src/features/dashboard/lib/activity-feed.ts` /
`cached-fetchers.ts` (internal server-side callers of the same DAL methods
that never serialize `email`/Stripe fields to a client — left reading the
full DAL row, which still carries the Stripe fields; only the wire boundary
is narrowed); rewriting `detachAllPaymentMethodsForCustomer` (already scoped
to a customer, not affected).

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### 1 (SEC-07): check ownership before detach

In `delete-payment-method/route.ts`, destructure `userId` from `authResult`
and, after validating `paymentMethodId`, add:

```ts
const customerId = await userDAL.getStripeCustomerId(userId);
const { data: pm, error: retrieveError } = await tryCatch(
  PAYMENT_SERVER_INSTANCE.paymentMethods.retrieve(paymentMethodId),
);
const ownerCustomerId =
  typeof pm?.customer === "string" ? pm.customer : (pm?.customer?.id ?? null);
if (retrieveError || !pm || !customerId || ownerCustomerId !== customerId) {
  return NextResponse.json(
    { error: "Payment method not found" },
    { status: 404 },
  );
}
```

Import `userDAL` from `@/dal` and `PAYMENT_SERVER_INSTANCE` from
`@/services/stripe/server`. Leave the existing `detachPaymentMethod` call
after this block unchanged.

**Verify**: `bun run type-check` → exit 0.

### 2 (PRIV-04 + SEC-07 list leak): drop `email` from the DAL projection

In `service-booking.dal.ts`, remove `email: bookingProvider.email,`
(`:789`) and `email: bookingRequester.email,` (`:836`). Change
`ServiceBookingDashboardRow`'s `counterparty` field type from
`ServiceBookingUserInfo` to `Omit<ServiceBookingUserInfo, "email">` (leave
`ServiceBookingUserInfo` itself and every other user of it, e.g.
`ServiceBookingWithDetails`, unchanged).

**Verify**: `bun run type-check` → exit 0. `grep -n "email: booking" src/dal/service-booking.dal.ts` returns no match.

### 3 (PRIV-04 + SEC-07 list leak): allowlist the booking list response

Create `src/features/services/lib/service-booking-projections.ts`:

```ts
import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import type { ServicePaymentLifecycleRecord } from "@/db/schemas/service-payment-lifecycle.schema";

/**
 * Payment identifiers this row carries only because it spreads the full
 * `service_bookings` table (PRIV-04). None of the list's consumers — the web
 * dashboard cards, mobile's Schedule (which doesn't call this route at all)
 * — read them, and `selectedPaymentMethodId` is what makes SEC-07's detach
 * attack possible in the first place.
 */
type SensitiveBookingField =
  | "stripePaymentIntentId"
  | "stripeChargeId"
  | "stripeRefundId"
  | "selectedPaymentMethodId";

export type ServiceBookingListItem = Omit<
  ServiceBookingDashboardRow,
  SensitiveBookingField
>;

export function toServiceBookingListItem(
  row: ServiceBookingDashboardRow,
): ServiceBookingListItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    stripePaymentIntentId,
    stripeChargeId,
    stripeRefundId,
    selectedPaymentMethodId,
    ...rest
  } = row;
  return rest;
}

/** Nobody reads this route today; still allow-listed rather than spread (PRIV-04). */
type SensitiveLifecycleField = "chargeId" | "stripeTransferId";

export type ServiceBookingLifecycleResponse = Omit<
  ServicePaymentLifecycleRecord,
  SensitiveLifecycleField
>;

export function toServiceBookingLifecycleResponse(
  record: ServicePaymentLifecycleRecord,
): ServiceBookingLifecycleResponse {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { chargeId, stripeTransferId, ...rest } = record;
  return rest;
}
```

**Make both projections allowlists, not denylists.** The `Omit`/rest-spread
shape above shows which fields go, but a rest spread passes any column added
to `service_bookings` or `service_payment_lifecycle` later straight to the
client. That's the failure mode PRIV-04 is about, and why R-PRIV-01/R-PRIV-03 used
explicit mappers. Implement each function as an explicit object literal
that names every field it returns: every current column of the row except
the sensitive ones, plus `listingTitle` and
`counterparty: { id, firstName, lastName, profileImageUrl }` (read the
column list from `services.schema.ts` and
`service-payment-lifecycle.schema.ts`). Keep the exported types
(`ServiceBookingListItem`, `ServiceBookingLifecycleResponse`) as `Omit<...>`
so type-check still flags a consumer that reads a dropped field. The
projection test in Step 5 should also assert that an extra, unknown key on
the input row does **not** appear in the output.

In `services/bookings/route.ts`, change
`return NextResponse.json({ bookings: data ?? [] });` to
`return NextResponse.json({ bookings: (data ?? []).map(toServiceBookingListItem) });`.

In `use-service-bookings.ts`, `service-booking-card.tsx` and
`services-flow-client.tsx`, swap the `ServiceBookingDashboardRow` type
import for `ServiceBookingListItem` from
`@/features/services/lib/service-booking-projections` (every field they
read survives the projection, so no other change is needed in these files).

**Verify**: `bun run type-check` → exit 0.

### 4 (PRIV-04 lifecycle leak): provider-only, no Stripe ids

In `payment-lifecycle/route.ts`, change the party check at `:45` from
`if (booking.requesterId !== userId && booking.providerId !== userId)` to
`if (booking.providerId !== userId)` — the finding's recommended fix is
provider-only, and no consumer (web or mobile) reads this route as a
requester today (confirmed above). Change the final response from
`return NextResponse.json(lifecycle);` to
`return NextResponse.json(toServiceBookingLifecycleResponse(lifecycle));`,
importing it from the Step 3 module.

**Verify**: `bun run type-check` → exit 0.

### 5: Tests

- `delete-payment-method/__tests__/route.test.ts` (new; mock
  `@/services/stripe/server` per the repo's existing pattern, e.g.
  `rental-service.approve.test.ts:74`): retrieving a PM whose `customer`
  doesn't match the caller's → 404, `detach` never called; matching customer
  → `detach` called, 200.
- `service-booking.dal.ts`'s existing DAL test file (extend, if present, or
  add cases to `src/dal/__tests__/service-booking.dal.test.ts`):
  `findByRequesterForDashboard`/`findByProviderForDashboard` rows have no
  `counterparty.email` key.
- `service-booking-projections.test.ts` (new): a fixture row with all four
  sensitive fields set, plus an unknown extra key → `toServiceBookingListItem`
  drops the four fields and the unknown key and keeps every allowlisted field; same shape for
  `toServiceBookingLifecycleResponse` with `chargeId`/`stripeTransferId`.
- `services/bookings/__tests__/route.test.ts` (new): a mocked DAL row with
  `email`, `stripePaymentIntentId`, `selectedPaymentMethodId` set →
  `JSON.stringify` of the response body matches none of
  `/@|stripePaymentIntentId|stripeChargeId|stripeRefundId|selectedPaymentMethodId/`.
- `payment-lifecycle/__tests__/route.test.ts` (new): the booking's requester
  gets 403; the provider gets 200 with no `chargeId`/`stripeTransferId` key.

**Verify**: `bun run test:run` (targeted paths, then full) → all pass.

## Test plan

Covered by Step 5. `bun run test:run` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0; `bun run test:run` → exit 0
- [ ] Detaching a PM whose Stripe `customer` doesn't match the caller
      returns 404 and never calls `detach` (test)
- [ ] `GET /api/services/bookings?role=` response has no `@` address and no
      `pi_`/`ch_`/`pm_`/`re_` id anywhere in its body (test)
- [ ] `GET /api/services/bookings/[id]/payment-lifecycle` 403s a requester
      and strips `chargeId`/`stripeTransferId` for the provider (test)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` (1.12)

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `25e2233`).
- A consumer of `GET /api/services/bookings/[id]/payment-lifecycle` as a
  _requester_ is found anywhere (re-run the greps in "Current state" before
  narrowing to provider-only) — if one exists, keep both parties authorized
  and only drop the two Stripe fields instead.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

Mobile has no call site for either the booking list route or the lifecycle
route (confirmed above) — no effect either way. For SEC-07, mobile's delete
flow (`hoador-mobile/src/features/payments/hooks/use-payment-methods.ts:21`)
only ever deletes the signed-in user's own card id, returned by that same
session's `GET /api/get-payment-methods` — it never has another user's
`pm_`, so the new 404 is unreachable through any normal app flow; it only
changes the outcome of an abuse path that today silently succeeds. No new
stable `code` anywhere in this plan, so no roadmap Mobile-follow-ups row.

## Maintenance notes

- If a future feature needs the requester to see _some_ lifecycle state
  (e.g. "payment confirmed"), add a narrow, purpose-built field rather than
  reopening this route to both parties.
- `ServiceBookingUserInfo` (with `email`) is still used by
  `ServiceBookingWithDetails` (the detail route's DAL type) and other
  internal joins — this plan only narrows the _dashboard-row_ counterparty
  type, not the shared one.
