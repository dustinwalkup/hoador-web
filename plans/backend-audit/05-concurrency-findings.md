# Concurrency, race-condition and idempotency findings

Covers duplicate and concurrent requests, TOCTOU, missing transactions/CAS, cron overlap, webhook redelivery and Stripe idempotency keys. Postgres runs at READ COMMITTED; the codebase uses no row locks, advisory locks or exclusion constraints, and only three DAL files use transactions.

How to read this document:

- IDs are the audit's final IDs (see `09-priority-matrix.md`). Each finding lists the auditor report(s) it was consolidated from; duplicates reported by several auditors were merged into one finding.
- Every CRITICAL/HIGH finding was re-verified by the lead auditor against the source code in a second, adversarial pass; the verdict box says what was checked and whether the grade changed. MEDIUM/LOW findings were spot-checked, not all independently re-traced.
- "Auditor's original grading" preserves the auditor's own severity and confidence line; the headline severity above it is the final one.
- Paths are relative to `hoador-web/` unless prefixed `hoador-mobile/` or `m:` (mobile). References such as "Open question 1" point to the auditor open questions reproduced at the end of this document.
- Audited at `hoador-web` develop `21bdc61` (2026-09-23). Read-only: no application code was changed.

## Summary

Findings in this document: CRITICAL 0 · HIGH 2 · MEDIUM 3 · LOW 6.

| ID      | Severity | Confidence | Finding                                                                                                                                                                                                             | Plan                                                                 |
| ------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| CONC-01 | HIGH     | High       | Overlapping rental requests can both be approved and charged: availability is checked only at create, only against approved/active rows, fails open, and has no DB constraint                                       | [R-CONC-01](remediations/R-CONC-01-prevent-overlapping-approvals.md) |
| CONC-02 | HIGH     | High       | Approved-rental cancel and admin no-show move money before their status CAS, and start/end are not CAS: an owner racing cancel against start gets the renter fully refunded and still gets paid from platform funds | [R-CONC-02](remediations/R-CONC-02-rental-cancel-claim-first.md)     |
| CONC-03 | MEDIUM   | High       | Decline is an unguarded read-then-write that races an in-flight approve/accept (charged but declined)                                                                                                               | —                                                                    |
| CONC-04 | MEDIUM   | Medium     | Payout crons ignore a dispute/chargeback freeze that lands after the eligibility read                                                                                                                               | —                                                                    |
| CONC-05 | MEDIUM   | Medium     | Service cancel's dispute check is TOCTOU and the cancel transfer overwrites a freeze                                                                                                                                | —                                                                    |
| CONC-06 | LOW      | High       | Stripe Customer / Connect account get-or-create is check-then-create with no idempotency key                                                                                                                        | —                                                                    |
| CONC-07 | LOW      | High       | Count-then-insert caps (dispute rate limit, evidence cap) can be bypassed with parallel requests                                                                                                                    | —                                                                    |
| CONC-08 | LOW      | High       | Review release still double-notifies under overlapping runs (new evidence vs plan 014) and aggregates can lose updates                                                                                              | —                                                                    |
| CONC-09 | LOW      | High       | Dispute resolve/state changes have no atomic claim                                                                                                                                                                  | —                                                                    |
| CONC-10 | LOW      | High       | Cron workflow has no concurrency group; deposit-hold paths write from stale snapshots                                                                                                                               | —                                                                    |
| CONC-11 | LOW      | High       | Minor check-then-act races (conversation creation, account deletion, primary address, membership, approve payment method)                                                                                           | —                                                                    |

## Findings

### CONC-01: Overlapping rental requests can both be approved and charged: availability is checked only at create, only against approved/active rows, fails open, and has no DB constraint

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** RACE-02, BIZ-07, DB-07
**Remediation plan:** [R-CONC-01](remediations/R-CONC-01-prevent-overlapping-approvals.md)

> **Adversarial review (lead auditor):** Verified: `getBookedDatesForListing` blocks only approved/active requests (`src/dal/rentals.dal.ts:2662-2735`), the approve path never re-checks, and no exclusion constraint exists. Graded HIGH (the business-logic auditor had MEDIUM): no race is required - ordinary owner behaviour on popular dates double-books an item and charges two renters.

- _Auditor's original grading:_ HIGH | **Confidence:** High. Only request creation checks; the approve path has no availability call.
- **Files:** `src/features/rentals/services/rental-quote.ts:103-106,147-158`, `src/dal/rentals.dal.ts:2677-2689`, `src/features/rentals/lib/availability.ts:10`
- **Affected routes / jobs:** `POST /api/rentals`, `POST /api/rentals/[id]/approve`
- **Relevant code:**

```
rentals.dal.ts
2685            eq(rentalRequests.listingId, listingId),
2686            inArray(rentalRequests.status, ["approved", "active"]),
availability.ts
10 * `getBookedDatesForListing`, and there is no DB constraint behind it either.
```

- **What is wrong:**
  - The overlap check runs once, at request creation, and only against approved and active requests.
  - Pending requests never block, and approve does not re-check.
  - Creating a request can also race an approve: the create reads booked dates before the approve commits.
- **Interleaving:**
  1. Renter A requests Saturday–Sunday; the request is pending.
  2. Renter B requests the same dates. There is no conflict at `rental-quote.ts:147`, because A is only pending.
  3. The owner approves A, and A is charged.
  4. The owner approves B, and B is charged. Nothing re-checks.
- **Reachability:** Normal owner behaviour on popular dates. No parallel requests needed, and the mobile app doesn't flag the conflict.
- **Mitigating layers checked:** None: no constraint, lock or re-check.
- **Real-world impact:**
  - Two renters are charged for one item.
  - If the loser cancels within 24h, they get back only 50% of the rental price, and the owner receives the retained share (`refund-calculations.ts:35-43`).
  - Rental dispute resolution never refunds the charge; it only captures or releases the deposit (`dispute-resolution-service.ts:152-193`).
- **Recommended fix:**
  - In approve, after the claim, run `findConflict` against approved and active requests while holding `pg_advisory_xact_lock(hashtext(listing_id))`.
  - Add a backing constraint: `CREATE EXTENSION IF NOT EXISTS btree_gist; ALTER TABLE rental_requests ADD CONSTRAINT rr_no_overlap EXCLUDE USING gist (listing_id WITH =, tsrange(start_date, end_date + interval '1 day') WITH &&) WHERE (status IN ('approved','active','overdue'));`
- **Tests needed:** On a real DB, approve two overlapping pending requests, both sequentially and concurrently; the second must be rejected before any charge.
- **Related:** BIZ-01.

### CONC-02: Approved-rental cancel and admin no-show move money before their status CAS, and start/end are not CAS: an owner racing cancel against start gets the renter fully refunded and still gets paid from platform funds

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** RACE-03, PAY-05, BIZ-05, DB-02
**Remediation plan:** [R-CONC-02](remediations/R-CONC-02-rental-cancel-claim-first.md)

> **Adversarial review (lead auditor):** Verified: `cancelApprovedRental` refunds, releases and transfers before its `WHERE status='approved'` CAS (`src/features/rentals/services/cancellation-service.ts:161-244`); `startRental` reads then writes by id (`src/dal/rentals.dal.ts:2737-2806`). The lead added the decisive facts: rental payout eligibility (`findEligibleForPayout`, `src/dal/payment-lifecycle.dal.ts` ~L358-400) checks neither `payments.status = 'refunded'` nor `ownerTransferStatus`, and Stripe documents that refunds don't limit later `source_transaction` transfers. So an owner who fires cancel (slow: a Stripe refund call) and start (fast: one UPDATE) in parallel reliably gets both - a 100% refund to the renter and, once the rental is ended, the full payout from platform funds. Repeatable by a colluding owner and renter (or one person with two accounts). This is the top money-integrity item; borderline CRITICAL, held at HIGH because it needs a KYC'd Connect account, an admin-approved listing and a colluding renter.

- _Auditor's original grading:_ HIGH | **Confidence:** Medium. The code path is verified, but the renter variant needs its timing to line up with the owner's start.
- **Files:** `src/features/rentals/services/cancellation-service.ts:111-123,161-240,244-277`, `src/dal/rentals.dal.ts:2774-2806,3460-3465`, `src/features/rentals/services/payment-lifecycle-service.ts:62,95,176-179`
- **Affected routes / jobs:** `POST /api/rentals/[id]/cancel`, `POST /api/rentals/[id]/start`, cron `process-payouts`
- **Relevant code:**

```
cancellation-service.ts
161  const refundResult = await processRefund({
183      await releaseDepositHold(ctx.securityDepositAuthId);
210    const transferResult = await createOwnerTransfer({
244  await rentalDAL.cancelApprovedRental(      // CAS WHERE status='approved' (rentals.dal.ts:3460-3465)
rentals.dal.ts
2774      if (request.status !== "approved") {
2803          status: "active",                  // UPDATE … WHERE id only (2800-2806)
```

- **What is wrong:**
  - The cancel reads status (`:111-123`), then refunds, releases the deposit and transfers to the owner, and only then runs the CAS.
  - If the owner's start wins in between, the cancel throws after all the money has moved.
  - `markCancelled`, the audit row and the ops alert (`:251-277`) are skipped.
- **Interleaving:**
  - Renter variant:
    1. The renter's cancel reads `approved` at `:111`. On the start day this is the under-24h tier.
    2. It refunds R/2 at `:161` and releases the deposit at `:183`.
    3. It transfers R/2 minus the fee to the owner and sets `ownerTransferStatus='completed'` (`:210-227`).
    4. Meanwhile the owner's start reads `approved` (`:2774`) and writes `active` (`:2800-2806`).
    5. The cancel's CAS at `:244` fails, and the renter gets a 500.
    6. Later the payout cron skips the release (`:62`) and the transfer (`:95`), then marks the payout completed (`:176`).
  - Owner variant, where both requests come from the owner:
    1. The owner's cancel refunds 100% (`refund-calculations.ts:49-57`) and makes no transfer.
    2. Start wins, and the lifecycle stays pending/pending.
    3. After the rental ends, the cron transfers the full `ownerPayout` against a fully refunded charge (see Open question 1).
- **Reachability:**
  - Renter variant: a malicious renter at pickup fires cancel 0–2 s before the owner taps start. The window is the Stripe latency of the refund, cancel and transfer calls.
  - Owner variant: two parallel requests from one actor.
  - A plain double-submit of cancel produces a false `release_failed` status and ops alert (`:191-203`).
- **Mitigating layers checked:**
  - Refund keys include the amount, so identical refunds collapse.
  - Any two different cancel refunds add up to more than the charge (R + R/2 > R + fee), so Stripe rejects the second.
  - Nothing prevents refund-then-start.
- **Real-world impact:**
  - The renter keeps the item, gets 50% back and has no deposit hold.
  - The owner loses about R/2 of their payout.
  - This is silent: no alert and no audit row.
- **Recommended fix:**
  - Claim first, as plan 011 did for services: a CAS from `approved` to `cancelled` with `.returning()` checked before any Stripe call.
  - Make `startRental` and `endRental` CAS on the expected status.
- **Tests needed:** Run cancel (with the Stripe mock parked on a barrier) concurrently with start on a real DB. Assert that exactly one wins; if start wins, no refund or transfer is called.
- **Related:** Plan 011 made this fix for services only; the rental twin was missed.

### CONC-03: Decline is an unguarded read-then-write that races an in-flight approve/accept (charged but declined)

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** RACE-05

> **Adversarial review (lead auditor):** Kept MEDIUM (known follow-up for services; the rental sibling is new).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `src/features/services/services/service-booking-service.ts:605-620,457-468`; `src/dal/rentals.dal.ts:2053-2075`
- **Affected routes / jobs:** service `/decline` vs `/accept`; rental `/decline` vs `/approve`
- **Relevant code:**

```
service-booking-service.ts
612    if (detail.status !== "pending" && detail.status !== "payment_failed") {
616    const updated = await serviceBookingDAL.update(bookingId, {   // WHERE id only
457      updated = await serviceBookingDAL.update(bookingId, {         // post-charge, WHERE id only
458        status: "accepted",
```

- **What is wrong:** Decline ignores `paymentStatus='processing'`, and accept's post-charge write is also unconditional, so the last writer wins.
- **Interleaving:**
  - Case (a), wide window:
    1. Accept claims the booking (`:287`).
    2. Decline writes `declined` (`:616`), and the requester is told it was declined (`:632`).
    3. The charge succeeds, and `:457` overwrites the status to `accepted`.
  - Case (b), narrow window. Decline reads before `:457` and writes after it:
    - The booking ends `declined`, with `paymentStatus` succeeded and a lifecycle row.
    - The requester has been charged but has no cancel path (the status is not cancellable) and no dispute path (disputes need accepted or completed).
    - The status is not `processing`, so no detector sees it.
  - Rental twin:
    - A decline during the charge makes the DAL throw, leaving the request charged, denied and `processing`. The detector catches this.
    - In the narrow window, the request ends denied and `succeeded`, and nothing detects it.
- **Reachability:** A provider or owner firing accept and decline in parallel (two devices or a script). Case (b) is a one-round-trip window.
- **Mitigating layers checked:** The stale-claim detector, for the rental `processing` case only.
- **Real-world impact:** The requester or renter is charged on a declined booking and needs a manual refund. In case (a), the booking is accepted and charged but the requester was told it was declined.
- **Recommended fix:**
  - Decline via `updateIfStatus(..., {blockWhilePaymentProcessing:true})`, and the rental equivalent CAS.
  - Make the post-charge (Region B) update filter on `WHERE payment_status='processing' RETURNING`, and alert when it matches 0 rows.
- **Tests needed:** A concurrency test with a barrier inside the mocked charge.
- **Related:** Known: plans/README.md follow-up (service `declineBooking`). The rental decline is the missed sibling.

### CONC-04: Payout crons ignore a dispute/chargeback freeze that lands after the eligibility read

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** RACE-06

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. The interleaving is verified; the windows are narrow.
- **Files:** `src/features/rentals/services/payment-lifecycle-service.ts:33,49,62-91,95,135,165-179`, `src/dal/payment-lifecycle.dal.ts:254-258,553-560,584-598`, `src/features/services/services/service-payment-lifecycle-service.ts:25,37,65,88-100`, `src/dal/service-payment-lifecycle.dal.ts:160-164`, `src/services/stripe/chargeback-service.ts:161-201`
- **Affected routes / jobs:** crons `process-payouts`, `process-service-payouts`; `POST /api/stripe/webhooks` (`charge.dispute.created`); `POST /api/disputes/[id]/resolve`
- **Relevant code:**

```
payment-lifecycle.dal.ts
257            eq(rentalPaymentLifecycle.payoutStatus, "pending"),   // claim
556            ownerTransferStatus: "frozen",                        // freeze (payoutStatus untouched)
payment-lifecycle-service.ts
95        if (rental.lifecycle.ownerTransferStatus === "pending") {  // pre-claim snapshot
165          await paymentLifecycleDAL.updateOwnerTransferStatus(    // "completed" clobbers "frozen"
```

- **What is wrong:**
  - The claim checks only `payoutStatus`, while a freeze changes only `ownerTransferStatus`.
  - The rental cron decides the release and the transfer from the snapshot read at `:33`.
  - The write after the transfer overwrites `frozen`. The service cron has the same shape (`:88`).
  - `unfreezeAfterResolution` can't tell a chargeback freeze from the resolved dispute's own freeze.
- **Interleaving:**
  - Case 1:
    1. The cron takes its snapshot (`:33`).
    2. A chargeback webhook freezes the lifecycle (`chargeback-service.ts:201`).
    3. The cron's claim succeeds (`:49`).
    4. The deposit is released (`:62-91`), the transfer runs (`:135`), and `:165` marks it completed.
  - Case 2:
    1. An admin resolution does its money operations.
    2. A chargeback freeze lands.
    3. The resolution's unfreeze runs (`dispute-resolution-service.ts:218`) and erases that freeze.
    4. The next cron run pays out.
- **Reachability:** Rare timing only; a single user cannot exploit this.
  - A webhook has to arrive in the seconds-per-row window of the daily batch, or a filing's window check has to pass just before `returnConfirmedAt+24h`.
  - Otherwise the dispute window (`dispute.dal.ts:939-943`) and payout eligibility (`payment-lifecycle.dal.ts:362,393`) are complementary.
- **Mitigating layers checked:** Eligibility excludes open disputes (and, for services, `frozen`), but only as of the snapshot. Nothing re-checks after the claim.
- **Real-world impact:** The owner or provider is paid, and the deposit released, while a dispute or chargeback is open. No detector catches it.
- **Recommended fix:**
  - Claim with `WHERE payout_status='pending' AND owner_transfer_status='pending' AND NOT EXISTS(open dispute) RETURNING *`, and act on the returned row.
  - Write statuses with `WHERE owner_transfer_status <> 'frozen'`.
  - Track chargeback holds separately from dispute freezes.
- **Tests needed:** A DAL test that renders the claim SQL, and a cron test where a freeze is injected between the query and the claim.
- **Related:** CONC-05, Open question 3.

### CONC-05: Service cancel's dispute check is TOCTOU and the cancel transfer overwrites a freeze

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** RACE-08

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium
- **Files:** `src/features/services/services/service-booking-service.ts:708-728,757-767,809-833`, `src/features/disputes/services/dispute-creation-service.ts:365-393,432-450`, `src/features/disputes/services/dispute-resolution-service.ts:318-341,465-477`
- **Affected routes / jobs:** `POST /api/services/bookings/[id]/cancel`, `POST /api/disputes`, `POST /api/disputes/[id]/resolve`
- **Relevant code:**

```
service-booking-service.ts
708    const activeDispute =
709      await disputeDAL.getActiveByServiceBookingId(bookingId);
757    const claimed = await serviceBookingDAL.updateIfStatus(     // status only, no dispute predicate
825          await servicePaymentLifecycleDAL.updateOwnerTransferStatus(   // "completed" over "frozen"
```

- **What is wrong:** The cancel reads whether a dispute exists before its CAS, and the CAS doesn't re-check. The cancel's provider transfer writes `completed` over a `frozen` status.
- **Interleaving:** On the service day, the requester sends cancel and dispute-create in parallel:
  1. The cancel sees no dispute (`:708`).
  2. The dispute is created and the lifecycle frozen (`:432-450`).
  3. The cancel's CAS succeeds.
  4. The cancel refunds 50% of the price and transfers the 30% late-cancel share to the provider (`:816-833`).
  5. The dispute is later resolved in the requester's favour. The `service-refund-{disputeId}` refund carries no amount, so it refunds the remaining balance (`dispute-resolution-service.ts:465-477`).
- **Reachability:** One requester with parallel requests; the payoff needs an admin ruling. Rental twin: `cancelApprovedRental` never checks disputes, and its transfer (`cancellation-service.ts:209-227`) also overwrites `frozen`.
- **Mitigating layers checked:** The eligibility check at `:708` (TOCTOU); the Stripe refund cap, which limits refunds to the charge but not refund plus transfer.
- **Real-world impact:** The requester gets about 100% back while the provider keeps the 30% share, which the platform funds. The dispute stays open on a cancelled booking.
- **Recommended fix:**
  - Add `NOT EXISTS (active dispute)` to the cancel CAS.
  - Have dispute creation CAS or lock the booking row.
  - Only transfer when `owner_transfer_status <> 'frozen'`.
- **Tests needed:** Cancel and dispute-create run concurrently, with a barrier between the dispute read and the claim.
- **Related:** CONC-04.

### CONC-06: Stripe Customer / Connect account get-or-create is check-then-create with no idempotency key

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** RACE-09, PAY-11, DB-12

> **Adversarial review (lead auditor):** Graded LOW (auditors ranged LOW-MEDIUM): self-inflicted by double-taps, recoverable by support.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. The code is verified; how often it happens depends on clients sending parallel calls.
- **Files:** `src/dal/user.dal.ts:1080-1103,1127-1144`, `src/app/api/(payments)/create-setup-intent/route.ts`
- **Affected routes / jobs:** `stripe/payment-sheet-params`, `stripe/create-account-session`, `stripe/create-account-link`, `create-setup-intent`
- **Relevant code:**

```
user.dal.ts
1127      if (userData.stripeConnectedAccountId) {
1135      const account = await createConnectedAccount(userId, userData.email);
1141          stripeConnectedAccountId: account.id,        // UPDATE … WHERE id only (1138-1144)
```

- **What is wrong:** The method reads, then creates the Stripe object, then writes the id unconditionally, with no idempotency key and no conditional update.
- **Interleaving:** Two parallel calls both read null and both create an object. The last write wins, but each response returns its own id.
- **Reachability:** A normal double-tap or parallel screen mounts. Only the caller is affected.
- **Mitigating layers checked:** None.
- **Real-world impact:** No money is lost, but support has to re-link the account.
  - A card saved on the orphaned customer is invisible at approve ("No payment method").
  - Onboarding (KYC) completed on the orphaned Connect account leaves payouts blocked.
- **Recommended fix:** Use `idempotencyKey: customer-{userId}` / `connect-account-{userId}`, plus `UPDATE … WHERE stripe_*_id IS NULL RETURNING`. On 0 rows, re-read and return the winner.
- **Tests needed:** Concurrent calls with mocked Stripe; expect one stored id, returned to both callers.
- **Related:** Open question 6.

### CONC-07: Count-then-insert caps (dispute rate limit, evidence cap) can be bypassed with parallel requests

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** RACE-10

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Files:** `src/dal/dispute.dal.ts:863-896` via `dispute-creation-service.ts:200-211,220`; `src/app/api/disputes/[id]/evidence/route.ts:120-129,150-165,195-201`
- **Affected routes / jobs:** `POST /api/disputes`, `POST /api/disputes/[id]/evidence`
- **Relevant code:** `evidence/route.ts:124  if (existingCount >= MAX_EVIDENCE_ITEMS) {` … `:195  const evidence = await disputeDAL.createEvidence({`
- **What is wrong:** Both caps count first and insert later, with no lock or constraint in between.
- **Interleaving:**
  - Evidence: N parallel uploads all count below 10 while image processing and the blob upload run, then all insert.
  - Disputes: N parallel filings on different eligible bookings all see `monthlyCount < 3`.
- **Reachability:** One user with parallel requests.
- **Mitigating layers checked:** None; rate limiting for uploads is a known deferred gap in plans README.
- **Real-world impact:** Unbounded public blob uploads and admin noise, plus extra payout freezes (delayed, not lost).
- **Recommended fix:** Do the count and insert in one transaction under `pg_advisory_xact_lock(hashtext(dispute_id||user_id))`, or keep a counter row updated by CAS.
- **Tests needed:** Fire 20 parallel uploads against a real DB; expect exactly 10 rows.

### CONC-08: Review release still double-notifies under overlapping runs (new evidence vs plan 014) and aggregates can lose updates

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** RACE-11

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High. This is new evidence against plan 014's claim.
- **Files:** `src/dal/blind-review.dal.ts:379-389`, `src/features/reviews/services/blind-review-service.ts:84-108,236-255`, `src/dal/user.dal.ts:1254-1276`
- **Affected routes / jobs:** `POST /api/reviews`, cron `release-reviews`
- **What is wrong:**
  - Plan 014's `isNull(releasedAt)` guard never returns the rows it changed, and `releaseExpiredReviews` notifies the whole group anyway. Overlapping runs therefore still double-notify, although the plans README says 014 fixed this.
  - Two parties submitting at the same moment can both release and both notify.
  - `updateReviewAggregate` is a SELECT followed by an UPDATE, outside a transaction.
- **Interleaving:** Two overlapping cron runs both fetch the same expired reviews. Run A releases them. Run B's guarded update changes nothing, but B still recomputes aggregates and sends the notifications (`:236-255`).
- **Reachability:** Overlapping cron runs (CONC-10) or simultaneous submissions.
- **Mitigating layers checked:** The DB guard prevents a double release, but not the double notification.
- **Real-world impact:** Duplicate pushes, and review counts that stay stale until the next release.
- **Recommended fix:** Use `.returning({id})` and notify only the returned ids. Recompute the aggregate in a single `UPDATE … = (SELECT …)` statement.
- **Tests needed:** A service test where the release reports 0 affected rows; expect no notification.

### CONC-09: Dispute resolve/state changes have no atomic claim

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** RACE-12, DB-10

> **Adversarial review (lead auditor):** Kept LOW (admin-only; money operations collapse on keys).

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Files:** `src/features/disputes/services/dispute-resolution-service.ts:98-107,210-218`, `src/dal/dispute.dal.ts:804-815`
- **Affected routes / jobs:** `POST /api/disputes/[id]/resolve`, `PATCH /api/disputes/[id]/state`
- **What is wrong:** The status is read, and then `resolve` updates by `WHERE id` only. Concurrent resolves both run their side effects, and the last outcome label wins.
- **Interleaving:** Two admins, or one double-click, both pass the status check at `:98-107`, both run their money operations, and both call `disputeDAL.resolve`.
- **Reachability:** Admins only.
- **Mitigating layers checked:** The money operations collapse, via the capture key (`:543`), the PaymentIntent state machine, the service refund keys (`:475`) and the Stripe charge cap. The unfreeze is a CAS.
- **Real-world impact:** Duplicate audit rows, notifications and alerts. The outcome label can mismatch the money that actually moved.
- **Recommended fix:** Claim first: `UPDATE disputes SET status='resolving' WHERE id=? AND status IN ('open','evidence_requested','under_review') RETURNING`, before any money operations.
- **Tests needed:** Two concurrent resolves; expect one to succeed and the other to get a 409.

### CONC-10: Cron workflow has no concurrency group; deposit-hold paths write from stale snapshots

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** RACE-13

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Files:** `.github/workflows/cron-jobs.yml:3-12,45-46`, `src/dal/payment-lifecycle.dal.ts:437-443,275-287`, `src/features/rentals/services/payment-lifecycle-service.ts:218-316,504-579`, `cancellation-service.ts:204-206`
- **Affected routes / jobs:** GitHub Actions `cron-jobs.yml` (all jobs); crons `schedule-deposit-holds`, `release-reviews`; `POST /api/rentals/[id]/retry-deposit`, `/cancel`
- **What is wrong:**
  - There is no `concurrency:` key, so a `workflow_dispatch` runs all three jobs at once and can overlap scheduled runs. The hourly and daily schedules also both fire at 10:00 UTC.
  - The payout and expiry paths are CAS-safe (see Verified clean).
  - `scheduleDepositHolds` places holds from a snapshot without re-checking the rental's status, then writes `held` unconditionally.
  - Two concurrent renter retries that resolve different default cards get different card-scoped keys, so both place a hold and one is orphaned.
- **Interleaving:** A renter cancel lands between the cron's read and its `held` write. The hold stays live on a cancelled rental, recorded as either `held` or `released` depending on write order.
- **Reachability:** Rare cron timing. The retry case is self-inflicted by the renter.
- **Mitigating layers checked:** Deterministic hold keys collapse overlapping runs that resolve the same card.
- **Real-world impact:** The renter's funds are authorized for up to 7 days; false ops alerts.
- **Recommended fix:**
  - Add `concurrency: { group: cron-${{ github.job }}, cancel-in-progress: false }` to each job.
  - Claim `scheduled→placing` and `failed→placing` by CAS before placing a hold.
  - Make the `held` write conditional.
- **Tests needed:** Cancel between the cron's snapshot read and its write, with an injected ordering; expect no hold left behind.

### CONC-11: Minor check-then-act races (conversation creation, account deletion, primary address, membership, approve payment method)

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** RACE-14, DB-14

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Instances:**
  - `messages.dal.ts:273-285`: finds and then inserts a conversation. The unique pair (`messages.schema.ts:39-42`) makes a simultaneous first message from both users fail with 409. The message is lost, but a retry works. Fix: `onConflictDoNothing` plus a re-select.
  - `account-deletion-service.ts:107-113`: deletion blockers are counted outside the anonymize transaction. An owner who approves the user's outbound pending request in that gap (not a blocker, by design) charges a user mid-deletion.
  - `user.dal.ts:652-677`: a double-submitted onboarding inserts two primary addresses, because there is no partial unique index.
  - `community.dal.ts:1215-1286`: verify and deny are plain `WHERE id` updates, so the last admin action wins.
  - `rental-service.ts:422-430`: `updateRentalRequestPaymentMethod` runs before the claim. A losing concurrent approve can overwrite the recorded card, which the deposit-hold cron uses later.
- **Tests needed:** A duplicate first-message test against a real DB; expect both sends to land in one conversation.

## Concurrency primitives actually used (concurrency auditor)

| Severity | Count | IDs         |
| -------- | ----- | ----------- |
| CRITICAL | 0     | —           |
| HIGH     | 4     | BIZ-01..04  |
| MEDIUM   | 5     | CONC-03..09 |
| LOW      | 5     | CONC-07..14 |

No CRITICAL finding. Every double-spend I built is blocked by Stripe (deterministic keys, or the cap on total refunds per charge), or it needs the counterparty or an admin to act. The exception is CONC-02's owner variant and BIZ-03, which may become platform-funded payouts. That depends on Stripe behaviour, see Open question 1.

**Concurrency primitives actually used**

- Compare-and-swap (CAS: `UPDATE … WHERE <state> RETURNING`, result checked):
  - Rentals: `rentals.dal.ts:1884-1902` (approve claim), `:1780-1802` (expire), `:3443-3472` (cancel approved; runs after money moves, see CONC-02).
  - Service bookings: `service-booking.dal.ts:175-201` (`updateIfStatus`), `:241-257` (accept claim), `:316-341` (expire).
  - Payouts: `payment-lifecycle.dal.ts:246-266` and `service-payment-lifecycle.dal.ts:152-172` (claim); `:584-604` and `:366-389` (unfreeze).
  - Listings: `listing.dal.ts:2100` (admin review).
- Transactions: only `user.dal.ts:727` (signup), `user-activity.dal.ts:85` and `account-deletion.dal.ts:274`. None wraps a money transition.
- Upserts: `notifications.dal.ts:449`, `user.dal.ts:539`, `community.dal.ts:952,1110`.
- Unique indexes relied on:
  - disputes per rental or booking (`migrations/0050:13-14`)
  - reviews per reviewer and booking (`0056:21-22`)
  - lifecycle rows (`0025:23`, `0046:15`)
  - `rentals.request_id` (`rentals.schema.ts:143,188`)
  - conversation pair (`messages.schema.ts:39-42`)
  - memberships (`communities.schema.ts:100-105`)
- Not used anywhere: `SELECT … FOR UPDATE`, `pg_advisory*` locks, exclusion constraints. Neon runs READ COMMITTED, and each DAL call is one autocommit statement.
- Stripe idempotency keys:
  - Deterministic: `rental-charge-{req}`, `deposit-hold-{req|rental}[-{pm}]`, `deposit-capture-{dispute}`, `refund-{rental|service}-{id}-{charge}-{cents}`, `service-refund-{dispute}[-partial]`, `transfer-owner-{rental}[-retry-n]`, `service-charge-{b}[-retry-{pm}]`, `service-transfer-{b}`, `service-cancel-transfer-{b}`.
  - Random per request: `rental-charge-{req}-retry-${Date.now()}` (`rental-service.ts:476-478`).
  - No key: Stripe customer and Connect account creation (`user.dal.ts:1088,1135`).

## Verified clean (concurrency auditor)

- **Rental approve vs approve (plan 005):** CAS claim at `rentals.dal.ts:1884-1902`, checked at `rental-service.ts:456-464`. The first-attempt key is deterministic, and the uniques on `rentals.request_id` and `rpl_rental_id_idx` backstop duplicate inserts. Retry after failure is also serialized by the claim (for the key issue, see BIZ-11).
- **Service accept vs accept (plan 009):** `service-booking.dal.ts:241-257` checks both status and payment status; keys at `service-booking-service.ts:361-364`.
- **Service complete vs cancel (plan 011):** the `updateIfStatus` CAS at `service-booking.dal.ts:175-201`, used at `service-booking-service.ts:664-676,757-772` with `blockWhilePaymentProcessing`. A requester cancel is also blocked while an accept charge is in flight.
- **Service accept vs pending expiry:** `markExpired` requires `payment_status IS NULL` (`service-booking.dal.ts:316-341`), and the accept claim requires `pending`.
- **Overlapping pending-expiry runs:** the CAS plus notify-only-if-updated logic (`expire-pending-bookings.ts:34-37,49-52`).
- **Payout cron vs itself, and overlapping workflow runs:**
  - The claims at `payment-lifecycle.dal.ts:246-266` and `service-payment-lifecycle.dal.ts:152-172`, plus deterministic keys at `payout.ts:27-30` and `service-payment-lifecycle-service.ts:70`.
  - An admin resetting a `processing` row mid-run collapses on the same key, as long as it happens within 24h (after that, see BIZ-11).
- **Retry-deposit vs `schedule-deposit-holds` (plan 004):** disjoint states. The cron selects only `scheduled` rows (`payment-lifecycle.dal.ts:439`); the retry requires `failed` (`payment-lifecycle-service.ts:505`).
- **Duplicate dispute filing:** unique indexes (`migrations/0050:13-14`) turn the second insert into a `ConflictError` (`base.ts:46-49`). A chargeback webhook racing a user's filing converges through Stripe's retry.
- **Duplicate reviews:** partial unique indexes (`0056:21-22`). Community select/join double submits: `communities.schema.ts:100-105`. Listing admin review: CAS at `listing.dal.ts:2100`.
- **Rental cancel double submit or cross-tier cancels:** the refund key includes the amount (`refund.ts:41-44`). Any two different cancel refunds add up to more than the charge, so Stripe rejects the second before any owner transfer (`cancellation-service.ts:168-170`). Side effects are covered in CONC-02.
- **Webhooks:**
  - `payment_intent.succeeded` does nothing when the payment row is missing and is idempotent when it exists (`webhook-handlers.ts:137-174`).
  - `charge.refunded` and the cancel's `recordRefund` both write `refunded`; the result is the same for single refunds (`:290-299`, `payment.dal.ts:509-518`).
  - `payment_intent.canceled` can't race: deposit PaymentIntent metadata has no `rentalId` (`rental-payments.ts:83-86`, `deposit-hold.ts:45-50`), so the handler returns early at `webhook-handlers.ts:212-215`. The handler is effectively dead code; flag this to the webhook auditor.
- **Unreachable keyless refund:** `refunds.create` in `StripeDisputeService` (`dispute-financial.ts:110`) has no idempotency key, but only its own test imports it.
- **Listing price edit vs approve:** approve charges the stored `totalAmount` (`rental-service.ts:441`).
- **Rejected "messages mark-read race":** no new evidence. It still writes only the caller's own column (`messages.dal.ts:774-786`).

## Auditor open questions — concurrency

1. **Stripe and refunded source charges:** Does Stripe accept a `transfers.create` whose `source_transaction` is a fully refunded charge?
   - If it does, CONC-02 (owner variant) and BIZ-03 become repeatable, platform-funded payouts for one actor with two accounts, which is borderline CRITICAL.
   - If it doesn't, they end in `transfer_failed` alerts.
2. **Schema drift in base tables:** `rentals`, `rental_requests`, `conversations` and `payments` predate the migrations folder (they were created with `db:push`). This audit assumes prod has the uniques declared in the schema; check with `\d`.
3. **Chargeback auto-dispute may never freeze:**
   - The auto-dispute inserts `createdBy: "system"` (`chargeback-service.ts:102,178`) into a column with an FK to `user.id`, and no `system` user is seeded in the migrations.
   - If that user is missing, the insert throws, so the freeze (`:125`, `:201`) never runs, and Stripe retries until it gives up.
   - It isn't a race, but it leaves payouts unprotected whatever the timing.
4. **Cron timeouts:** the cron routes export no `maxDuration`, and `vercel.json` is `{}`. The default timeout decides how often a payout batch is killed mid-row, which drives how often BIZ-11 happens.
5. **Owner payout silently lost when the transfer is skipped:**
   - The rental payout marks `completed` even when it skipped the transfer because `ownerTransferStatus` wasn't `pending` (`payment-lifecycle-service.ts:95-179`).
   - Two ways this happens: a dispute moved to `resolved` via `PATCH /state` (which doesn't unfreeze), or `reset-payout-status` without `reset-transfer-status`.
   - The owner's payout is then silently stranded. This is logic rather than a race; flag it to the payments auditor.
6. **Mobile Connect session calls:** does the mobile Connect provider call `create-account-session` concurrently on first mount? That decides how likely CONC-06 is.
