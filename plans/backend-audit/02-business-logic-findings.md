# Business-logic and payment findings: rentals, service bookings, disputes, Stripe

Covers booking and rental state transitions, service bookings, disputes and reviews, and every Stripe money movement (charges, deposit holds, refunds, transfers, chargebacks, webhooks). Race conditions on the same flows are in `05-concurrency-findings.md`; the state machines are drawn in `12-booking-state-machine.md`.

How to read this document:

- IDs are the audit's final IDs (see `09-priority-matrix.md`). Each finding lists the auditor report(s) it was consolidated from; duplicates reported by several auditors were merged into one finding.
- Every CRITICAL/HIGH finding was re-verified by the lead auditor against the source code in a second, adversarial pass; the verdict box says what was checked and whether the grade changed. MEDIUM/LOW findings were spot-checked, not all independently re-traced.
- "Auditor's original grading" preserves the auditor's own severity and confidence line; the headline severity above it is the final one.
- Paths are relative to `hoador-web/` unless prefixed `hoador-mobile/` or `m:` (mobile). References such as "Open question 1" point to the auditor open questions reproduced at the end of this document.
- Audited at `hoador-web` develop `21bdc61` (2026-09-23). Read-only: no application code was changed.

## Summary

Findings in this document: CRITICAL 0 · HIGH 7 · MEDIUM 6 · LOW 5.

| ID     | Severity | Confidence  | Finding                                                                                                                                                                                                  | Plan                                                                 |
| ------ | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| BIZ-01 | HIGH     | High        | Owner approval charges the renter for requests that were already cancelled, declined or expired (and places a deposit hold)                                                                              | [R-BIZ-01](remediations/R-BIZ-01-approve-only-pending-requests.md)   |
| BIZ-02 | HIGH     | High        | A provider can mark a service complete before the service date; payout follows 24h later and the requester's dispute window is empty                                                                     | [R-BIZ-02](remediations/R-BIZ-02-block-early-service-completion.md)  |
| BIZ-03 | HIGH     | Medium-High | After a full favor_renter dispute refund on a service booking, the provider can mark it complete and the cron pays the provider from platform funds                                                      | [R-BIZ-03](remediations/R-BIZ-03-no-payout-after-dispute-refund.md)  |
| BIZ-04 | HIGH     | High        | A captured security deposit is never transferred to the owner                                                                                                                                            | [R-BIZ-04](remediations/R-BIZ-04-transfer-captured-deposits.md)      |
| BIZ-05 | HIGH     | High        | Resolving a dispute through PATCH /api/disputes/[id]/state skips all money operations; the rental payout cron then marks the payout completed without paying the owner                                   | [R-BIZ-05](remediations/R-BIZ-05-dispute-resolve-via-state-route.md) |
| BIZ-06 | HIGH     | Medium      | Chargeback webhooks cannot create their auto-dispute (created_by='system' violates the user FK), so payouts are never frozen and ops is never alerted                                                    | [R-BIZ-06](remediations/R-BIZ-06-chargeback-system-user-fk.md)       |
| BIZ-07 | HIGH     | High        | Self-deleted (anonymized) users can still be charged: their pending requests stay approvable and their cards are never detached                                                                          | [R-BIZ-07](remediations/R-BIZ-07-stop-charging-deleted-users.md)     |
| BIZ-08 | MEDIUM   | High        | Listing and party eligibility (listing status, archive, approval, community visibility, account status) is not enforced at booking, approval or accept time                                              | —                                                                    |
| BIZ-09 | MEDIUM   | High        | Service payment_failed bookings never expire and the requester cannot cancel them; the provider can re-charge months later                                                                               | —                                                                    |
| BIZ-10 | MEDIUM   | High        | Requests and bookings can be approved/accepted after the booked start, charging for elapsed time                                                                                                         | —                                                                    |
| BIZ-11 | MEDIUM   | Medium      | Indeterminate Stripe failures are recorded as declines and retried under new idempotency keys (possible double charge); payout re-drives after 24h or after admin resets can repeat a succeeded transfer | —                                                                    |
| BIZ-12 | MEDIUM   | High        | Rental approval swallows failures to write the payment row and the payment-lifecycle row after the charge (owner never paid; renter can't cancel)                                                        | —                                                                    |
| BIZ-13 | MEDIUM   | High        | A chargeback after payout overwrites the completed transfer status with 'frozen' and nothing claws the money back                                                                                        | —                                                                    |
| BIZ-14 | LOW      | High        | Webhook state-handling gaps (partial refunds recorded as full, out-of-order events, dead deposit-cancel handler, no refund.failed handling)                                                              | —                                                                    |
| BIZ-15 | LOW      | High        | A free-form service proposedTime forces the generous full-refund tier                                                                                                                                    | —                                                                    |
| BIZ-16 | LOW      | High        | The service late-cancel refund base (50% of service price) differs from the published policy (50% of total)                                                                                              | —                                                                    |
| BIZ-17 | LOW      | High        | Evidence-deadline notifications are never sent and open disputes have no evidence deadline                                                                                                               | —                                                                    |
| BIZ-18 | LOW      | High        | State-machine quirks that cause drift (closed unreachable, overdue never written, freeze overwrites completed, markCancelled overwrites deposit status, hold metadata lacks rentalId)                    | —                                                                    |

## Findings

### BIZ-01: Owner approval charges the renter for requests that were already cancelled, declined or expired (and places a deposit hold)

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** RACE-01, PAY-01, BIZ-01, DB-01
**Remediation plan:** [R-BIZ-01](remediations/R-BIZ-01-approve-only-pending-requests.md)

> **Adversarial review (lead auditor):** Verified end to end: the approve route has no status check, `getRentalRequestById` filters by id only, the service checks only `ownerId` (`src/features/rentals/services/rental-service.ts:389`), and the claim tests only `paymentStatus` (`src/dal/rentals.dal.ts:1884-1905`). Cancel, decline and expiry never touch `paymentStatus`, which defaults to `'pending'` (`src/db/schemas/rentals.schema.ts:78`). The charge (`rental-service.ts:476-489`) runs before the only status check (`rentals.dal.ts:1980-1981`). No concurrency is needed - a stale owner screen triggers it by accident. Reported independently by four auditors; it is the sequential form of the known 'approve vs renter-cancel' follow-up.

- _Auditor's original grading:_ HIGH | **Confidence:** High. The path is deterministic, so no race is needed.
- **Files:** `src/features/rentals/services/rental-service.ts:382-393,454-464,642-653,674-688`, `src/dal/rentals.dal.ts:1884-1902,1970-1981,1808-1847,2045-2079`, `src/db/schemas/rentals.schema.ts:78`
- **Affected routes / jobs:** `POST /api/rentals/[id]/approve`, `/cancel`, `/decline`; cron `expire-pending-bookings`
- **Relevant code:**

```
rentals.dal.ts
1890        .set({ paymentStatus: "processing", updatedAt: new Date() })
1893            eq(rentalRequests.id, requestId),
1894            inArray(rentalRequests.paymentStatus, ["pending", "failed"]),
1980      if (request.status !== "pending") {          // runs AFTER the charge
service-booking.dal.ts (sibling claim that has the guard)
249            inArray(serviceBookings.status, ["pending", "payment_failed"]),
```

- **What is wrong:**
  - The only status check on the approve path comes after the charge and the deposit hold.
  - Cancel, decline and expiry never change `paymentStatus` (default `'pending'`, schema :78), so a cancelled, denied or expired request can still be claimed.
  - Cancel (`:1834-1843`) and decline (`:2068-2075`) are read-then-write updates filtered only by `WHERE id`.
- **Interleaving:**
  - Sequential (no race needed):
    1. The renter cancels (`:1834`). Status becomes cancelled; paymentStatus stays pending.
    2. Later, the owner calls approve. `rental-service.ts:382` does no status check.
    3. The claim at `:456` succeeds.
    4. The renter is charged off-session at `:481-489`.
    5. A deposit hold is placed at `:642-653` if pickup is within 48h.
    6. The DAL throws at `rentals.dal.ts:1980`, and the service throws "Payment was processed but approval failed" at `:685`.
  - Concurrent: a renter cancel, owner decline or expiry that lands before `:1970` gives the same result.
  - Narrow window: a decline or cancel that reads before `:1985` and writes after `:2001` leaves the row cancelled or denied with `paymentStatus='succeeded'` and rental, lifecycle and payment rows.
- **Reachability:** Any owner, with one request, against any renter who ever requested their listing. Known: plans/README.md follow-up ("approve vs renter-cancel not serialized"). New evidence: no concurrency is required, and decline and expiry are affected too.
- **Mitigating layers checked:**
  - The stale-claim detector (`stale-processing-detection-service.ts:82-108`, runs hourly, 15-minute threshold) alerts on the `processing` outcome.
  - It misses the narrow `succeeded` variant.
  - The owner can also erase the row before the detector runs. `deleteListing` only counts pending, approved, active and overdue requests (`rentals.dal.ts:2636-2654`), and it hard-deletes with a cascade (`listing.dal.ts:685-688`, `rentals.schema.ts:31`).
  - After that, only audit rows remain (`payment.captured`, `webhook.unmatched_payment_intent`), and neither raises an alert.
- **Real-world impact:**
  - The renter is charged `totalAmount`, plus a live deposit authorization for up to 7 days, on a request that was cancelled, declined or expired.
  - The owner gains nothing.
  - The refund is manual, and the platform is exposed to a chargeback.
- **Recommended fix:**
  - Add `eq(rentalRequests.status,'pending')` to the claim, and check status before any Stripe call.
  - Change cancel, decline and expire to CAS on `WHERE status='pending' AND payment_status IS DISTINCT FROM 'processing' RETURNING`, mirroring the service `blockWhilePaymentProcessing` option.
  - Make `approveRentalRequest` a single transaction whose update is `WHERE status='pending' AND payment_status='processing' RETURNING`. This also closes the known non-transactional follow-up.
  - Count requests in `processing` as listing-deletion blockers.
- **Tests needed:**
  - Real DB: cancel a request, then approve with Stripe mocked; expect the claim to return false and no charge.
  - A DAL test that renders the claim's SQL and pins `status = 'pending'`.
  - Approve and decline run concurrently, with a barrier after the claim.
- **Related:** CONC-03, BIZ-11.

### BIZ-02: A provider can mark a service complete before the service date; payout follows 24h later and the requester's dispute window is empty

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** BIZ-02
**Remediation plan:** [R-BIZ-02](remediations/R-BIZ-02-block-early-service-completion.md)

> **Adversarial review (lead auditor):** Verified: `completeBooking` checks provider, `accepted` and a CAS only (`src/features/services/services/service-booking-service.ts:640-678`); the filing window is `[service dayStart, completedAt+24h]` (`src/features/disputes/lib/time-window-validation.ts:191-225`), empty whenever completion is more than 24h early; payout needs only `completedAt < cutoff`. Chains with BIZ-13 (no clawback after payout) and BIZ-06 (the chargeback path fails).

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `src/features/services/services/service-booking-service.ts:640-678`; `src/features/disputes/lib/time-window-validation.ts:191-225`; `src/features/disputes/services/dispute-creation-service.ts:365-393`; `src/dal/service-payment-lifecycle.dal.ts:260-270`; `src/features/services/lib/booking-cancellation.ts:68-74`
- **Affected routes:** `POST /api/services/bookings/[id]/complete`, `POST /api/disputes`, cron `process-service-payouts`
- **Relevant code:**

```ts
// service-booking-service.ts:664-668 — status CAS only, no date/time check
const updated = await serviceBookingDAL.updateIfStatus(
  bookingId,
  "accepted",
  {
    status: "completed",
// time-window-validation.ts:198 — window opens on the service day…
if (now < dayStart) {
// …and closes at completedAt + 24h (205-206, 214)
```

- **What is wrong:**
  - If `completedAt` is more than 24h before the service day, the filing window is empty.
  - Creation then throws `DisputeWindowClosedError`. The S12 allowance doesn't apply because `completedAt` is set (`dispute-creation-service.ts:370-392`).
  - Payout needs only `completedAt < now-24h` (`service-payment-lifecycle.dal.ts:262-268`).
  - Completed bookings cannot be cancelled (`booking-cancellation.ts:68-74`).
  - This violates policy §6 ("after the Provider marks the service complete and a 24-hour dispute window has elapsed", `specs/cancellation-refund-policy.html`) and `specs/services/phase1` Req 7.
  - The mobile app promises a 24-hour window (`hoador-mobile/src/features/services/components/provider-booking-actions.tsx:146`).
- **Exploit / failure scenario:** The provider accepts a booking for day D+5 (requester charged), then POSTs `/complete` immediately. The next daily payout run after 24h transfers `providerPayout`. The requester can neither dispute nor cancel. The web "Mark Complete" button shows for any accepted booking (`src/components/service-booking-detail-client.tsx:733-741`), so an honest early tap has the same effect.
- **Mitigating layers checked:** None. No date check in the route, service or payout query.
- **Real-world impact:** The provider is paid for unperformed work, and the requester's only recourse is a chargeback.
- **Recommended fix:**
  - Reject completion before `serviceInstant(detail)`.
  - Define the filing window as `[min(dayStart, completedAt), completedAt+24h]`.
  - Require the scheduled instant to have passed for payout.
- **Tests needed:**
  - Early completion returns 400.
  - A dispute after early completion is accepted.
  - A booking is not payout-eligible before its service date.
- **Related:** BIZ-03, BIZ-10

### BIZ-03: After a full favor_renter dispute refund on a service booking, the provider can mark it complete and the cron pays the provider from platform funds

**Severity:** HIGH · **Confidence:** Medium-High · **Auditor source(s):** PAY-02, RACE-04, BIZ-03
**Remediation plan:** [R-BIZ-03](remediations/R-BIZ-03-no-payout-after-dispute-refund.md)

> **Adversarial review (lead auditor):** Verified the re-arm path (`dispute-resolution-service.ts:318-341` → `service-booking-service.ts:664-678` → payout eligibility in `service-payment-lifecycle.dal.ts`). The auditors' open question - does Stripe transfer against a fully refunded source charge? - was checked against Stripe's documentation (docs.stripe.com/connect/separate-charges-and-transfers): the only limit is that transfers sourced from a charge may not sum to more than the charge, and 'refunding a charge has no impact on any associated transfers'. The transfer should therefore succeed from platform balance. Confidence raised to Medium-High (not exercised against live Stripe).

- _Auditor's original grading:_ HIGH | **Confidence:** Medium. The code path is verified end to end. Whether money actually moves depends on Stripe accepting a `source_transaction` transfer against a fully refunded charge (Open question 1). If Stripe rejects it, the outcome is a failed transfer plus an ops alert.
- **Files:** `src/features/disputes/services/dispute-resolution-service.ts:318-341`; `src/dal/service-payment-lifecycle.dal.ts:396-412,260-269`; `src/features/services/services/service-booking-service.ts:640-678`; `service-payment-lifecycle-service.ts:65-100`; `dispute-creation-service.ts:308-313,329-337`
- **Affected routes:** `POST /api/disputes/[id]/resolve` (admin) → `POST /api/services/bookings/[id]/complete` (provider) → cron `process-service-payouts`
- **Relevant code:**

```ts
// dispute-resolution-service.ts:341 (favor_renter, after the full refund)
await servicePaymentLifecycleDAL.markRefundedAfterDispute(bookingId); // payout+transfer='completed'; booking stays 'accepted'
// service-booking-service.ts:664-678 — no dispute/refund check
const updated = await serviceBookingDAL.updateIfStatus(bookingId, "accepted", {...});
await servicePaymentLifecycleDAL.updatePayoutStatus(bookingId, "pending"); // unconditional
// service-payment-lifecycle.dal.ts:265-266 — eligibility
eq(servicePaymentLifecycle.payoutStatus, "pending"),
ne(servicePaymentLifecycle.ownerTransferStatus, "frozen"), // 'completed' passes
```

- **What is wrong:** The `favor_renter` outcome closes the lifecycle but never changes the booking, which stays `'accepted'`. `completeBooking` resets `payoutStatus` to `'pending'` unconditionally, even though it is already `'pending'` from accept, so the reset only ever re-arms. Payout eligibility ignores resolved disputes and does not require `ownerTransferStatus='pending'`. `providerPayout` stays at 80% of the service price.
- **Exploit scenario:** A $1,000 flat service is charged at $1,031.21. The requester files `provider_no_show`, which is only allowed while the booking is `'accepted'` (`dispute-creation-service.ts:329-337`). Admin resolves `favor_renter`, which refunds $1,031.21. The provider taps "Mark complete". The next daily run transfers $800 using `service-transfer-{bookingId}`, the first use of that key. Two colluding accounts turn this into a cash-out: the attacker nets +$800 and the platform loses $800 plus the unrecovered ~$30 Stripe fee.
- **Mitigating layers checked:**
  - The requester cannot cancel after the dispute, because any non-closed dispute counts as active (`booking-cancellation.ts:76-83`).
  - The dispute-after-payout guard does not apply here.
  - Stripe's per-source transfer cap does not bind, because only one transfer is made.
- **Real-world impact:** The provider is paid on a fully refunded booking. This is a double spend of up to 80% of the service price.
- **Recommended fix:** Drop the `updatePayoutStatus('pending')` in `completeBooking`, or make it a compare-and-swap that only sets `'pending'` from `'pending'`. In `resolveServiceBookingDispute(favor_renter)`, move the booking to a terminal status. In `findEligibleForPayout`, require `ownerTransferStatus = 'pending'`.
- **Tests needed:** favor_renter on an accepted booking, then complete, leaves the lifecycle `'completed'`. A DAL test asserts eligibility excludes rows with `ownerTransferStatus='completed'`.
- **Related:** plan 011 (the complete/cancel CAS) doesn't cover the dispute-resolution path.

### BIZ-04: A captured security deposit is never transferred to the owner

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** BIZ-06
**Remediation plan:** [R-BIZ-04](remediations/R-BIZ-04-transfer-captured-deposits.md)

> **Adversarial review (lead auditor):** Verified: nothing transfers a captured deposit (no code path moves the captured amount), and the payout transfers `ownerPayout` only (`src/features/rentals/services/payment-lifecycle-service.ts:141`). Graded HIGH as a systematic money-flow gap against `specs/payments/phase3/1-requirements.md` Req 10.1/10.3/10.4 and policy §4 - not an exploit: the platform silently keeps money owed to owners.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `src/features/disputes/services/dispute-resolution-service.ts:177-186, 537-546`; `src/features/rentals/services/payment-lifecycle-service.ts:135-143`; `src/dal/payment-lifecycle.dal.ts:372`
- **Affected routes:** `POST /api/disputes/[id]/resolve` (`favor_provider`, `partial_*`), cron `process-payouts`
- **Relevant code:** `ownerPayoutAmount: Number(rental.ownerPayout),` (`payment-lifecycle-service.ts:141`) is the only amount the payout transfers.
- **What is wrong:**
  - Resolution captures the hold onto the platform and unfreezes the payout. No code moves the captured amount to the owner, and `StripeDisputeService` has no production caller.
  - This violates `specs/payments/phase3/1-requirements.md` Req 10.1/10.3/10.4 ("owner transfer SHALL include … the captured deposit amount") and policy §4 ("Rental amount + captured deposit minus platform fee").
- **Exploit / failure scenario:** Any damage dispute resolved in the owner's favour while the deposit is `held`.
- **Mitigating layers checked:** None. The lifecycle shows `captured` + `completed`, which looks healthy.
- **Real-world impact:** Owners never receive damage compensation; the money stays with the platform.
- **Recommended fix:** After capture, transfer the captured amount minus the fee, using key `deposit-transfer-{disputeId}` and `source_transaction` = deposit charge.
- **Tests needed:** A `favor_provider` or partial resolution produces a transfer equal to the captured amount.
- **Related:** BIZ-05

### BIZ-05: Resolving a dispute through PATCH /api/disputes/[id]/state skips all money operations; the rental payout cron then marks the payout completed without paying the owner

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** PAY-06, BIZ-09, DB-03
**Remediation plan:** [R-BIZ-05](remediations/R-BIZ-05-dispute-resolve-via-state-route.md)

> **Adversarial review (lead auditor):** Upgraded from MEDIUM (payments and business-logic auditors) to HIGH, matching the database auditor. Verified the UI affordance: `src/features/disputes/components/admin-state-controls.tsx:166-171` renders a plain 'Resolve' button that calls the state route, on the same page (`dispute-details.tsx:530`) as the real resolution flow (`use-resolve-dispute` → `/resolve`). Every use silently strands an owner payout, releases a held deposit with no decision, and the cron records the payout `completed`.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `src/features/disputes/components/admin-state-controls.tsx:168`; `src/app/api/disputes/[id]/state/route.ts:85-90`; `src/features/disputes/lib/state-machine.ts:7-13,28`; `payment-lifecycle-service.ts:62-95,175-179`; `src/dal/payment-lifecycle.dal.ts:390-397`; `service-payment-lifecycle.dal.ts:266`
- **Affected routes:** `PATCH /api/disputes/[id]/state` (admin, `newState:'resolved'`) → cron `process-payouts`
- **Relevant code:**

```ts
if (rental.lifecycle.ownerTransferStatus === "pending") {
  /* transfer */
} // :95 — 'frozen' skips
await paymentLifecycleDAL.updatePayoutStatus(rental.rentalId, "completed"); // :176 "Both operations succeeded"
```

- **What is wrong:** The admin UI's "Resolve" button calls the state route. That route only sets the dispute status: it does not unfreeze and makes no deposit decision. Rental eligibility excludes only open, evidence-requested and under-review disputes, and does not filter `'frozen'`. The cron therefore claims the row, releases a `'held'` deposit, skips the transfer, and sets `payoutStatus='completed'`. `'resolved'` is final, so `/resolve` refuses to redo it, and the reset tools can't touch `'completed'`.
- **Failure scenario:** On a rental with a damage dispute, the admin clicks "Resolve" in the state panel. The next run releases the $200 hold with no capture, and the $240 owner payout is never sent, while the lifecycle reads `completed`. On services, frozen rows are simply excluded forever. Neither path raises an alert.
- **Mitigating layers checked:** `DisputeResolutionService` handles this correctly, but the state route bypasses it.
- **Real-world impact:** Silent owner non-payment and loss of the deposit decision.
- **Recommended fix:** Disallow `'resolved'` on PATCH state and route resolution through `DisputeResolutionService`. In `processPayouts`, treat `ownerTransferStatus ≠ 'pending'` as failed plus an alert, never as `'completed'`. Add `ne(frozen)` to rental eligibility, as the service side has.
- **Tests needed:** Resolve via the state route, then run the cron: payout is not `'completed'` and an alert fires.
- **Related:** Known follow-up on the state route's party check (a different defect).

### BIZ-06: Chargeback webhooks cannot create their auto-dispute (created_by='system' violates the user FK), so payouts are never frozen and ops is never alerted

**Severity:** HIGH · **Confidence:** Medium · **Auditor source(s):** DB-04
**Remediation plan:** [R-BIZ-06](remediations/R-BIZ-06-chargeback-system-user-fk.md)

> **Adversarial review (lead auditor):** Found independently by the lead auditor and the database auditor. Verified: `disputes.created_by` is `text NOT NULL` with an FK to `user.id` (`src/db/schemas/disputes.schema.ts:42-44`; `src/db/migrations/0016_wild_tigra.sql:62,89`), and `src/services/stripe/chargeback-service.ts:102` (service branch) and `:178` (rental branch) insert `createdBy: "system"`. No migration or seed creates a `system` user. If production has none, every chargeback without a prior in-app dispute throws before `freezeForDispute` and before the ops alert; the webhook returns 500 and Stripe retries for up to 3 days. Confidence is Medium only because production data can't be inspected from the repo.

- _Auditor's original grading:_ HIGH | **Confidence:** Medium. Verified in the repo; prod might contain a `system` user (Open question 1).
- **Files:** `src/services/stripe/chargeback-service.ts:99-107,125,176-183,201`; `disputes.schema.ts:42-44,67`
- **Affected routes:** POST `/api/stripe/webhooks` (`charge.dispute.created`)
- **Relevant code:**

```ts
const autoDispute = await disputeDAL.create({ rentalId, createdBy: "system", createdByRole: "renter", … // :176-178
createdBy: text("created_by").references(() => user.id, { onDelete: "cascade" }).notNull(),         // schema:42-44
```

- **What is wrong:**
  - No migration, seed or code creates a `system` user, so the insert fails before the freeze at lines 125 and 201.
  - `disputes_rental_id_unique` is a full index, not a partial one. Because closed disputes are not "active", a chargeback on a rental with a closed dispute always hits 23505 as well.
- **Exploit / failure scenario:**
  1. A bank chargeback arrives on a rental or booking with no internal dispute.
  2. The handler returns 500, and every Stripe retry (about 3 days) fails the same way.
  3. No dispute is linked, so `submitEvidence` is unusable.
  4. There is no ops alert and no freeze, so the cron pays the owner or provider.
- **Mitigating layers checked:** A `webhook.failed` audit row, Sentry, and Stripe's own emails. The tests mock the DAL.
- **Real-world impact:** The platform absorbs chargebacks it could have held back from payouts. Service bookings accepted well ahead of the service date are the most exposed.
- **Recommended fix:**
  - Make `created_by` nullable and add a `source` column, or seed a system user in a migration.
  - Link or reopen a closed dispute instead of creating a new one.
  - Freeze idempotently before inserting.
- **Tests needed:** An e2e test with real FKs covering both the rental and service paths.
- **Related:** The DrizzleQueryError note in the Summary.

### BIZ-07: Self-deleted (anonymized) users can still be charged: their pending requests stay approvable and their cards are never detached

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** DB-05
**Remediation plan:** [R-BIZ-07](remediations/R-BIZ-07-stop-charging-deleted-users.md)

> **Adversarial review (lead auditor):** Verified: `user_payment_methods` has no writer outside seeds, so the deletion flow's detach list (`src/dal/account-deletion.dal.ts:285-288`) is always empty and cards stay attached to the retained Stripe customer; the user's outbound pending requests are deliberately not deletion blockers and are not cancelled; approve/accept never read `anonymizedAt` or `status`.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `account-deletion.dal.ts:285-288,293-351`; `account-deletion-service.ts:96-100,113-126`; `payment-method.ts:78-108`; `rental-service.ts:395-420`; `service-booking-service.ts:311-337`
- **Affected routes:** self-delete, followed by rental approve or service accept
- **Relevant code:**

```ts
.select({ stripeId: userPaymentMethods.stripePaymentMethodId }).from(userPaymentMethods) // :285-288 — only PM source to detach
// payment-method.ts:80: "the local userPaymentMethods table is not the source of truth"
```

- **What is wrong:**
  - `user_payment_methods` is written only by `src/db/seeds/users.seed.ts`, so the list of cards to detach is empty. `stripe_customer_id` is kept, so every card stays attached.
  - `anonymizeUser` leaves the user's pending rental requests and bookings in place.
  - Approve and accept never read `anonymized_at` or `status`. No code reads `anonymizedAt`, and suspended users get the same treatment.
- **Exploit / failure scenario:**
  1. A user deletes their account while a request is still pending.
  2. The owner approves within 72h.
  3. The charge succeeds.
  4. A rental now exists for "Deleted User", who can't log in to cancel.
- **Mitigating layers checked:** None. The comment at `account-deletion-service.ts:96-100` claims the card becomes unusable, which is false.
- **Real-world impact:** Users are charged after deleting their account. This is a consumer-protection and App Store problem.
- **Recommended fix:**
  - Inside the anonymize transaction, cancel pending `rental_requests` where the user is the renter and they are not processing.
  - In the same transaction, cancel pending `service_bookings` where the user is the requester and `payment_status IS NULL`.
  - Detach every card from `stripe.paymentMethods.list({customer})`.
  - Add `EXISTS(… anonymized_at IS NULL AND status='active')` to the approve and accept claims.
- **Tests needed:** Deletion cancels the user's pending requests; approval of an anonymized renter's request is refused.
- **Related:** BIZ-01

### BIZ-08: Listing and party eligibility (listing status, archive, approval, community visibility, account status) is not enforced at booking, approval or accept time

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** BIZ-08

> **Adversarial review (lead auditor):** Kept MEDIUM. The lead confirmed `quoteRentalRequest` has no listing status/approval/visibility check (`src/features/rentals/services/rental-quote.ts:94-95`). This is what lets PRIV-01's harvest target any listing id.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `rental-quote.ts:94-95, 110-116`; `src/dal/listing.dal.ts:318-319`; `src/features/services/services/service-booking-quote.ts:100-103`; `service-booking-service.ts:272-281`; `src/features/auth/utils/guards.ts:6-12`
- **Affected routes:** `POST /api/rentals`, rental approve, service accept
- **Relevant code:** `if (!listing) throw new NotFoundError("Listing", input.listingId);` (`rental-quote.ts:95`) is the only listing gate.
- **What is wrong:**
  - No check of listing `status` (maintenance/inactive), `isActive` (archived), `approvalStatus` (pending_review/rejected) or community visibility. The detail route enforces visibility (`src/app/api/listings/[listingId]/route.ts:91-105`), but booking doesn't.
  - Nothing is re-checked at approval or accept.
  - Services check listing `active` only at create.
  - No booking route checks `user.status`; `requireActiveUser` has no API caller.
  - This contradicts Appendix C ("only approved content is public; Visibility … fail-closed").
- **Exploit / failure scenario:** Anyone with a listing ID can request an archived, rejected, unmoderated or out-of-community listing, and the owner can approve it.
- **Mitigating layers checked:** Only the UI search filters.
- **Real-world impact:** Moderation and community isolation are bypassed; no direct financial loss.
- **Recommended fix:** Add quote blockers for status ∈ {available, rented}, `isActive`, approved, and two-party visibility. Re-check them at approve and accept.
- **Tests needed:** Each ineligible state is blocked at create and at approve/accept.
- **Related:** SEC-03

### BIZ-09: Service payment_failed bookings never expire and the requester cannot cancel them; the provider can re-charge months later

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** BIZ-10

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `booking-cancellation.ts:68-74`; `src/dal/service-booking.dal.ts:291-297, 326-331`; `service-booking-service.ts:279-281, 317-332`
- **Affected routes:** `POST /api/services/bookings/[id]/cancel`, `…/accept`, cron `expire-pending-bookings`
- **Relevant code:** `if (booking.status !== "pending" && booking.status !== "accepted")` (`booking-cancellation.ts:68`). The expiry query only selects `pending` rows with a null `paymentStatus` (`service-booking.dal.ts:293-296`).
- **What is wrong:**
  - A `payment_failed` booking has no expiry and no requester exit.
  - Accept has no date check.
  - The F12 guard only rejects the same card that failed.
- **Exploit / failure scenario:** Months after a failed charge, the requester sets a new default card. The provider retries and charges them for a past date. Cancelling now refunds only 50%.
- **Mitigating layers checked:** The provider can decline; the requester cannot.
- **Real-world impact:** An unconsented charge that the requester can only partly recover.
- **Recommended fix:** Let the requester cancel, expire `payment_failed` bookings, and refuse accept after the service instant.
- **Tests needed:** The requester can cancel a `payment_failed` booking; accepting after the date returns 409.
- **Related:** BIZ-10

### BIZ-10: Requests and bookings can be approved/accepted after the booked start, charging for elapsed time

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** BIZ-11

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. No spec says approval must precede the start; the grading rests on the refund-tier consequence.
- **Files:** `src/dal/rentals.dal.ts:616-618`; `rental-service.ts:376-464, 636-640`; `src/features/rentals/services/refund-calculations.ts:19-43`; `service-booking-service.ts:267-356`
- **Affected routes:** rental approve, service accept
- **Relevant code:** `expiresAt` = now + `PENDING_BOOKING_EXPIRY_WINDOW_HOURS` (`rentals.dal.ts:616-618`). Approve and accept never compare against the start.
- **What is wrong:**
  - Expiry ignores the start date.
  - `hoursUntilPickup <= 48` includes negative values, so the hold is placed immediately.
  - A cancellation then lands in the 50% tier, and rental disputes never refund the charge.
- **Exploit / failure scenario:** A 1-day rental for tomorrow is approved two days later. The renter is charged 100% for a day that has passed, and cancelling refunds 50%.
- **Mitigating layers checked:** None.
- **Real-world impact:** Customers pay for periods they couldn't use.
- **Recommended fix:** Set `expiresAt = min(created+72h, start of booked day)`, and reject approve/accept after the start.
- **Tests needed:** Approve after the start day returns 409.
- **Related:** BIZ-01, BIZ-09

### BIZ-11: Indeterminate Stripe failures are recorded as declines and retried under new idempotency keys (possible double charge); payout re-drives after 24h or after admin resets can repeat a succeeded transfer

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** PAY-07, RACE-07, BIZ-13

> **Adversarial review (lead auditor):** Kept MEDIUM. Stripe's documented cumulative cap on `source_transaction` transfers (sum ≤ charge) bounds the transfer variant (a second full 80% transfer is rejected); the double-charge variant has no such cap.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. Stripe replays 5xx responses for the same key (`node_modules/stripe/cjs/RequestSender.js:183-187`), and results that land in this state are rare.
- **Files:** `rental-service.ts:476-478,509-514,569-574`; `service-booking-service.ts:358-364,383-405`; `src/services/stripe/webhook-handlers.ts:139-167`; `payout.ts:26-30`; `payment-lifecycle-admin-service.ts:117-121`
- **Affected routes:** `/api/rentals/[id]/approve`, `/api/services/bookings/[id]/accept`, admin reset-transfer-status
- **Relevant code:**

```ts
const idempotencyKey = isRetryAfterFailure
  ? `rental-charge-${rentalRequest.id}-retry-${Date.now()}`
  : `rental-charge-${rentalRequest.id}`; // :476-478
```

- **What is wrong:** Several responses all set `paymentStatus='failed'` and notify "payment failed":
  - any error left after the SDK's 2 retries and the app's 1 retry (Stripe 5xx or connection error);
  - any PaymentIntent that isn't `succeeded`, such as `processing`.

  The next approve builds a new key and therefore a new PaymentIntent. The service path behaves the same, except the card-scoped key forces a new card. If the first attempt actually succeeded, the webhook finds no payment row and writes only an audit row, which by design is not an ops alert (`:139-167`). On transfers, any error marks the transfer `'failed'`, and admin reset bumps `retryCount`, which produces a new key.

- **Failure scenario:** Stripe returns 500 on the $309.53 charge but the charge actually went through. The owner re-approves after the renter "updates their card", and the renter is charged a second $309.53. The orphaned charge raises no alert.
- **Mitigating layers checked:**
  - Claims block concurrent double charges.
  - Retries with the same key replay the original result.
  - For transfers, a second 80% transfer is probably blocked by Stripe's per-source cap (unverified, Open question 2).
- **Real-world impact:** A rare double charge that can go unnoticed.
- **Recommended fix:** Separate card errors (402) from indeterminate errors. On indeterminate errors, keep the claim (the stale detector will surface it) and reconcile with `paymentIntents.search` on metadata before re-arming. Ops-alert unmatched succeeded `rental_charge`/`service_charge` PaymentIntents after a grace period. Before reset-transfer, look up existing transfers for the rental (via `transfer_group` or metadata).
- **Tests needed:** A 5xx from `chargeRentalPayment` leaves the request in `'processing'`. An unmatched succeeded PI sends an alert.
- **Related:** plans 005 and 009.

### BIZ-12: Rental approval swallows failures to write the payment row and the payment-lifecycle row after the charge (owner never paid; renter can't cancel)

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PAY-08, BIZ-16, DB-08

> **Adversarial review (lead auditor):** Kept MEDIUM (the business-logic auditor had LOW). Sibling of the known 'approveRentalRequest is not a transaction' follow-up.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `rental-service.ts:690-707` (the `createPayment` error is discarded: there is no else branch and nothing is logged), `:762-776` (a lifecycle insert failure only calls `captureNonCriticalError`); `payment-lifecycle.dal.ts:375-378`; `cancellation-service.ts:147-149`
- **Affected routes:** `POST /api/rentals/[id]/approve`
- **What is wrong:** These writes happen after money has moved. A missing lifecycle row means the rental is never payout-eligible (the cron's query inner-joins it) and cancellation fails with "Missing payment or charge data". A missing payment row blocks cancellation, makes chargebacks unlinkable so nothing freezes, and leaves the charge out of history. No stale detector covers either case. The service accept wraps the same writes in "Region B", which alerts ops and keeps the claim.
- **Failure scenario:** A transient Neon error hits the lifecycle insert. The renter is charged $309.53 and the rental runs, but the owner's $240 is never transferred and the only trace is a Sentry "non-critical" event.
- **Mitigating layers checked:** Sentry, for the lifecycle case only.
- **Real-world impact:** The owner goes unpaid and the renter cannot cancel for a refund. Neither self-heals.
- **Recommended fix:** Do the post-charge DB work in one `db.transaction`, or treat it as Region B (ops alert, keep the claim). Add a reconciliation query for rentals that have a `rentalPaymentIntentId` but no lifecycle or payment row.
- **Tests needed:** A failing `createPayment` or lifecycle insert produces an ops alert and leaves the claim held.
- **Related:** Known: plans/README.md follow-up "approveRentalRequest is not a transaction", which covers the rentals-row insert. These sibling writes are not covered by it.

### BIZ-13: A chargeback after payout overwrites the completed transfer status with 'frozen' and nothing claws the money back

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PAY-09

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `src/services/stripe/chargeback-service.ts:125,201,203-215`; `payment-lifecycle.dal.ts:552-560`; `service-payment-lifecycle.dal.ts:315-323`; `dispute-resolution-service.ts:218`
- **Affected routes:** `POST /api/stripe/webhooks` (`charge.dispute.created`)
- **What is wrong:** Payouts go out 24-48h after completion, while chargebacks arrive weeks later, so the "freeze owner payout" step is a no-op in practice. It unconditionally overwrites `ownerTransferStatus='completed'` with `'frozen'`, and resolution later sets it to `'pending'` for an owner who has already been paid. Earnings and dispute screens then show the payout as "on hold". The ops alert never says the funds already left, and the codebase has no reversal logic.
- **Failure scenario:** On the $309.53 rental, a chargeback arrives after the $240 transfer. The platform absorbs $309.53 plus the $15 fee, and the lifecycle state is wrong from then on.
- **Mitigating layers checked:** An ops alert does fire (`:203-215`).
- **Real-world impact:** Systematic loss of the chargeback amount, plus corrupted payout state.
- **Recommended fix:** Skip the freeze when the transfer is already `'completed'`. Alert with the `stripeTransferId` and suggest `transfers.createReversal`, or auto-reverse according to policy.
- **Tests needed:** A chargeback on a paid-out rental leaves `ownerTransferStatus='completed'` and sends an alert that includes the transfer ID.
- **Related:** —

### BIZ-14: Webhook state-handling gaps (partial refunds recorded as full, out-of-order events, dead deposit-cancel handler, no refund.failed handling)

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PAY-10

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Files:** `payment.dal.ts:509-518`; `webhook-handlers.ts:170-174,212-215,232,290-299`; `deposit-hold.ts:41-51`
- **Affected routes:** `POST /api/stripe/webhooks`
- **What is wrong:**
  - `recordRefund` always sets `'refunded'`, and `charge.refunded` records the cumulative amount once and ignores later events, so partial refunds look like full ones (`cancellation-service.ts:150` then treats them as done).
  - `payment_intent.succeeded` sets `'succeeded'` from any other status, so a delayed or retried event flips `'refunded'` back.
  - The deposit `payment_intent.canceled` handler keys on `metadata.rentalId`, which `placeDepositHold` never sets, so that handler is dead and only the daily monitor detects expiry.
  - There is no handler for `refund.failed` / `charge.refund.updated`, and `transfer.reversed` maps rental lifecycles only.
- **Real-world impact:** Wrong refund and payment statuses, and silent async refund failures.
- **Recommended fix:** Only transition to `'succeeded'` from `'pending'`/`'failed'`. Store refunded cents and add a `partially_refunded` status. Put `rentalId` in the deposit metadata. Alert on `refund.failed`.
- **Tests needed:** An out-of-order succeeded event after a refund is a no-op. A partial refund is not marked full.
- **Related:** plan 003.

### BIZ-15: A free-form service proposedTime forces the generous full-refund tier

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** BIZ-14

> **Adversarial review (lead auditor):** Kept LOW.

- **Confidence:** High
- **Files:** `src/features/services/lib/service-api-schemas.ts:43`; `src/lib/wall-clock-zone.ts:93-94`; `booking-cancellation.ts:174-176`
- **Affected routes:** service create, then cancel
- **Relevant code:** `proposedTime: z.string().min(1).max(32)`
- **What is wrong:** A time that isn't `HH:MM` makes `serviceInstant` return null. The booking then always gets `full_refund_24h` (fee included), even after the job, and the filing deadline becomes an Invalid Date.
- **Exploit / failure scenario:** A raw API call with `"9am"`, then a late cancel.
- **Mitigating layers checked:** Clients send `HH:MM`.
- **Real-world impact:** The provider loses their 30% late-cancel share; bounded to one booking.
- **Recommended fix:** Validate `^\d{2}:\d{2}$`.
- **Tests needed:** A bad time returns 400.
- **Related:** BIZ-16

### BIZ-16: The service late-cancel refund base (50% of service price) differs from the published policy (50% of total)

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** BIZ-15

> **Adversarial review (lead auditor):** Kept LOW.

- **Confidence:** High
- **Files:** `booking-cancellation.ts:230-237`; `specs/cancellation-refund-policy.html` §2.3
- **Affected routes:** service cancel and cancellation preview
- **Relevant code:** `const refundCents = Math.round(servicePriceCents * 0.5);`
- **What is wrong:** The policy says "50% refund of total booking amount"; the code refunds 50% of the service price and keeps the fee.
- **Exploit / failure scenario:** None.
- **Mitigating layers checked:** The preview shows the code's figure.
- **Real-world impact:** An under-refund of half the fee (about $0.15 to $2) against a legal document.
- **Recommended fix:** Align the code or the policy.
- **Tests needed:** Pin the refund base.
- **Related:** BIZ-15

### BIZ-17: Evidence-deadline notifications are never sent and open disputes have no evidence deadline

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** BIZ-17

> **Adversarial review (lead auditor):** Kept LOW.

- **Confidence:** High
- **Files:** `src/features/disputes/lib/deadline-enforcement.ts:9`; `src/dal/dispute.dal.ts:1183-1188`
- **Affected routes:** `POST /api/disputes/[id]/evidence`
- **Relevant code:** A deadline applies only in `evidence_requested` and `under_review`.
- **What is wrong:** `DeadlineEnforcementService` has no production caller or cron. This violates phase 3 Req 118/196/280.
- **Exploit / failure scenario:** None.
- **Mitigating layers checked:** None.
- **Real-world impact:** Parties miss deadlines, and evidence in `open` is unbounded.
- **Recommended fix:** Add a cron, and enforce the deadline in `open`.
- **Tests needed:** Notifications fire at T-24h and at expiry.
- **Related:** BIZ-18

### BIZ-18: State-machine quirks that cause drift (closed unreachable, overdue never written, freeze overwrites completed, markCancelled overwrites deposit status, hold metadata lacks rentalId)

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** BIZ-18

> **Adversarial review (lead auditor):** Kept LOW (these enable BIZ-03 and BIZ-05).

- **Confidence:** High
- **Files:** `state-machine.ts:11, 28, 61-66`; `src/dal/dispute.dal.ts:174, 220`; `src/dal/payment-lifecycle.dal.ts:553-560`; `cancellation-service.ts:251-256`; `services/stripe/deposit-hold.ts:45-50`; `services/stripe/webhook-handlers.ts:212-215`; `src/dal/rentals.dal.ts:1834-1843`
- **Affected routes:** dispute state, cancel, webhooks
- **Relevant code:** `resolved: ["closed"]` is blocked by `FINAL_STATES`.
- **What is wrong:**
  - `closed` is unreachable, so the "active dispute" check (≠ closed) blocks service cancellation forever after any dispute.
  - `overdue` has no writer, and would be a dead end if something wrote it.
  - The freeze overwrites a `completed` transfer.
  - `markCancelled` writes `released` over `not_applicable`/`failed`.
  - The hold's PI metadata lacks `rentalId`, so the `payment_intent.canceled` handler does nothing.
  - A renter's pending-cancel writes the denial fields.
- **Exploit / failure scenario:** None directly; these enable BIZ-03 and BIZ-05.
- **Mitigating layers checked:** None.
- **Real-world impact:** Wrong dashboards and wrong eligibility decisions.
- **Recommended fix:** Allow `resolved → closed`, add `rentalId` to the metadata, make the freeze a CAS, and write the cancellation fields.
- **Tests needed:** A transition-table test.
- **Related:** BIZ-03, BIZ-05

## Money-flow map (payments auditor)

Charge model: **separate charges and transfers**. Express accounts (`src/services/stripe/connect.ts:40-47`). Charges have no `transfer_data` and no `application_fee_amount`. The codebase never calls `transfers.createReversal`, so every refund or chargeback after a payout is paid from the platform balance. Amounts are converted with `Math.round(x*100)`, and currency is hard-coded `usd`. stripe-node 22.2 pins API `2026-05-27.dahlia` by default (`node_modules/stripe/cjs/apiVersion.js`), so the `server.ts:12-16` comment ("account default version") is inaccurate. Payout, service-payout and deposit-expiry crons run **daily** at 10:00 UTC (`.github/workflows/cron-jobs.yml:6,54,60,66`), not hourly as the spec says.

| Money movement                            | Call site                                                                                                                                           | Idempotency key                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Rental charge (off-session, auto-capture) | `features/rentals/services/rental-service.ts:476-489` → `services/stripe/rental-payments.ts:37-53`                                                  | `rental-charge-{requestId}`; after a failure `…-retry-{Date.now()}`                     |
| Deposit hold at approval (manual capture) | `rental-service.ts:640-653` → `services/stripe/deposit-hold.ts:38-51`                                                                               | `deposit-hold-{requestId}`                                                              |
| Deposit hold, cron / renter retry         | `features/rentals/services/payment-lifecycle-service.ts:286-297` / `:560-574`                                                                       | `deposit-hold-{rentalId}` / `deposit-hold-{rentalId}-{pmId}`                            |
| Deposit release (PI cancel)               | `payment-lifecycle-service.ts:66`, `cancellation-service.ts:183,399`, `dispute-resolution-service.ts:599`, `payment-lifecycle-admin-service.ts:170` | none (state-idempotent)                                                                 |
| Deposit capture (admin dispute)           | `features/disputes/services/dispute-resolution-service.ts:537-544`                                                                                  | `deposit-capture-{disputeId}`                                                           |
| Owner transfer, cron                      | `payment-lifecycle-service.ts:135-143` → `services/stripe/payout.ts:26-45`                                                                          | `transfer-owner-{rentalId}` (`-retry-{n}` after admin reset)                            |
| Owner transfer, cancel / no-show          | `cancellation-service.ts:210-217,430-437`                                                                                                           | `transfer-owner-{rentalId}` (same key as the cron)                                      |
| Rental refund                             | `services/stripe/refund.ts:41-58`                                                                                                                   | `refund-rental-{rentalId}-{chargeId}-{cents}`                                           |
| Service charge                            | `features/services/services/service-booking-service.ts:358-382` → `service-payments.ts:135-148`                                                     | `service-charge-{bookingId}` / `-retry-{pmId}`                                          |
| Service refund / cancel transfer          | `service-booking-service.ts:780-786` / `:816-822`                                                                                                   | `refund-service-{bookingId}-{chargeId}-{cents}` / `service-cancel-transfer-{bookingId}` |
| Service payout transfer                   | `service-payment-lifecycle-service.ts:65-71`                                                                                                        | `service-transfer-{bookingId}`                                                          |
| Service dispute refund                    | `dispute-resolution-service.ts:472-477`                                                                                                             | `service-refund-{disputeId}[-partial]`                                                  |

## Verified clean — business logic (business-logic auditor)

- **Self-dealing is blocked:**
  - Renting your own listing (`rental-quote.ts:111-116`) or booking your own service (`service-booking-quote.ts:108-113`).
  - Self-review; the reviewee is derived server-side (`blind-review-service.ts:47-63`).
  - Disputes are party-only (`dispute-creation-service.ts:157-163, 315-321`).
- **Money is server-side except SEC-03:**
  - Rental prices come from the listing, and preview and create share one code path (`rental-quote.ts:160-178`).
  - Approve charges the stored total and deposit (`rental-service.ts:441, 629`), so an owner price edit after the request changes nothing.
  - Service price comes from the listing (`service-booking-quote.ts:142-148`); the stored total is charged (`service-booking-service.ts:373`); the provider payout is snapshotted (`:483-494`).
- **No double charge:** CAS claims (`rentals.dal.ts:1884-1902`; `service-booking.dal.ts:241-261`) plus deterministic idempotency keys. A payment method in the body can't charge another user: charges pass the payer's own customer (`services/stripe/rental-payments.ts:37-43`).
- **Service transitions are CAS-first:** cancel and complete (`service-booking-service.ts:664-676, 757-772`). Expiry skips claimed rows (`rentals.dal.ts:1790-1795`; `service-booking.dal.ts:326-331`).
- **Refunds are bounded:**
  - Stripe caps a refund at the charge amount.
  - Rental resolutions touch only the deposit, so there is no double refund.
  - Partial capture is limited to the deposit (`dispute-resolution-service.ts:137-150`), and a service partial is limited to the provider payout (`:300-312`).
  - Service disputes are allowed only on accepted or completed bookings (`dispute-creation-service.ts:308-313`), and cancel is blocked during a dispute.
- **Payout gating holds apart from BIZ-02, BIZ-03 and BIZ-05:**
  - The rental filing window closes (`dispute.dal.ts:939-950`) exactly when payout opens (`payment-lifecycle.dal.ts:392-395`); the service windows line up the same way (`time-window-validation.ts:205-214`; `service-payment-lifecycle.dal.ts:262-268`).
  - Open disputes are excluded from payout.
  - A service dispute is refused after payout (`dispute-creation-service.ts:408-423`).
  - There is no race between filing and payout.
- **One dispute per booking:** unique indexes (`src/db/schemas/disputes.schema.ts:67-70`).
- **Reviews:** completed bookings only, within the window, rating an integer 1–5, and one per reviewer (`blind-review-service.ts:66-70, 313-325, 359-370`; `src/db/schemas/blind-reviews.schema.ts:49-54`).
- **Needs:** only the owner or an admin can edit, close or delete (`neighborhood-needs-service.ts:93-94, 120-121, 154-156`); links are visibility-checked (`:180-187`).
- **Other gates:**
  - Start is date-gated (`rentals.dal.ts:2789-2797`).
  - Owner/renter-only actions are enforced, and list routes are user-scoped (`:846-851, 947-952`).
  - All crons verify `CRON_SECRET`.
  - Connect readiness is checked at approve/accept (`rental-service.ts:436-439`; `service-booking-service.ts:306-309`).
  - The cancellation preview uses the same functions as the action.

## Verified clean — Stripe & payments (payments auditor)

- **Webhook signature:** the handler verifies the raw body with `request.text()` and `constructEvent` (`src/app/api/stripe/webhooks/route.ts:26-47`). The route is not behind proxy auth (`src/proxy.ts:7-16`), and the logging wrapper doesn't consume the body. There is no event-id dedupe, but the handlers are state-idempotent and move no money; duplicates only repeat ops alerts.
- **Webhook metadata:** it is server-set only. The one user-influenced value, the listing name in `rental-payments.ts:44-47`, drives no logic.
- **Connect binding:**
  - Account IDs are read only from the DB (`create-account-link:45-47`, `create-account-session:41-43`, `create-login-link:25-27`).
  - `update-onboarding-status:46-58` re-fetches status from Stripe.
  - The profile and onboarding Zod schemas strip Stripe columns (`profile.schema.ts:43-51`).
  - No route writes `stripeConnectedAccountId`.
- **`assertConnectReady`:** it does a live, fail-closed `accounts.retrieve` before the charge on both paths (`assert-connect-ready.ts:45-57`; `rental-service.ts:436`; `service-booking-service.ts:306`).
- **PaymentMethod ownership:**
  - A client-supplied `paymentMethodId` (`form-schema.ts:19`, service `selectedPaymentMethodId`) can't charge another customer's card, because Stripe requires the PM's customer to match (`PaymentIntents.d.ts:2631,8483`).
  - `set-default` is validated by Stripe.
  - `attach` of another customer's PM fails on Stripe, and detached PMs can't be re-attached.
  - `payment-sheet-params` mints its ephemeral key for the caller's own customer (`:45-74`).
- **History and earnings scoping:** `payments.payerId` / `payeeId = userId` (`payment.dal.ts` `getUserPaymentHistory` / `getUserEarnings`).
- **Service accept:**
  - The claim includes status (`service-booking.dal.ts:241-262`).
  - The retry key is deterministic (`:358-364`).
  - Region B keeps the claim and alerts (`:450-525`).
  - complete and cancel both compare-and-swap (plan 011).
  - Cancel is blocked while any dispute exists (`booking-cancellation.ts:76-83`), and a dispute requires the booking to be accepted or completed. So a dispute refund and a cancellation refund can never both hit one service charge.
  - A service dispute after payout is refused (`dispute-creation-service.ts:408-423`).
- **Refund amounts:**
  - Rental tiers never exceed the charge. The <24h renter tier refunds 50% of the rental price and transfers 30% to the owner.
  - The service <24h tier is refund 50% + provider 30% + platform 20% of the service price.
  - Keys include the amount (`refund.ts:41-44`), and Stripe caps cumulative refunds at the charge amount.
- **Deposit capture:** admin-only, bounded by the deposit amount (`dispute-resolution-service.ts:137-150`) and by Stripe's `amount_capturable`, with key `deposit-capture-{disputeId}`.
- **Deposit hold races:** the cron processes only `scheduled` rows (`payment-lifecycle.dal.ts:437-442`). The renter retry is renter-only and future-only (`payment-lifecycle-service.ts:495-511`).
- **Admin money routes:** `requireAdminResponse` (`reset-payout-status/route.ts:19-20`, `reset-transfer-status:19-20`, `release-deposit:18-19`), audit-logged. `release-deposit` requires `'held'`. `/disputes/[id]/resolve` and `chargeback-evidence` check `isAdmin`.
- **Cron routes:** bearer secret compared with `timingSafeEqual` (`verify-cron-secret.ts:24-33`). Payout claims are atomic (`payment-lifecycle.dal.ts:246-266`, `service-payment-lifecycle.dal.ts:152-172`).
- **Dead code:** `src/services/stripe/dispute-financial.ts` (`StripeDisputeService`: un-keyed refunds, no already-refunded check) has no callers and is unreachable. Delete it.
- **Previously rejected:** the `.toFixed(2)` precision item is not re-reported; there is no new evidence.

## Auditor open questions — business logic

1. The chargeback auto-dispute uses `createdBy: "system"` (`services/stripe/chargeback-service.ts:102, 178`) against the foreign key to `user.id` (`src/db/migrations/0016_wild_tigra.sql:89`), and no migration or seed creates such a user. If the row is missing in prod, the insert fails before the freeze and the ops alert, and the webhook retries. Verify prod data.
2. Does Stripe allow a `source_transaction` transfer against a fully refunded charge? This sets the size of BIZ-03.
3. No booking route enforces `user.status`. Is a user's session revoked on suspension? (Auth area.)
4. The payout crons run daily (`cron-jobs.yml`, `0 10 * * *`), but the policy, Appendix C and the architecture doc say hourly.
5. A requester can cancel an accepted service after the job has happened (before completion) and get 50% back; there is no in-progress state. Intended?
6. If a provider never completes, the funds are held indefinitely; auto-complete is deferred.
7. Policy §4 says failed holds are "retried automatically"; plan 004 made the renter retry the only path.
8. Rental disputes can't refund the rental charge (phase 3 Req 10). Is owner-no-show handling via the admin route intended?
9. The rental 24h refund tier is measured from `start_date` midnight in server UTC, not from a market-zone pickup time.
10. Disputes on cancelled rentals can be filed indefinitely after `startDate` (phase 3 edge case 4). Should there be an upper bound?

## Auditor open questions — Stripe & payments

1. Does Stripe accept a `source_transaction` transfer against a **fully refunded** charge? The answer decides BIZ-03's money outcome.
2. Does Stripe cap **cumulative** `source_transaction` transfers per charge (the "must not exceed the source amount" error)? That cap is the only thing stopping a second full owner transfer after reset-transfer (new key) or reset-payout (the original key is pruned after 24h, and payouts run daily).
3. Webhook configuration: there is a single `STRIPE_WEBHOOK_SECRET`. Express `account.updated` is a Connect event, while `payment_intent.*`, `charge.*` and `transfer.*` are platform events. Which endpoint type is configured in production, and which events are enabled (`charge.refunded`, `charge.dispute.*`, `transfer.reversed`)?
4. Are non-card methods (ACH/Link) enabled for SetupIntents in the Dashboard? A renter-chosen ACH PM (`form-schema.ts:19`) would return `processing`, which gets marked failed and retried (BIZ-11).
5. Captured deposits are never transferred to owners, because payouts move `ownerPayout` only. Is that an intended manual step?
6. The dispute `closed` status is unreachable (`state-machine.ts:11,28`), so a service booking that ever had a dispute can never be cancelled. Is that intended?
7. Holds on rentals longer than 7 days expire (accepted limitation, `specs/payments/0-overview.md` §2). Is that still the plan for mobile?
