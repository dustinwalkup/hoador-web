# Plan R-LOW-BIZ-policy-and-race-sweep: Service refund policy fixes, dispute/review race hardening, and dead-code removal

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise. Each Part (A–G) below is independently
> landable: land, verify and (if asked) stop after any single Part without
> needing the others.
>
> **Drift check (run first)**: `git diff --stat 29fe557..HEAD -- src/features/services/lib/service-api-schemas.ts src/lib/wall-clock-zone.ts src/features/services/lib/booking-cancellation.ts specs/cancellation-refund-policy.html src/features/rentals/services/refund-calculations.ts src/features/disputes/lib/deadline-enforcement.ts src/features/disputes/services/evidence-deadline-sweep.ts src/dal/dispute.dal.ts src/features/disputes/lib/state-machine.ts src/features/disputes/lib/dispute-errors.ts src/features/disputes/services/dispute-creation-service.ts src/app/api/disputes/[id]/evidence/route.ts src/lib/api/rate-limit.ts src/dal/rate-limit.dal.ts src/dal/blind-review.dal.ts src/features/reviews/services/blind-review-service.ts src/dal/user.dal.ts src/dal/messages.dal.ts src/db/schemas/messages.schema.ts src/features/users/services/account-deletion-service.ts src/dal/account-deletion.dal.ts src/db/schemas/user.schema.ts src/dal/community.dal.ts src/features/rentals/services/rental-service.ts src/dal/rentals.dal.ts src/services/stripe/dispute-financial.ts src/test/integration/factories.ts`
> On any change, re-read "Current state" for the affected Part against live
> code before proceeding — a mismatch is a STOP condition for that Part only.

## Status

- **Priority**: P3 · **Effort**: M (7 independent parts, each S) · **Risk**: LOW
- **Depends on**: none. Part D reuses the `pg_advisory_xact_lock` idiom
  `R-CONC-01` introduced (`src/dal/rentals.dal.ts:2031`); it does not depend on
  that plan having landed, only on the pattern already existing in the
  codebase.
- **Category**: business logic / concurrency / cleanup
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: BIZ-15, BIZ-16, BIZ-17, CONC-07, CONC-08, CONC-11, plus removal of
  dead code in `src/services/stripe/dispute-financial.ts` (not a numbered
  finding; flagged separately in the audit's file inventory)

## Why this matters

Six LOW findings and one dead-code item, none urgent alone, but each is a
correctness or hygiene gap that is cheap to close opportunistically per the
roadmap's Phase 3 instruction ("the LOW findings are opportunistic, fixed
when their files are next touched"):

- **BIZ-15/16** are a matched pair in the service cancellation refund path: a
  loose time format can force the wrong (generous) refund tier, and the
  late-cancel tier's math doesn't match the number the legal policy document
  promises.
- **BIZ-17** is a real gap in dispute evidence-window enforcement: `open`
  disputes already get a deadline column value but nothing ever checks it.
- **CONC-07/08/11** are check-then-act races: two of them (dispute filing
  rate limit, evidence cap) are exploitable by one user with parallel
  requests; the rest (review aggregate, conversation creation, account
  deletion blockers, primary address, community verification, payment method
  before claim) need genuinely concurrent actors and are lower-probability
  but still real double-writes / lost-update bugs.
- **Dead code**: `StripeDisputeService` has no production caller; keeping it
  around risks someone building on unmaintained, untested-in-production Stripe
  dispute-financial logic.

## Current state (verified against commit `29fe557`)

### Part A — BIZ-15: loose `proposedTime` forces the generous refund tier

- `src/features/services/lib/service-api-schemas.ts:43` —
  `proposedTime: z.string().min(1).max(32),` in `createServiceBookingSchema`
  (`:38-55`). Any non-empty string up to 32 chars is accepted (e.g. `"9am"`).
- `src/lib/wall-clock-zone.ts:85-117` `wallClockToInstant(date, time, timeZone)`
  — the time is parsed with `/^(\d{2}):(\d{2})(?::(\d{2}))?$/` (`:93`); a
  string that doesn't match returns `null` (`:94`), and `wallClockToInstant`
  also returns `null` for an out-of-range value (`hour > 23 || minute > 59`,
  `:101`).
- `src/features/services/lib/booking-cancellation.ts:125-134`
  `serviceInstant(booking)` calls `wallClockToInstant` and passes its `null`
  straight through.
- `src/features/services/lib/booking-cancellation.ts:172-184`
  `serviceRefundTierFor`: `hoursUntil === null || hoursUntil > SERVICE_REFUND_TIER_HOURS
? "full_refund_24h" : "half_refund_under_24h"` (`:181-183`) — deliberately
  generous on `null` (see the doc comment `:164-171`), so an unparseable
  `proposedTime` always yields the full-refund tier, including after the job
  has already happened.

### Part B — BIZ-16: late-cancel refund base doesn't match the published policy

- `src/features/services/lib/booking-cancellation.ts:237-252`
  `serviceRefundBreakdown`, `half_refund_under_24h` branch:
  `const refundCents = Math.round(servicePriceCents * 0.5);` (`:240`) — base is
  `servicePrice` alone; the service fee is retained
  (`nonRefundableCents: Math.max(totalCents - refundCents, 0)`, `:244`).
- `specs/cancellation-refund-policy.html:280-303` § 2.3 "Services –
  Requester-Initiated Cancellations": row at `:299-300` —
  `≤ 24 hours before proposed service date` → **`50% refund of total booking amount`**
  (verbatim). The `> 24 hours` row (`:295-296`) is `100% refund of total
booking amount`, which the code does match (`booking-cancellation.ts:227-234`
  refunds `totalCents` on `full_refund_24h`).
- **Rental precedent, for contrast**: `src/features/rentals/services/refund-calculations.ts:14-44`
  `calculateRenterCancellationRefund` computes the `<24h` tier as
  `rentalPriceCents / 2` (`:35`) — **rental price only**, fee excluded — and
  the rental policy text matches this exactly:
  `specs/cancellation-refund-policy.html:216-218` § 2.1, `< 24 hours` row:
  `"50% refund of rental price; platform service fee is non-refundable"`.
  So for **rentals**, code and policy agree on a price-only base. For
  **services**, the code uses the same price-only convention as rentals, but
  the policy text explicitly says "total booking amount" instead of "service
  price" — an inconsistency between the two policy sections, not just between
  code and policy.
- The no-show tables echo the same split:
  `specs/cancellation-refund-policy.html:505-506` (rentals, "50% of rental
  price") vs `:528-529` (services, "50% refund of total booking amount").
- Provider transfer math is price-based either way:
  `booking-cancellation.ts:245-250` —
  `providerTransferCents = servicePriceCents * (0.5 - PLATFORM_FEE_PERCENTAGE)`,
  imported from `@/constants/payments` (`:24`).

### Part C — BIZ-17: `open` disputes have a deadline column but nothing enforces it

- `src/dal/dispute.dal.ts:67-93` `create()`: **every** new dispute already
  gets `evidenceDeadline` set to `now + EVIDENCE_WINDOW_MS` (7 days,
  `EVIDENCE_WINDOW_MS` at `:49`) at `:70-71,83`, even though `status: "open"`
  is hard-coded at `:84`. The column is populated from day one; it is simply
  never read while the dispute is `open`.
- `src/dal/dispute.dal.ts:847-888` `listActiveEvidenceDeadlinesBetween` (the
  reminder query) filters `inArray(disputes.status, ["evidence_requested", "under_review"])`
  (`:867`) — `open` is excluded.
- `src/dal/dispute.dal.ts:899-916` `listExpiredEvidenceRequests` (the
  enforcement query) filters `eq(disputes.status, "evidence_requested")`
  (`:906`) — `open` is excluded here too.
- `src/features/disputes/lib/deadline-enforcement.ts:39-44`
  `DeadlineEnforcementService.checkAndEnforce` returns early
  (`enforced: false`) unless `dispute.status === "evidence_requested"`.
  `:109-120` `isDeadlineExpired` and `:127-141` `getTimeRemaining` have the
  same `evidence_requested`-only guard.
- `src/features/disputes/lib/state-machine.ts:7-13` `VALID_TRANSITIONS`:
  `open: ["evidence_requested", "under_review", "resolved"]` — **`open →
under_review` is already a valid transition**, so enforcing the deadline on
  `open` needs no new state and no schema change; it needs the two DAL
  queries above widened, and the enforcement service taught a second
  "from" state.
- `src/db/schemas/disputes.schema.ts:48-51`: `status` defaults to `"open"`
  (`:48`), `evidenceDeadline` (`:50`) and `additionalEvidenceDeadline` (`:51`)
  are both nullable `timestamp` columns — `additionalEvidenceDeadline` is
  specific to the `under_review` re-request flow and irrelevant to `open`.
- Confirmed via the finding doc's own "Status 2026-09-24" note
  (`plans/backend-audit/02-business-logic-findings.md:484`): the
  `evidence_requested`/`under_review` half of BIZ-17 was fixed by mobile
  **P-E13-9** (`GET /api/cron/evidence-deadlines`,
  `src/app/api/cron/evidence-deadlines/route.ts`, running
  `src/features/disputes/services/evidence-deadline-sweep.ts`'s
  `runEvidenceDeadlineSweep`, hourly). **Only the `open` half remains open.**

### Part D — CONC-07: count-then-insert caps race under parallel requests

- **Dispute monthly/yearly cap**: `src/dal/dispute.dal.ts:1021-1064`
  `checkRateLimits(userId)` — two independent `SELECT count(*)` queries
  (`:1028-1038` monthly, `:1041-1051` yearly), `withinLimits = monthlyCount < 3
&& yearlyCount < 10` (`:1054`). Called from
  `src/features/disputes/services/dispute-creation-service.ts:200-211`
  (rental path) and `:395-406` (service path), each followed later by
  `disputeDAL.create(...)` (`:220-228` / `:432-440`) — no lock or transaction
  spans the count and the insert.
- **Evidence per-participant cap**: `MAX_EVIDENCE_ITEMS = 10`
  (`src/app/api/disputes/[id]/evidence/route.ts:20`). Count at `:120-123`
  (`disputeDAL.countEvidenceByDisputeAndUser`, itself
  `src/dal/dispute.dal.ts:1275-1291`), cap check `:124-129`, then — after
  form-data parsing and (for images) processing/upload
  (`:131-192`, including `processImageForUpload` and `uploadToBlob`) — the
  insert at `:195-201` (`disputeDAL.createEvidence`, itself
  `src/dal/dispute.dal.ts:1246-1269`). N parallel uploads all read a count
  below 10 while the slow image work runs, then all insert.
- **Precedent for the fix**: `src/dal/rentals.dal.ts:2017-2050`
  `reserveDatesForApproval` — `this.db.transaction(async (tx) => { ...
tx.execute(sql\`SELECT pg_advisory_xact_lock(hashtext(${listingId}))\`) ...
  })`(lock at`:2030-2032`). This is the **only** use of
`pg_advisory_xact_lock`in the codebase today (confirmed:`grep -rn "advisory" src/`also returns only this call site, its own test`src/dal/**tests**/rentals.dal.test.ts:562-605`, and the corresponding
  integration test) — CONC-07 would be the second use of the same idiom, not
  a new primitive.
- **Alternative primitive checked**: `src/lib/api/rate-limit.ts:11-24`
  `enforceRateLimit(key, limit, windowSeconds)` wraps
  `src/dal/rate-limit.dal.ts:23-65` `RateLimitDAL.consume` — a single atomic
  `INSERT ... ON CONFLICT DO UPDATE` (`:29-48`) keyed by a **rolling fixed
  window** (`resetAt = now() + windowSeconds`, reset when `resetAt <= now()`).
  Two mismatches with reuse here, see Decisions below.

### Part E — CONC-08: review release double-notifies; aggregate isn't atomic

- `src/dal/blind-review.dal.ts:335-351` `releaseReviews(reviewIds)` (immediate
  release when both parties have submitted) — `UPDATE ... WHERE id IN (...)
AND releasedAt IS NULL`, **no `.returning()`**.
- `src/dal/blind-review.dal.ts:378-396` `releaseExpired(reviewIds)` (cron
  release) — same shape, `UPDATE ... WHERE releasedAt IS NULL AND id IN
(...)`, **no `.returning()`**; comment at `:385-386` says the guard exists
  so "an overlapping cron run" doesn't double-release, but nothing reads
  whether the guard actually blocked anything.
- `src/features/reviews/services/blind-review-service.ts:213-262`
  `releaseExpiredReviews`: fetches `expired` (`:216`), groups by booking
  (`:223-229`), then per group calls `releaseExpired(reviewIds)` (`:237`) and
  **unconditionally** proceeds to recompute aggregates (`:240-243`) and call
  `notifyReleasedReviews(reviews, bookingType)` (`:249-255`) using the
  **original** `expired` list — regardless of how many rows the `UPDATE`
  actually touched. Two overlapping cron runs both read the same unreleased
  rows, both "release" (one no-ops under the guard), and **both** notify and
  recompute.
- `src/features/reviews/services/blind-review-service.ts:84-108` `submitReview`
  has the same shape for the immediate-release path: `releaseReviews(reviewIds)`
  (`:92`) then unconditional aggregate update (`:96-98`) and notify
  (`:101-107`).
- `src/dal/user.dal.ts:1386-1418` `updateReviewAggregate(userId)`: a `SELECT
avg(rating), count(*) FROM blindReviews WHERE revieweeId = userId AND
releasedAt IS NOT NULL` (`:1392-1403`), then a **separate**
  `UPDATE user SET reviewAggregateRating, reviewCount WHERE id = userId`
  (`:1405-1414`) — two statements, no transaction, so two overlapping callers
  computing the aggregate for the same user can interleave (both read, both
  write; the loser's write is the final state but was computed from a stale
  read — this self-heals on the _next_ call since it's a full recompute, but
  a run in between can serve/store a wrong count).
- Both call sites (`blind-review-service.ts:97`, `:242`) call it identically:
  `revieweeIds.map((id) => userDAL.updateReviewAggregate(id))` inside
  `Promise.all`.

### Part F — CONC-11: five minor check-then-act races

- **(a) Conversation creation** — `src/dal/messages.dal.ts:274-314`
  `findOrCreateConversation(user1Id, user2Id)`: find at `:291-293`
  (`this.db.query.conversations.findFirst({ where: conversationBetween(...) })`),
  insert at `:296-302` if not found. Unique constraint:
  `src/db/schemas/messages.schema.ts:42-46`
  `unique("conversations_unique_user_pair").on(table.user1Id, table.user2Id)`
  (on the **sorted** pair — see the `[smallerId, largerId]` comment at
  `:286-290`). A simultaneous first message from both users: both find
  `null`, both insert, the loser's insert throws a `23505`, which
  `BaseDAL.handleError` (`src/dal/base.ts:42-44`) turns into a generic
  `ConflictError("A record with this value already exists")` — a 409, and
  the caller's message is lost (a retry works, but nothing tells the client
  to retry with the _existing_ conversation id).
- **(b) Account deletion blockers vs. anonymize** —
  `src/features/users/services/account-deletion-service.ts:121-127`
  `deleteOwnAccount`: `getDeletionBlockers(userId)` (`:122`, runs the six
  `BLOCKER_CHECKS.count` queries in `Promise.all`, `:79-95`) returns `[]`,
  **then** `accountDeletionDAL.anonymizeUser(userId)` (`:127`) runs in its
  own transaction (`src/dal/account-deletion.dal.ts:349-352` opens
  `this.db.transaction(async (tx) => {...})`). Between the two calls, an
  owner can approve the user's own outbound pending rental request (not
  itself a blocker by design — pending _owned_ requests block, not pending
  _outbound_ ones — but approval charges the card and creates a live rental
  mid-deletion).
- **(c) Double-submitted onboarding creates two primary addresses** —
  `src/dal/user.dal.ts:772-820` `updateUserPrimaryAddress` (find primary at
  `:790-793`, insert-if-absent at `:806-816`) and `:940-1003`
  `updateUserAddress` (find at `:967-971`, insert-if-absent at `:988-1002`)
  both do plain find-then-insert with no DB constraint backing `isPrimary`.
  Confirmed no fix has landed yet: `grep -n "user_addresses_primary_unique"
src/db/schemas/user.schema.ts src/db/migrations/*.sql` returns nothing.
  `src/db/schemas/user.schema.ts:163-188` `userAddresses` has only
  `user_addresses_user_id_idx` and a lat/long index (`:180-185`) — no partial
  unique index on `(user_id) WHERE is_primary`. **R-PERF-04 Part A owns
  this fix** (it adds the index for its search query and, after review,
  the upsert and race test too); this plan only verifies it (Steps, F-c).
- **(d) Community verify/deny — last-write-wins** —
  `src/dal/community.dal.ts:1272-1304` `verifyMembership` and `:1310-1345`
  `denyMembership`: both `UPDATE communityMemberships SET verificationStatus
= ... WHERE id = membershipId` with **no status guard** — no `WHERE
verificationStatus = 'pending'`. `verificationStatusEnum`
  (`src/db/schemas/_enums.ts:12-16`) is `["pending", "verified", "denied"]`.
  Two admins racing (or one admin double-clicking) can verify then deny (or
  vice versa) the same membership, each appending its own audit-log row
  (`:1292-1298`, `:1333-1339...`), with the last write silently winning and
  no record that it overwrote a prior decision. Callers:
  `src/app/api/admin/community-memberships/[id]/verify/route.ts:38-42` and
  the sibling `.../deny/route.ts:43-...`, both already wrapped in
  `try { ... } catch (error) { return handleApiError(error); }`.
- **(e) Payment method write races the payment claim** —
  `src/features/rentals/services/rental-service.ts:507-515`: on retry-after-
  failure or first-time approval, `rentalDAL.updateRentalRequestPaymentMethod(rentalId,
paymentMethodIdToUse)` runs **before** the atomic claim at `:541-542`
  (`rentalDAL.claimRentalRequestPaymentProcessing(rentalId)`,
  `src/dal/rentals.dal.ts:1922-1945`, a `pending|failed -> processing` CAS).
  `updateRentalRequestPaymentMethod` itself
  (`src/dal/rentals.dal.ts:1981-1994`) is a plain `UPDATE ... WHERE id =
rentalId`, unconditional. Two concurrent approve attempts (e.g. a double-
  tap, or an owner retrying after a slow response) both write the payment
  method before either wins the claim; the loser's write can still land after
  the winner's, leaving the wrong `paymentMethodId` recorded — which the
  deposit-hold cron later reads to place the hold.

### Dead code

- `grep -rn "StripeDisputeService\|dispute-financial" src/ --include=*.ts`
  returns only `src/services/stripe/dispute-financial.ts:30` (the class
  definition) and its own test file
  `src/services/stripe/__tests__/dispute-financial.test.ts` (26 references,
  all `StripeDisputeService.*` calls in test bodies). **Zero references from
  any route, service or DAL file.** Both files are safe to delete together.

### Test fixtures available today

`src/test/integration/factories.ts` exports `createUser`, `createCommunity`,
`createVisibility`, `createListing`, `createRentalRequest`,
`createServiceListing`, `createServiceBooking` — **no** factory for a
dispute, dispute evidence, blind review, conversation, or user address. Parts
D, E and F's real-DB tests each need a new factory (see Steps).

## Decisions for the maintainer

### Decision 1 (Part B / BIZ-16): align the code to the policy, or the policy to the code?

**Option 1 — align the policy to the code** (edit
`specs/cancellation-refund-policy.html` §2.3's `≤ 24 hours` row from "50%
refund of total booking amount" to "50% refund of service price; platform
service fee is non-refundable", matching §2.1's rental wording and the
no-show table at `:505-506`/`:528-529` similarly).

**Option 2 — align the code to the policy** (change
`booking-cancellation.ts:240`'s base from `servicePriceCents` to `totalCents`,
which also changes the retained-fee math the provider-transfer figure at
`:245-250` is built on, and is a real money-behavior change, however small:
"about $0.15 to $2" per the finding).

**Recommendation: Option 1.** The rental section of the same document already
uses the price-only convention and its code matches exactly
(`refund-calculations.ts:35`); the service section's "total booking amount"
wording reads as a drafting inconsistency rather than an intentional
divergence — there's no reason services should refund the platform fee on a
late cancellation when rentals don't. Option 1 is a documentation-only
change: no money-math edit, no Stripe amount change, no new test besides
pinning the existing behavior. Option 2 would also require revisiting the
provider-transfer calculation (currently price-based) to decide whether the
provider's late-cancel share changes too, which is out of scope for a LOW
finding. **Part B's steps below implement Option 1**, but do not edit
`specs/cancellation-refund-policy.html` until the maintainer confirms —
that file is a legal/policy document, not application code.

### Decision 2 (Part D / CONC-07): advisory lock vs. reusing `enforceRateLimit`

**Option 1 — `pg_advisory_xact_lock`, same idiom as `R-CONC-01`.** Wrap the
existing calendar-month/calendar-year count queries and the insert in one
`this.db.transaction`, locked on `hashtext(userId)` for the dispute cap and
`hashtext(disputeId || ':' || userId)` for the evidence cap. Preserves the
exact existing semantics (resets on the 1st of the month/year) and matches
the audit's own "Recommended fix" wording exactly ("in one transaction under
`pg_advisory_xact_lock(hashtext(dispute_id||user_id))`").

**Option 2 — reuse `enforceRateLimit`/`RateLimitDAL.consume`.** This is the
house convention for new rate limits ("Reuse it; don't build another"), and
its `INSERT ... ON CONFLICT DO UPDATE` is already atomic under Postgres's row
lock — no explicit lock needed. But two real mismatches: (1) it implements a
**rolling fixed window** (`windowSeconds` from first hit), not a **calendar**
month/year boundary — matching "3 per calendar month" would need a key that
itself rotates every month (e.old., `dispute-month:${userId}:${yyyy-mm}`) with
a large `windowSeconds`, which works but changes what "the limit resets" means
subtly (mid-month key rotation vs. a rolling 30 days — need to confirm this
still satisfies `DISPUTE_MONTHLY_LIMIT`'s product intent); and (2)
`enforceRateLimit` **no-ops outside production** (`rate-limit.ts:21`), so
using that wrapper (rather than calling `rateLimitDAL.consume` directly) would
silently stop enforcing the dispute cap in dev/staging/tests, a behavior
change from today's `checkRateLimits`, which always enforces.

**Recommendation: Option 1.** It's a smaller, lower-risk diff (no semantic
change to what "3/month" means, no new key-rotation logic), it follows an
existing precedent already proven in this exact codebase for exactly this
kind of count-then-act race, and it doesn't need the `enforceRateLimit`
prod-only gate to be worked around. Part D's steps implement Option 1; Option
2 is recorded here in case the maintainer prefers consolidating all rate
limits onto one mechanism later (Maintenance notes).

## Commands

| Purpose         | Command                                                                                                                                                                                                                                                                                                                                             | Expected |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck       | `bun run type-check`                                                                                                                                                                                                                                                                                                                                | exit 0   |
| Lint            | `bun run lint`                                                                                                                                                                                                                                                                                                                                      | exit 0   |
| Unit/mocked     | `bun run test:run src/features/services src/features/disputes src/dal/__tests__/dispute.dal.test.ts src/dal/__tests__/blind-review.dal.test.ts src/dal/__tests__/user.dal.test.ts src/dal/__tests__/messages.dal.test.ts src/dal/__tests__/community.dal.test.ts src/features/rentals src/features/reviews src/features/users src/app/api/disputes` | all pass |
| Real-DB (races) | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                                                                                                                                                                                                                           | all pass |

## Scope

**In scope**:

- `src/features/services/lib/service-api-schemas.ts` (Part A)
- `src/features/services/lib/booking-cancellation.ts` (Parts A, B)
- `src/dal/dispute.dal.ts` (Parts C, D)
- `src/features/disputes/lib/deadline-enforcement.ts`,
  `src/features/disputes/services/evidence-deadline-sweep.ts` (Part C)
- `src/features/disputes/services/dispute-creation-service.ts`,
  `src/app/api/disputes/[id]/evidence/route.ts`,
  `src/features/disputes/lib/dispute-errors.ts` (Part D)
- `src/dal/blind-review.dal.ts`,
  `src/features/reviews/services/blind-review-service.ts`, `src/dal/user.dal.ts`
  (Part E)
- `src/dal/messages.dal.ts`, `src/features/users/services/account-deletion-service.ts`,
  `src/dal/account-deletion.dal.ts`, `src/dal/user.dal.ts`,
  `src/db/schemas/user.schema.ts` (verify only; F-c is R-PERF-04's),
  `src/dal/community.dal.ts`, `src/features/rentals/services/rental-service.ts` (Part F)
- `src/services/stripe/dispute-financial.ts`,
  `src/services/stripe/__tests__/dispute-financial.test.ts` (deleted, Part G)
- `src/test/integration/factories.ts` (new factories: `createDispute`,
  `createDisputeEvidence`, `createBlindReview`)
- Tests for every file above

**Out of scope**: `specs/cancellation-refund-policy.html` (Decision 1 must be
confirmed by the maintainer first — see Part B's steps); CONC-09 (dispute
resolve/state-change atomic claim) and CONC-10 (cron concurrency group) —
separate LOW findings, not part of this sweep; ARCH-01's shared claim/transition
helper (Phase 3, unrelated plan) — Part D and F's CAS-style fixes are written
directly against today's DAL methods, not against a not-yet-built helper.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### Part A (BIZ-15): tighten `proposedTime` validation

In `src/features/services/lib/service-api-schemas.ts:43`, change:

```ts
proposedTime: z.string().min(1).max(32),
```

to:

```ts
proposedTime: z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "Invalid time (use HH:MM)"),
```

The stricter regex (hour `00`–`23`, minute `00`–`59`) goes slightly beyond the
finding's literal `^\d{2}:\d{2}$` recommendation so that no schema-valid value
can still fail `wallClockToInstant`'s own range check
(`wall-clock-zone.ts:101`) and fall into the generous-`null` branch — closing
the gap completely rather than narrowing it.

**Verify**: `bun run type-check` → exit 0.
`bun run test:run src/features/services/lib/__tests__/service-api-schemas.test.ts`
(extend or create: `"9am"`, `"25:00"`, `"12:60"` all fail; `"18:00"` and
`"09:05"` pass).

Add a route-level test in
`src/app/api/services/bookings/__tests__/route.test.ts` (extend if present):
`POST /api/services/bookings` with `proposedTime: "9am"` → 400.

**Verify**: `bun run test:run src/app/api/services/bookings` → all pass.

### Part B (BIZ-16): pin the late-cancel refund base at 50% of service price (Decision 1, Option 1)

No code change to `booking-cancellation.ts:240` — it already computes the
Option-1 base correctly. This Part is:

1. Add an explicit test pinning current behavior, so a future edit can't
   silently drift back toward "total" without a test failing:
   `src/features/services/lib/__tests__/booking-cancellation.test.ts` (extend):
   `serviceRefundBreakdown("half_refund_under_24h", { servicePrice: "100.00", totalAmount: "104.00" })`
   → `refundCents: 5000` (50% of the $100 service price, **not** 5200, 50% of
   the $104 total).
2. Leave a comment at `booking-cancellation.ts:237-240` noting the maintainer
   decision and its date, e.g.: `// Confirmed 2026-09-25 (R-LOW-BIZ...): base
is servicePrice, matching the rental precedent; see Decision 1.` — only
   add this comment **after** the maintainer has actually confirmed Option 1
   (see STOP conditions).
3. If the maintainer instead confirms **Option 2**, this Part becomes: change
   `:240` to `Math.round(totalCents * 0.5)`, remove the
   `nonRefundableCents`/`providerTransferCents` price-based math at
   `:244-250` and redesign it against `totalCents` (the provider's retained
   share and the platform's cut both need to be re-derived — this is no
   longer a documentation-only change and needs its own review of the
   Stripe-side effects before landing).

**Verify**: `bun run test:run src/features/services/lib/__tests__/booking-cancellation.test.ts` → all pass.

### Part C (BIZ-17): enforce the evidence deadline in `open` disputes

1. In `src/dal/dispute.dal.ts:847-888` `listActiveEvidenceDeadlinesBetween`,
   widen the CASE and the `inArray` filter to include `open`:

```ts
const active = sql<Date>`CASE
  WHEN ${disputes.status} IN ('open', 'evidence_requested') THEN ${disputes.evidenceDeadline}
  ELSE COALESCE(${disputes.additionalEvidenceDeadline}, ${disputes.evidenceDeadline})
END`;
...
.where(
  and(
    inArray(disputes.status, ["open", "evidence_requested", "under_review"]),
    ...
  ),
)
```

and in the `flatMap` below, treat `open` the same as `evidence_requested`
(both read `row.evidenceDeadline`, not `additionalEvidenceDeadline`).

2. In `src/dal/dispute.dal.ts:899-916` `listExpiredEvidenceRequests`, widen
   the status filter:

```ts
inArray(disputes.status, ["open", "evidence_requested"]),
```

Rename the method (and its doc comment) if you want to keep it accurate —
e.g. `listExpiredEvidenceStates` — but check every call site first
(`grep -rn "listExpiredEvidenceRequests" src/`).

3. In `src/features/disputes/lib/deadline-enforcement.ts:22-102`
   `checkAndEnforce`, change the guard at `:40` from
   `if (dispute.status !== "evidence_requested")` to accept both states, and
   make the target state depend on which one it started from:

```ts
if (dispute.status !== "open" && dispute.status !== "evidence_requested") {
  return { enforced: false };
}
...
const toStatus = dispute.status === "open" ? "under_review" : "under_review";
const moved = await disputeDAL.transitionIfStatus(disputeId, dispute.status, toStatus);
```

(Both states move to `under_review` — `open`'s valid-transition list
already allows this per `state-machine.ts:8`, so no state-machine change
is needed. Keep `toStatus` written out rather than collapsed to a
constant, so the intent — "either starting state ends at `under_review`"
— stays obvious to the next reader.)

4. Update `isDeadlineExpired` (`:109-120`) and `getTimeRemaining`
   (`:127-141`) the same way — both currently gate on
   `dispute.status !== "evidence_requested"`; widen to also accept `open`.

5. `EVIDENCE_WINDOW_MS` (`dispute.dal.ts:49`) already applies at creation
   (`:70-71`) — no change needed there.

**Verify**: `bun run type-check` → exit 0.

New/extended tests:

- `src/dal/__tests__/dispute.dal.test.ts`: `listActiveEvidenceDeadlinesBetween`
  and `listExpiredEvidenceRequests` each get a case with an `open` dispute
  whose `evidenceDeadline` falls in range/has passed.
- `src/features/disputes/lib/__tests__/deadline-enforcement.test.ts`: an
  `open` dispute past its deadline is moved to `under_review` and notified,
  the same as an `evidence_requested` one.
- `src/app/api/cron/evidence-deadlines/__tests__/route.test.ts`: extend the
  existing sweep test with an `open` dispute case.

**Verify**: `bun run test:run src/dal/__tests__/dispute.dal.test.ts src/features/disputes src/app/api/cron/evidence-deadlines` → all pass.

### Part D (CONC-07): atomic count-then-insert for the dispute cap and the evidence cap

**D1 — dispute monthly/yearly cap.** Add a new DAL method in
`src/dal/dispute.dal.ts` that does the count and the insert in one
transaction under an advisory lock, returning a discriminated result instead
of throwing (keeping the typed-error decision in the service layer, where
`DisputeRateLimitedError` already lives):

```ts
async createIfWithinRateLimit(
  data: CreateDisputeData,
  limits: { monthly: number; yearly: number },
): Promise<
  | { ok: true; dispute: DisputeWithRelations }
  | { ok: false; monthlyCount: number; yearlyCount: number }
> {
  try {
    const result = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${data.createdBy}))`,
      );
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const [monthly] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(and(eq(disputes.createdBy, data.createdBy), gte(disputes.createdAt, startOfMonth)));
      const [yearly] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(and(eq(disputes.createdBy, data.createdBy), gte(disputes.createdAt, startOfYear)));
      const monthlyCount = Number(monthly?.count || 0);
      const yearlyCount = Number(yearly?.count || 0);
      if (monthlyCount >= limits.monthly || yearlyCount >= limits.yearly) {
        return { ok: false as const, monthlyCount, yearlyCount };
      }
      const evidenceDeadline = data.evidenceDeadline || new Date(Date.now() + EVIDENCE_WINDOW_MS);
      const [dispute] = await tx
        .insert(disputes)
        .values({ /* same fields as create(), :74-85 */ evidenceDeadline, status: "open" })
        .returning();
      return { ok: true as const, id: dispute.id };
    });
    if (!result.ok) return result;
    return { ok: true, dispute: (await this.getById(result.id)) as DisputeWithRelations };
  } catch (error) {
    this.handleError(error, "createIfWithinRateLimit");
  }
}
```

Do **not** throw `DisputeRateLimitedError` from inside this DAL method: it
extends plain `Error`, not `DALError`
(`src/features/disputes/lib/dispute-errors.ts:40`), and
`BaseDAL.handleError` only rethrows unchanged when `error instanceof
DALError` (`src/dal/base.ts:38-40`) — anything else falls through to a
generic 500 `DALError("A database error occurred...")`, silently turning a
429 into a 500. Returning a plain discriminated result sidesteps this
entirely; the service layer (which already imports
`DisputeRateLimitedError`) throws it from the `{ ok: false }` branch.

In `dispute-creation-service.ts`, replace the two-step
`checkRateLimits` + `create` (`:200-228` rental path, `:395-440` service
path) with a single call to `createIfWithinRateLimit`, throwing
`DisputeRateLimitedError` when `ok: false`, using the same message/detail
shape as today.

**D2 — evidence cap.** Add a similar method for evidence, but keep the
existing early count check in the route as a fail-fast, non-blocking
pre-check (so a client sees "limit reached" before spending time on image
processing/upload), and only take the advisory lock for the final,
authoritative check + insert — **after** the blob work, so the lock is never
held across slow external I/O:

```ts
// dispute.dal.ts
async createEvidenceIfWithinLimit(
  data: { disputeId: string; uploadedBy: string; uploadedByRole: DisputeRole; evidenceType: EvidenceType; content: string },
  maxItems: number,
): Promise<{ ok: true; evidence: typeof disputeEvidence.$inferSelect } | { ok: false; count: number }> {
  try {
    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${data.disputeId} || ':' || ${data.uploadedBy}))`,
      );
      const [{ count: existingCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(disputeEvidence)
        .where(and(eq(disputeEvidence.disputeId, data.disputeId), eq(disputeEvidence.uploadedBy, data.uploadedBy)));
      if (existingCount >= maxItems) return { ok: false as const, count: existingCount };
      const [evidence] = await tx.insert(disputeEvidence).values(data).returning();
      return { ok: true as const, evidence };
    });
  } catch (error) {
    this.handleError(error, "createEvidenceIfWithinLimit");
  }
}
```

In `src/app/api/disputes/[id]/evidence/route.ts`: keep the pre-check at
`:120-129` unchanged (fail fast before the upload). After the
file/text handling (`:131-192`), replace the final `disputeDAL.createEvidence(...)`
call (`:195-201`) with `disputeDAL.createEvidenceIfWithinLimit(...)`, and
throw `EvidenceLimitReachedError` (same shape as `:125-128`) when `ok: false`.

**Verify**: `bun run type-check` → exit 0.

New factory in `src/test/integration/factories.ts`:

```ts
export async function createDispute(
  overrides: Partial<typeof disputes.$inferInsert> = {},
) {
  const [row] = await db
    .insert(disputes)
    .values({
      createdBy: overrides.createdBy!,
      createdByRole: "renter",
      reasonCode: "item_not_as_described",
      description: "Integration-test dispute",
      policyVersion: "v1.0",
      status: "open",
      ...overrides,
    })
    .returning();
  return row;
}
```

(Confirm `reasonCode`'s actual enum values and required fields against
`src/db/schemas/_enums.ts` / `disputes.schema.ts` before writing — the
example above may need a real value swapped in.)

Real-DB tests (new `src/features/disputes/services/__tests__/dispute-creation-rate-limit.integration.test.ts`
and `src/app/api/disputes/[id]/evidence/__tests__/evidence-cap.integration.test.ts`):

- Seed a user with exactly `DISPUTE_MONTHLY_LIMIT - 1` disputes this month.
  Fire 5 concurrent `createIfWithinRateLimit` calls (or 5 concurrent
  `DisputeCreationService.createDispute` calls against 5 distinct eligible
  bookings) using `raceTwo`/`Promise.allSettled`
  (`src/test/integration/run-concurrently.ts` pattern, extended to N-way).
  Expect exactly one to succeed.
- Fire 20 concurrent evidence uploads for the same dispute/user against a
  real DB (mock the blob upload). Expect exactly 10 `dispute_evidence` rows.

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration` → all pass, including the two new files.

### Part E (CONC-08): stop double-notifying; make the aggregate update atomic

1. `src/dal/blind-review.dal.ts:335-351` `releaseReviews` — add
   `.returning({ id: blindReviews.id })` and return `string[]` of the ids
   actually released (empty array if none).
2. `src/dal/blind-review.dal.ts:378-396` `releaseExpired` — same:
   `.returning({ id: blindReviews.id })`, return the released ids.
3. `src/features/reviews/services/blind-review-service.ts:89-107`
   `submitReview`: capture `releasedIds = await blindReviewDAL.releaseReviews(reviewIds)`;
   if `releasedIds.length === 0`, skip the aggregate update and the
   notification entirely (another caller already released this pair).
4. `src/features/reviews/services/blind-review-service.ts:234-257`
   `releaseExpiredReviews`'s per-group loop: capture
   `releasedIds = await blindReviewDAL.releaseExpired(reviewIds)`; filter
   `reviews` down to only the ones whose id is in `releasedIds` before
   computing `revieweeIds` and calling `notifyReleasedReviews`; count
   `released += releasedIds.length` (not `reviews.length`); skip the whole
   aggregate-update/notify block when `releasedIds.length === 0`.
5. `src/dal/user.dal.ts:1390-1418` `updateReviewAggregate` — replace the
   SELECT-then-UPDATE with one UPDATE using correlated subqueries:

```ts
async updateReviewAggregate(userId: string): Promise<void> {
  try {
    await this.db
      .update(user)
      .set({
        reviewAggregateRating: sql`(
          SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(${blindReviews.rating})::numeric, 2) ELSE NULL END
          FROM ${blindReviews}
          WHERE ${blindReviews.revieweeId} = ${userId} AND ${blindReviews.releasedAt} IS NOT NULL
        )`,
        reviewCount: sql`(
          SELECT COUNT(*)::int FROM ${blindReviews}
          WHERE ${blindReviews.revieweeId} = ${userId} AND ${blindReviews.releasedAt} IS NOT NULL
        )`,
      })
      .where(eq(user.id, userId));
  } catch (error) {
    this.handleError(error, "updateReviewAggregate");
  }
}
```

This is a single atomic `UPDATE`, so no interleaving between a read and a
write is possible — two concurrent calls for the same user each fully
recompute from the current table state under Postgres's row lock on the
`user` row.

**Verify**: `bun run type-check` → exit 0.

New factory:

```ts
export async function createBlindReview(
  booking: { rentalId?: string; serviceBookingId?: string },
  reviewerId: string,
  revieweeId: string,
  overrides: Partial<typeof blindReviews.$inferInsert> = {},
) {
  const [row] = await db
    .insert(blindReviews)
    .values({
      rentalId: booking.rentalId ?? null,
      serviceBookingId: booking.serviceBookingId ?? null,
      reviewerId,
      revieweeId,
      rating: 5,
      reviewWindowEndAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning();
  return row;
}
```

(Verify exact required columns against `src/db/schemas/blind-reviews.schema.ts`
or wherever the table is defined before writing.)

New tests:

- `src/dal/__tests__/blind-review.dal.test.ts`: `releaseReviews`/`releaseExpired`
  return `[]` when every id's `releasedAt` is already set (mocked `.returning()`
  result of length 0).
- `src/features/reviews/services/__tests__/blind-review-service.test.ts`:
  mock `blindReviewDAL.releaseExpired` to return `[]` → assert
  `notifyReleasedReviews` and `userDAL.updateReviewAggregate` are **not**
  called.
- Real-DB test (new
  `src/features/reviews/services/__tests__/review-release-race.integration.test.ts`):
  two concurrent `releaseExpiredReviews()` calls against the same expired
  review pair — assert the notification mock fires exactly once per
  reviewee, not twice.

**Verify**: `bun run test:run src/dal/__tests__/blind-review.dal.test.ts src/features/reviews` then `bun run test:integration` → all pass.

### Part F (CONC-11): five minor check-then-act races

**(a) Conversation creation** — `src/dal/messages.dal.ts:295-303`:

```ts
if (!conversation) {
  const inserted = await this.db
    .insert(conversations)
    .values({ user1Id: smallerId, user2Id: largerId })
    .onConflictDoNothing({
      target: [conversations.user1Id, conversations.user2Id],
    })
    .returning();
  conversation =
    inserted[0] ??
    (await this.db.query.conversations.findFirst({
      where: conversationBetween(user1Id, user2Id),
    }));
}
```

Confirm the constraint name/target matches
`messages.schema.ts:42-46`'s `unique("conversations_unique_user_pair").on(table.user1Id, table.user2Id)`
exactly (target is the column pair, not the constraint name, for Drizzle's
`onConflictDoNothing`).

New factory (only if a conversation-per-user test needs one directly —
`findOrCreateConversation` itself is the code under test, so most tests can
call it twice concurrently rather than needing a standalone factory).

New real-DB test
(`src/dal/__tests__/messages.dal.race.integration.test.ts`): two concurrent
`findOrCreateConversation(userA, userB)` calls → both resolve, both return
the same conversation id, and `SELECT count(*) FROM conversations WHERE
user1Id = ... AND user2Id = ...` is exactly 1.

**(b) Account deletion blockers vs. anonymize** —
`src/features/users/services/account-deletion-service.ts:79-95`
`getDeletionBlockers` and `src/dal/account-deletion.dal.ts:137-320`'s six
`count*` methods each currently use `this.db` directly. Add an optional
executor parameter to each (defaulting to `this.db`) so they can run inside
`anonymizeUser`'s existing transaction:

```ts
async countActiveRentals(
  userId: string,
  executor: typeof this.db = this.db,
): Promise<number> {
  try {
    // replace `this.db` with `executor` in the query body
  } catch (error) {
    this.handleError(error, "countActiveRentals");
  }
}
```

(Repeat for `countActiveBookings`, `countPendingOwnedRequests`,
`countActiveDepositHolds`, `countIncompletePayouts`, `countOpenDisputes`.)

In `anonymizeUser` (`account-deletion.dal.ts:349-352` opens the
transaction), immediately after fetching `existing` (`:351-357`) and before
any mutation, re-run all six counts with `tx` as the executor; if any is
nonzero, throw (which rolls back the transaction — nothing has been mutated
yet, so this is safe) a new, DAL-appropriate signal — e.g. reuse
`ConflictError` with a stable message
(`"Deletion blocked: a new blocker appeared during deletion"`), since
`AccountDeletionBlockedError`'s per-blocker detail payload lives in the
feature layer, not the DAL. In `deleteOwnAccount`
(`account-deletion-service.ts:121-127`), catch that specific `ConflictError`
message and re-run `getDeletionBlockers` to build a fresh, detailed
`AccountDeletionBlockedError` for the caller (the extra round-trip only
happens on this rare race, not the common path).

**(c) Double-submitted onboarding creates two primary addresses** —
**Owned by R-PERF-04 Part A (Phase 2), not this plan.** R-PERF-04 adds
`user_addresses_primary_unique`, turns `updateUserPrimaryAddress` and
`updateUserAddress` into `onConflictDoUpdate` upserts on that partial index,
runs the duplicate pre-check on dev/staging, and adds
`src/dal/__tests__/user-address-race.integration.test.ts`. Here, only
verify it landed:

```bash
grep -n "user_addresses_primary_unique" src/db/schemas/user.schema.ts
grep -n "onConflictDoUpdate" src/dal/user.dal.ts
ls src/dal/__tests__/user-address-race.integration.test.ts
```

All three must hit. If any is missing, STOP and report: execute R-PERF-04
Part A first; don't re-implement it here.

**(d) Community verify/deny — add a status guard** —
`src/dal/community.dal.ts:1272-1304` `verifyMembership` and `:1310-1345`
`denyMembership`: add `eq(communityMemberships.verificationStatus, "pending")`
to each `WHERE` clause. When `.returning()` comes back empty, throw
`ConflictError("Membership has already been decided")` (already imported,
`community.dal.ts:25`) instead of `NotFoundError` (the row exists, it's just
not in a decidable state — a 409 is more accurate than a 404 for the route's
caller).

**Verify**: `bun run test:run src/dal/__tests__/community.dal.test.ts` (extend:
verifying an already-verified membership throws `ConflictError`, not a
silent overwrite) and the two route test files
(`src/app/api/admin/community-memberships/[id]/verify/__tests__/route.test.ts`,
`.../deny/__tests__/route.test.ts` — extend if present, create if not: a
second verify/deny attempt on an already-decided membership returns 409).

**(e) Payment method write after the claim, not before** —
`src/features/rentals/services/rental-service.ts:507-542`: move the
`if ((!rentalRequest.paymentMethodId || isRetryAfterFailure) &&
paymentMethodIdToUse) { await rentalDAL.updateRentalRequestPaymentMethod(...); }`
block (`:507-515`) to **after** the claim succeeds — i.e., after
`if (!claimed) { ...; return { success: false, ... }; }` (`:543-...`), right
before the code that actually uses `paymentMethodIdToUse` to charge. Confirm
nothing between the old and new call sites reads
`rentalRequest.paymentMethodId` expecting it to already be updated (`grep -n
"paymentMethodId" src/features/rentals/services/rental-service.ts` around
this function) before moving it.

**Verify**: `bun run test:run src/features/rentals/services/__tests__/rental-service.approve.test.ts` → all pass (this file already exists per `R-SEC-07`'s reference to it as the mocking pattern to follow).

New real-DB test, or extend `rental-approval-overlap.integration.test.ts`
(`src/features/rentals/services/__tests__/`): two concurrent approve calls
with different `paymentMethodId`s on the loser's stale read — assert the
final `rental_requests.payment_method_id` matches the **winner's** claim, not
whichever write happened to land last.

**Verify**: `bun run test:integration` → all pass.

### Part G: delete dead `StripeDisputeService`

1. Delete `src/services/stripe/dispute-financial.ts` and
   `src/services/stripe/__tests__/dispute-financial.test.ts`.
2. Re-run `grep -rn "StripeDisputeService\|dispute-financial" src/ --include=*.ts`
   to confirm zero remaining references (should return nothing).
3. Check `coverage/services/stripe/dispute-financial.ts.html` and
   `coverage/lcov-report/...` — these are generated artifacts, not source;
   leave them (they regenerate on the next `bun run ci`).

**Verify**: `bun run type-check` → exit 0 (confirms nothing imported the
deleted file). `bun run test:run` (full suite) → exit 0, no missing-file
errors.

## Test plan

Each Part's tests are listed inline above. Summary:

- Parts A, B, C: unit/mocked tests only (`bun run test:run`).
- Part D, E, and F's items (a), (c), (e): **real-DB integration tests are
  required** — these are money/race-condition fixes and a mocked DAL can't
  prove a `WHERE` clause, `ON CONFLICT` target, or advisory-lock
  serialization actually holds under two real connections. Run
  `docker compose up -d && bun run db:push:e2e && bun run test:integration`.
- Part F items (b) and (d): unit/mocked tests suffice (the fix is a status
  guard / a re-check inside an existing transaction, not a new concurrency
  primitive); a real-DB test is a nice-to-have, not required.
- Part G: no new tests (deletion only); full suite must still pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` (full suite) → exit 0
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0, including every new `*.integration.test.ts` listed above
- [ ] A `proposedTime` of `"9am"` is rejected with 400 at the API boundary (Part A)
- [ ] `serviceRefundBreakdown` for `half_refund_under_24h` is pinned by a test to the service-price base, and the maintainer has confirmed Decision 1 before the policy doc comment (Part B) is added — or the alternate Option 2 path was taken instead, per their decision
- [ ] A dispute in `open` status past its `evidenceDeadline` is moved to `under_review` and notified by the hourly sweep, the same as `evidence_requested` (Part C)
- [ ] 5 concurrent dispute filings against a shared monthly limit produce exactly the limit's worth of rows (Part D)
- [ ] 20 concurrent evidence uploads against one dispute/user produce exactly 10 rows (Part D)
- [ ] Two overlapping `releaseExpiredReviews` runs against the same expired pair notify exactly once (Part E)
- [ ] Two concurrent first messages between the same pair of users land in one conversation, not a 409 (Part F-a)
- [ ] A blocker introduced during `anonymizeUser`'s transaction aborts the deletion (Part F-b)
- [ ] Part F-c: R-PERF-04 Part A's index, upsert and race test are present (verify-only here)
- [ ] A second verify/deny on an already-decided membership returns 409, not a silent overwrite (Part F-d)
- [ ] `dispute-financial.ts` and its test are deleted; full suite still passes (Part G)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row added for this plan in `plans/backend-audit/10-remediation-roadmap.md`'s Execution order & status table (done by whoever wires plans into the roadmap, per this repo's convention — not this plan's author)

## STOP conditions

- Any "Current state" excerpt above doesn't match live code (drift since
  `29fe557`) — re-verify that Part's file:line citations before proceeding;
  a mismatch in one Part does not block the others.
- Decision 1 (Part B) or Decision 2 (Part D) has not been confirmed by the
  maintainer before landing the corresponding Part's steps — land the other
  Parts first if so.
- Part F-c's verify finds R-PERF-04 Part A not landed — run that first.
- A real-DB race test is flaky (passes sometimes, fails sometimes) after one
  reasonable fix attempt — this usually means the lock/CAS isn't actually
  serializing the two connections; do not loosen the test's assertion to make
  it pass, stop and report.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

- Part A: tightens a request-body validation the mobile app already sends
  correctly (`"HH:MM"` per the shared contract); no behavior change for any
  compliant client, only for malformed/adversarial input.
- Part B: no client-visible shape change either way (Option 1 changes no
  code; Option 2, if chosen instead, would change a refund amount the mobile
  cancellation-preview screen displays — flag a **Mobile client follow-ups**
  row only if Option 2 is chosen).
- Part C: adds a notification (`dispute_evidence_deadline_approaching` /
  the expiry notice) to a case (`open` disputes) that previously never fired
  one — additive, no existing contract changes.
- Part D: `DisputeRateLimitedError` and `EvidenceLimitReachedError` already
  exist and are already mapped by `handleApiError` with stable `code`s
  (`dispute-errors.ts:74-84`, `:120-126`); this plan doesn't add a new code,
  it only closes the window during which the check could be bypassed. No
  contract change.
- Part E: no response-shape change; fixes a notification duplicate and an
  internal aggregate, both invisible to the client contract.
- Part F: (a) `findOrCreateConversation`'s return type is unchanged; (b)–(e)
  are internal races with no new response shape. (d) does add a new possible
  409 for an already-decided membership — admin-only endpoint, not part of
  the mobile contract.
- No new stable `code` anywhere in this plan, so no roadmap Mobile-follow-ups
  row is needed unless Decision 1's Option 2 is chosen for Part B.

## Production cutover

- hoador is not in production yet (dev = Neon `ep-lucky-block`, staging =
  `ep-polished-tree`). Every migration below still gets a cutover row per
  `plans/backend-audit/13-production-cutover.md`'s convention.
- Part F-c adds no migration here: `user_addresses_primary_unique` and its
  duplicate pre-check are R-PERF-04's cutover rows.
- No Part in this plan adds a migration.

## Maintenance notes

- If the maintainer later wants to consolidate all rate limits onto one
  mechanism, `RateLimitDAL.consume` (Decision 2's Option 2) is the natural
  target — but it needs either a calendar-aware key-rotation helper or a
  documented shift from "calendar month" to "rolling window" semantics before
  the dispute cap can move onto it.
- Part D's advisory-lock key for the evidence cap
  (`hashtext(disputeId || ':' || userId)`) collides in the same hash space as
  Part D's dispute-cap key (`hashtext(userId)`) and R-CONC-01's listing key
  (`hashtext(listingId)`) — `hashtext` collisions are possible in principle
  (it's a 32-bit hash) but the existing R-CONC-01 precedent accepts the same
  risk; not worth a namespacing scheme for a LOW-severity fix.
- Part C's rename suggestion for `listExpiredEvidenceRequests` is optional —
  skip it if the call-site grep turns up anything non-trivial to update.
