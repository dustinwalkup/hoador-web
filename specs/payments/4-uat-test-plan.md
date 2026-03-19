# Stripe Connect Payments — User Acceptance Test (UAT) Plan

Hoador • Internal Specification

---

## 1. Introduction

This document defines **User Acceptance Test (UAT)** scenarios for the full Stripe Connect payments feature described in [specs/payments/0-overview.md](0-overview.md). UAT is run by a business tester or product owner to verify that the system meets acceptance criteria from a user’s perspective and is fit for release.

- **Scope:** All payment behavior in the overview (Sections 1–12) and the Phase Roadmap (Phases 1–4): payment capture, deposit handling, owner payout, return confirmation, cancellation paths, dispute resolution, chargebacks, webhooks and crons, idempotency, fees, operations alerting, edge cases, and Phase 4 operational tooling.
- **Relationship to other test docs:** Phase-level `4-test-plan.md` files cover unit, integration, and technical tests. This UAT plan is complementary: executable, end-to-end scenarios that a non-developer can run and sign off.
- **How to use:** Execute each scenario in the test environment (see Section 10), verify expected results, and mark Pass/Fail. Use the traceability table below to ensure every overview section has coverage.

---

## 2. Traceability: Overview Sections to UAT

| Overview section            | UAT scenario IDs                                 | Phase |
| --------------------------- | ------------------------------------------------ | ----- |
| §1 Payment Capture          | UAT-P1-01 through UAT-P1-06                      | 1     |
| §2 Deposit Handling         | UAT-P1-07 through UAT-P1-18                      | 1     |
| §3 Owner Payout             | UAT-P1-19 through UAT-P1-24                      | 1     |
| §4 Return Confirmation      | UAT-P1-25 through UAT-P1-28                      | 1     |
| §5 Cancellation Paths       | UAT-P2-01 through UAT-P2-12                      | 2     |
| §6 Dispute Resolution       | UAT-P3-01 through UAT-P3-16                      | 3     |
| §7 Webhooks & Cron          | UAT-P1-29 through UAT-P1-36                      | 1, 2  |
| §8 Idempotency              | UAT-P1-37 through UAT-P1-39                      | 1     |
| §9 Fee Structure            | UAT-P1-40 through UAT-P1-42                      | 1     |
| §10 Operations Alerting     | UAT-P1-43 through UAT-P1-47, P2/P3/P4 alert refs | 1–4   |
| §11 Data Model              | Covered indirectly in all scenarios              | —     |
| §12 Edge Cases              | UAT-P1-48 through UAT-P1-52, UAT-P4-20           | 1, 4  |
| Phase 3 Chargebacks         | UAT-P3-17 through UAT-P3-22                      | 3     |
| Phase 4 Operational Tooling | UAT-P4-01 through UAT-P4-20                      | 4     |

---

## 3. UAT Scenarios — §1 Payment Capture

### UAT-P1-01: Rental and deposit charged on owner approval (start within 48h)

- **Phase:** 1
- **Actor:** Owner (trigger), System (capture)
- **Overview:** §1 Payment Capture
- **Preconditions:** Renter has submitted a rental request with valid payment method; listing has security deposit > 0; rental startDate is within 48 hours of now.
- **Steps:**
  1. As owner, open the rental request and approve it.
  2. Confirm in app (or Stripe Dashboard) that a charge was created for the rental amount plus service fee.
  3. Confirm a deposit authorization hold was placed (PaymentIntent with capture_method manual, not captured).
  4. Check admin payment lifecycle (Phase 4) or DB: depositHoldStatus = 'held', rental_charge_id set.
- **Expected results:**
  - Rental request status becomes approved/active per product flow.
  - One charge (rental + service fee) captured; one deposit hold in reserved state.
  - Lifecycle record exists with correct statuses.
- [x] Pass / [ ] Fail

### UAT-P1-02: Deposit scheduled when startDate more than 48 hours away

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §1 Payment Capture, §2 Deposit Handling
- **Preconditions:** Renter submitted request; listing has security deposit > 0; startDate is more than 48 hours from now.
- **Steps:**
  1. As owner, approve the rental request.
  2. Verify rental charge is captured (full amount + service fee).
  3. Verify deposit hold is NOT placed immediately; lifecycle shows depositHoldStatus = 'scheduled'.
  4. (Optional) Run or wait for schedule-deposit-holds cron when within 48h of startDate; verify status becomes 'held'.
- **Expected results:**
  - Charge captured at approval; deposit status 'scheduled' until within 48h window.
- [x+] Pass / [ ] Fail

### UAT-P1-03: Zero security deposit — not_applicable

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §1 Payment Capture, §2 Deposit Handling
- **Preconditions:** Listing has securityDeposit = 0; renter has valid payment method.
- **Steps:**
  1. As owner, approve the rental request.
  2. Verify rental charge is captured.
  3. Verify no deposit PaymentIntent is created; lifecycle shows depositHoldStatus = 'not_applicable'.
- **Expected results:**
  - One charge only; no deposit hold; depositHoldStatus = 'not_applicable'.
- [x] Pass / [ ] Fail

### UAT-P1-04: Duplicate approval does not double-charge (idempotency)

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §1 Payment Capture, §8 Idempotency
- **Preconditions:** Rental request already approved once (charge and deposit exist).
- **Steps:**
  1. Attempt to approve the same rental request again (e.g. duplicate button click or repeated API call).
  2. Check Stripe: only one rental charge and one deposit hold for this rental/request.
  3. Check lifecycle: single record, no duplicate charges.
- **Expected results:**
  - Second approval is rejected or no-op; no second charge or second hold.
- [x] Pass / [ ] Fail

### UAT-P1-05: Renter payment method declined at approval

- **Phase:** 1
- **Actor:** Owner, Renter, System
- **Overview:** §1 Payment Capture, §12 Edge Cases
- **Preconditions:** Renter has a payment method that will decline (e.g. Stripe test card that declines).
- **Steps:**
  1. As owner, attempt to approve the rental request.
  2. Verify approval fails or shows payment failure.
  3. Verify rental request remains pending (or appropriate state); paymentStatus = 'failed' or equivalent.
  4. Verify renter is notified of payment failure.
- **Expected results:**
  - No charge captured; renter notified; request not approved.
- [x] Pass / [ ] Fail

### UAT-P1-06: Retry on retryable Stripe error (rate limit / API error)

- **Phase:** 1
- **Actor:** System
- **Overview:** §1 Payment Capture
- **Preconditions:** Ability to simulate Stripe rate limit or transient API error (e.g. test hook or mock).
- **Steps:**
  1. Trigger approval with a retryable Stripe error on first call.
  2. Verify system retries once after delay (e.g. 1 second).
  3. If second call succeeds, verify charge and deposit are created.
- **Expected results:**
  - One retry occurs; no duplicate charge if retry succeeds.
- [x] Pass / [ ] Fail

---

## 4. UAT Scenarios — §2 Deposit Handling

### UAT-P1-07: Deposit hold placed immediately when startDate ≤ 48h

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §2 Deposit Handling
- **Preconditions:** Rental request with startDate within 48 hours; listing has deposit > 0.
- **Steps:**
  1. Approve the request.
  2. Verify depositHoldStatus = 'held' and deposit_hold_placed_at is set immediately (no cron wait).
- **Expected results:**
  - Hold placed at approval time when within 48h.
- [x] Pass / [ ] Fail

### UAT-P1-08: Deposit hold failure — rental proceeds, both parties notified

- **Phase:** 1
- **Actor:** Owner, Renter, System
- **Overview:** §2 Deposit Handling
- **Preconditions:** Renter payment method that causes deposit hold to fail (e.g. insufficient funds for hold), or simulated failure.
- **Steps:**
  1. Approve the rental request.
  2. Verify rental is still approved and proceeds (not cancelled).
  3. Verify depositHoldStatus = 'failed'.
  4. Verify renter receives message to update payment method; owner receives message that rental proceeds without deposit protection.
  5. Verify only one notification per party (no duplicate alerts).
- **Expected results:**
  - Rental proceeds; deposit 'failed'; both notified once.
- [x] Pass / [ ] Fail

**How to simulate (recommended):** The rental charge is captured before the deposit hold; a single Stripe test card cannot succeed for the charge and then fail only for the hold. Use the app’s UAT simulation instead:

1. **Environment:** In your test environment (e.g. `.env.local` or staging), set:
   ```bash
   UAT_SIMULATE_DEPOSIT_HOLD_FAILURE=1
   ```
2. **Restart** the app so the env is picked up.
3. **Data:** Create (or use) a rental request where:
   - Listing has **security deposit > 0**.
   - **Start date is within 48 hours** of now (so the deposit hold is attempted immediately at approval, not scheduled for cron).
   - Renter has a **valid** payment method (e.g. Stripe test card `4242 4242 4242 4242`) so the rental charge succeeds.
4. **Execute:** As owner, approve the rental request. The rental charge will succeed; the deposit hold will be forced to fail by the simulator.
5. **Verify:**
   - Rental is approved and active (not cancelled).
   - In DB or admin lifecycle: `depositHoldStatus = 'failed'`.
   - Renter has one notification: "Security Deposit Hold Failed" with link to update payment method (`/dashboard/profile/payments`).
   - Owner has one notification: "Deposit Hold Not Placed" — rental proceeds without deposit protection.
   - No duplicate notifications for either party.
6. **Cleanup:** Unset `UAT_SIMULATE_DEPOSIT_HOLD_FAILURE` (or set to `0`) and restart before other UAT or production use.

### UAT-P1-09: Renter retries deposit hold from rental detail page

- **Phase:** 1
- **Actor:** Renter, System
- **Overview:** §2 Deposit Handling
- **Preconditions:** Rental with depositHoldStatus = 'failed'; rental startDate has not yet passed; renter has a valid payment method on file.
- **Steps:**
  1. As renter, navigate to the rental detail page.
  2. Verify the "Retry Deposit Hold" button is visible (shown only when depositHoldStatus = 'failed' and startDate > now).
  3. Click "Retry Deposit Hold".
  4. Verify the deposit hold is placed immediately (no cron required); depositHoldStatus = 'held' and depositHoldPlacedAt is set.
  5. Verify the button is no longer shown after success.
- **Expected results:**
  - Deposit hold placed directly on retry; status moves to 'held' without waiting for cron.
- [x] Pass / [ ] Fail

### UAT-P1-10: Deposit hold retry fails — error shown to renter, no duplicate notifications

- **Phase:** 1
- **Actor:** Renter, System
- **Overview:** §2 Deposit Handling
- **Preconditions:** Rental with depositHoldStatus = 'failed'; renter's payment method is still invalid or will decline.
- **Note:** There are two retry paths — the renter-triggered button (`POST /api/rentals/[id]/retry-deposit`) and the schedule-deposit-holds cron (which also processes 'failed' deposits within the 48h window). This test covers both.
- **Steps (button path):**
  1. As renter, click "Retry Deposit Hold" on the rental detail page.
  2. Verify the hold fails; an inline error message is shown to the renter.
  3. Verify depositHoldStatus remains 'failed'.
  4. Verify no notifications are sent to renter or owner from the button retry endpoint.
- **Steps (cron path):**
  1. With a rental in depositHoldStatus = 'failed' and startDate within 48h, run the schedule-deposit-holds cron.
  2. Verify the cron attempts the hold with the renter's current payment method.
  3. Verify the hold fails; depositHoldStatus remains 'failed'; ops receives an email alert (OPS_ALERT_EMAIL).
  4. Verify renter and owner do NOT receive duplicate notifications (since status was already 'failed' before the cron ran).
- **Expected results:**
  - Button retry: failure shown inline to renter; no notifications sent.
  - Cron retry: failure keeps status 'failed'; ops alerted; no duplicate renter/owner notifications.
- [ ] Pass / [ ] Fail

### \*\*UAT-P1-11: Deposit released after 24h dispute window (clean return)

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §2 Deposit Handling
- **Preconditions:** Rental completed; owner confirmed return; 24+ hours since returnConfirmedAt; no dispute filed; depositHoldStatus = 'held'.
- **Steps:**
  1. Run process-payouts cron (or wait for scheduled run).
  2. Verify deposit hold is released: Stripe PaymentIntent canceled; depositHoldStatus = 'released'; depositReleasedAt set.
  3. Verify renter is not charged (hold was never captured).
- **Expected results:**
  - Deposit released via cancel; lifecycle updated; no charge to renter.
- [ ] Pass / [ ] Fail

### \*\* UAT-P1-12: Deposit not released while dispute is open

- **Phase:** 1 (and 3)
- **Actor:** Owner, Renter, System
- **Overview:** §2 Deposit Handling, §6 Dispute Resolution
- **Preconditions:** Rental completed, return confirmed, deposit held; dispute filed (open status).
- **Steps:**
  1. Run process-payouts cron.
  2. Verify deposit is NOT released; depositHoldStatus remains 'held'.
  3. Verify owner transfer is not created (ownerTransferStatus = 'frozen' or remains pending and skipped).
- **Expected results:**
  - Payout cron skips deposit release and transfer while dispute is open.
- [ ] Pass / [ ] Fail

### \*\* UAT-P1-13: Deposit expiry — hold older than 6 days, cron sets expired

- **Phase:** 1
- **Actor:** System, Ops
- **Overview:** §2 Deposit Handling
- **Preconditions:** Rental with depositHoldStatus = 'held' and deposit_hold_placed_at more than 6 days ago; Stripe PaymentIntent has expired (canceled).
- **Steps:**
  1. Run monitor-deposit-expiry cron.
  2. Verify depositHoldStatus is set to 'expired'.
  3. Verify ops receives alert (email); no notification to renter/owner.
- **Expected results:**
  - Status 'expired'; ops alerted; no user notification.
- [ ] Pass / [ ] Fail

### \*\* UAT-P1-14: Deposit expiry — hold not yet expired, no change

- **Phase:** 1
- **Actor:** System
- **Overview:** §2 Deposit Handling
- **Preconditions:** Rental with deposit held less than 6 days ago; Stripe PI still valid.
- **Steps:**
  1. Run monitor-deposit-expiry cron.
  2. Verify depositHoldStatus remains 'held'; no alert.
- **Expected results:**
  - No state change; no alert.
- [ ] Pass / [ ] Fail

### \*\* UAT-P1-15: Schedule-deposit-holds cron places hold when within 48h

- **Phase:** 1
- **Actor:** System
- **Overview:** §2 Deposit Handling, §7 Cron
- **Preconditions:** At least one rental with depositHoldStatus = 'scheduled' and startDate within 48 hours.
- **Steps:**
  1. Call GET /api/cron/schedule-deposit-holds with valid CRON_SECRET.
  2. Verify response indicates success; for each eligible rental, depositHoldStatus becomes 'held' or 'failed'.
  3. In Stripe, verify new PaymentIntents (or confirm existing) for deposit holds.
- **Expected results:**
  - Cron runs; holds placed for eligible rentals; status updated.
- [ ] Pass / [ ] Fail

### UAT-P1-16: Schedule-deposit-holds retries failed deposits within 48h window

- **Phase:** 1
- **Actor:** System
- **Overview:** §2 Deposit Handling
- **Preconditions:** Rental with depositHoldStatus = 'failed' and startDate within 48 hours; renter has a valid (or updated) payment method.
- **Steps:**
  1. Run schedule-deposit-holds cron.
  2. Verify the cron picks up the rental (status 'failed' is included in eligible query).
  3. Verify it attempts the hold with the renter's current default payment method.
  4. If the hold succeeds: verify depositHoldStatus = 'held' and depositHoldPlacedAt is set.
  5. If the hold fails again: verify depositHoldStatus remains 'failed'; ops receives an email alert; renter and owner do NOT receive duplicate notifications.
- **Expected results:**
  - Cron retries 'failed' deposits within the 48h window using the renter's current payment method; renter/owner notifications are suppressed on repeat failures (ops-only alert).
- [ ] Pass / [ ] Fail

### UAT-P1-17: Deposit hold is authorization only (no capture until dispute)

- **Phase:** 1
- **Actor:** System
- **Overview:** §1 Payment Capture, §2 Deposit Handling
- **Preconditions:** Rental with deposit held.
- **Steps:**
  1. In Stripe Dashboard, confirm deposit PaymentIntent has capture_method = manual and is not captured.
  2. Confirm renter's card shows authorization hold, not a completed charge.
- **Expected results:**
  - Hold only; no capture unless dispute resolution requires it (Phase 3).
- [x] Pass / [ ] Fail

### \*\*UAT-P1-18: Zero deposit listing — cron skips deposit, proceeds to transfer when eligible

- **Phase:** 1
- **Actor:** System
- **Overview:** §2 Deposit Handling, §12 Edge Cases
- **Preconditions:** Completed rental, return confirmed 24+ hours ago, no dispute; depositHoldStatus = 'not_applicable'.
- **Steps:**
  1. Run process-payouts cron.
  2. Verify no deposit operation; owner transfer is created if other criteria met.
- **Expected results:**
  - Deposit step skipped; transfer created as normal.
- [ ] Pass / [ ] Fail

---

## 5. UAT Scenarios — §3 Owner Payout

### UAT-P1-19: Owner not paid at booking

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §3 Owner Payout
- **Preconditions:** Rental just approved; charge captured.
- **Steps:**
  1. Check owner's Stripe Connect account (or platform balance).
  2. Verify no transfer has been created to the owner for this rental.
- **Expected results:**
  - Funds in platform account only; no transfer yet.
- [x] Pass / [ ] Fail

### \*\* UAT-P1-20: Payout only after completed + 24h + no dispute

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §3 Owner Payout
- **Preconditions:** Rental status = completed; returnConfirmedAt set more than 24 hours ago; no open dispute; deposit released or not_applicable; payoutStatus = pending, ownerTransferStatus = pending.
- **Steps:**
  1. Run process-payouts cron.
  2. Verify transfer is created to owner's Connected account; amount = rental price minus platform fee (20%).
  3. Verify lifecycle: ownerTransferStatus = 'completed', payoutStatus = 'completed', stripe_transfer_id and owner_transferred_at set.
- **Expected results:**
  - Transfer created; lifecycle updated; owner receives funds per fee rules.
- [ ] Pass / [ ] Fail

### \*\* UAT-P1-21: Payout cron does not run before 24h after return

- **Phase:** 1
- **Actor:** System
- **Overview:** §3 Owner Payout
- **Preconditions:** Rental completed, returnConfirmedAt set less than 24 hours ago.
- **Steps:**
  1. Run process-payouts cron.
  2. Verify this rental is not processed; no transfer created; payoutStatus remains 'pending'.
- **Expected results:**
  - Rental excluded from payout until 24h window elapsed.
- [ ] Pass / [ ] Fail

### UAT-P1-22: Platform fee deducted correctly

- **Phase:** 1
- **Actor:** System
- **Overview:** §3 Owner Payout, §9 Fee Structure
- **Preconditions:** Rental with known totalAmount; platform fee 20%.
- **Steps:**
  1. After payout, verify transfer amount = (rental price × 0.8) in cents (or per PLATFORM_FEE_PERCENTAGE).
  2. Verify platform retains the 20% (e.g. in Stripe Dashboard).
- **Expected results:**
  - Transfer amount matches spec; platform fee retained.
- [ ] Pass / [ ] Fail

### UAT-P1-23: Transfer failure — status failed, ops alerted

- **Phase:** 1
- **Actor:** System, Ops
- **Overview:** §3 Owner Payout, §10 Operations Alerting
- **Preconditions:** Scenario where transfer fails (e.g. owner Connected account deactivated, or simulate transfer.reversed webhook).
- **Steps:**
  1. Trigger transfer (cron) or simulate transfer.reversed webhook.
  2. Verify ownerTransferStatus = 'failed'; payoutStatus = 'failed' if applicable.
  3. Verify ops receives email alert.
- **Expected results:**
  - Status updated to failed; ops alerted; no automatic retry.
- [ ] Pass / [ ] Fail

### UAT-P1-24: Transfer uses source_transaction (Charge ID)

- **Phase:** 1
- **Actor:** System
- **Overview:** §3 Owner Payout
- **Preconditions:** Rental with rental_charge_id stored.
- **Steps:**
  1. After successful payout, in Stripe Dashboard verify the transfer has source_transaction equal to the rental's charge ID.
- **Expected results:**
  - Transfer linked to original charge for correct balance handling.
- [ ] Pass / [ ] Fail

---

## 6. UAT Scenarios — §4 Return Confirmation

### UAT-P1-25: Owner confirms return — returnConfirmedAt set, renter notified

- **Phase:** 1
- **Actor:** Owner, Renter, System
- **Overview:** §4 Return Confirmation
- **Preconditions:** Active rental; owner has not yet confirmed return.
- **Steps:**
  1. As owner, confirm return (e.g. POST /api/rentals/[id]/confirm-return or UI).
  2. Verify returnConfirmedAt is set on rental; rental_requests.status = 'completed'.
  3. Verify renter receives notification that return was acknowledged.
  4. Verify no payout or deposit release happens at this time (still within 24h window).
- **Expected results:**
  - returnConfirmedAt set; renter notified; no immediate payout/deposit action.
- [x] Pass / [ ] Fail

### UAT-P1-26: Duplicate return confirmation rejected

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §4 Return Confirmation
- **Preconditions:** Rental already has returnConfirmedAt set.
- **Steps:**
  1. As owner, attempt to confirm return again.
  2. Verify API returns 409 Conflict or equivalent; returnConfirmedAt unchanged.
- **Expected results:**
  - Duplicate confirmation rejected; no duplicate audit or notification.
- [ ] Pass / [ ] Fail

### UAT-P1-27: Audit log entry on return confirmation

- **Phase:** 1
- **Actor:** Owner, System
- **Overview:** §4 Return Confirmation
- **Preconditions:** Rental not yet return-confirmed.
- **Steps:**
  1. Confirm return.
  2. Verify an audit log entry exists with owner's user ID and timestamp for the confirm-return action.
- **Expected results:**
  - Audit trail of who confirmed and when.
- [ ] Pass / [ ] Fail

### UAT-P1-28: Payout runs only after 24h from return confirmation

- **Phase:** 1
- **Actor:** System
- **Overview:** §4 Return Confirmation, §3 Owner Payout
- **Preconditions:** Return confirmed exactly 23 hours ago; no dispute; deposit released or N/A.
- **Steps:**
  1. Run process-payouts cron.
  2. Verify rental is not yet eligible; no transfer.
  3. After 24h from returnConfirmedAt, run cron again; verify transfer is created.
- **Expected results:**
  - Payout only after 24h elapsed.
- [ ] Pass / [ ] Fail

---

## 7. UAT Scenarios — §5 Cancellation Paths (Phase 2)

### UAT-P2-01: Renter cancels before owner confirms — no charge

- **Phase:** 2
- **Actor:** Renter, System
- **Overview:** §5 Cancellation Paths
- **Preconditions:** Rental request in pending state; owner has not approved.
- **Steps:**
  1. As renter, cancel the rental request.
  2. Verify no Stripe charge or refund; request status updated to cancelled.
- **Expected results:**
  - No payment operations; DB cancel only.
- [ ] Pass / [ ] Fail

### UAT-P2-02: Renter cancels 24+ hours before pickup — full rental refund (not service fee)

- **Phase:** 2
- **Actor:** Renter, System
- **Overview:** §5 Cancellation Paths
- **Preconditions:** Rental approved; startDate more than 24 hours away; charge and deposit exist.
- **Steps:**
  1. As renter, cancel the rental.
  2. Verify full refund of **rental price** only (service fee not refunded).
  3. Verify deposit hold is released/canceled.
  4. Verify no owner transfer is created (full rental refunded).
  5. Verify OPS_ALERT sent (email to ops).
- **Expected results:**
  - Rental price refunded; service fee retained; deposit released; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P2-03: Renter cancels less than 24 hours before pickup — 50% refund

- **Phase:** 2
- **Actor:** Renter, System
- **Overview:** §5 Cancellation Paths
- **Preconditions:** Rental approved; startDate less than 24 hours away.
- **Steps:**
  1. As renter, cancel the rental.
  2. Verify 50% of rental price refunded to renter (service fee not refunded).
  3. Verify deposit hold released.
  4. Verify owner receives transfer for remaining 50% of rental price minus platform fee (20%).
  5. Verify OPS_ALERT sent.
- **Expected results:**
  - 50% refund to renter; owner gets 50% minus platform fee; deposit released; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P2-04: Owner cancels after confirming — full refund including service fee

- **Phase:** 2
- **Actor:** Owner, Renter, System
- **Overview:** §5 Cancellation Paths
- **Preconditions:** Rental approved; charge captured; deposit held or scheduled.
- **Steps:**
  1. As owner, cancel the rental.
  2. Verify full refund to renter (rental + service fee); renter made whole.
  3. Verify deposit hold released.
  4. Verify OPS_ALERT sent; platform absorbs Stripe processing fee.
- **Expected results:**
  - Full refund; deposit released; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P2-05: Active rental — cancellation not allowed

- **Phase:** 2
- **Actor:** Renter or Owner, System
- **Overview:** §5 Cancellation Paths
- **Preconditions:** Rental in active status (tool with renter).
- **Steps:**
  1. Attempt to cancel the rental (via UI or API).
  2. Verify cancellation is rejected with clear message.
- **Expected results:**
  - No cancellation; no refund or transfer change.
- [ ] Pass / [ ] Fail

### UAT-P2-06: charge.refunded webhook updates payment record

- **Phase:** 2
- **Actor:** System
- **Overview:** §5 Cancellation Paths, §7 Webhooks
- **Preconditions:** Refund was created (e.g. after cancellation); webhook endpoint has charge.refunded enabled.
- **Steps:**
  1. Trigger or simulate charge.refunded webhook for the rental charge.
  2. Verify payment record updated: status = 'refunded', refundedAt, refundAmount, refundReason set (idempotent if sent twice).
- **Expected results:**
  - Payment record reflects refund; duplicate webhook no-op.
- [ ] Pass / [ ] Fail

### UAT-P2-07: Renter no-show (ops-applied) — 50% refund to renter, rest to owner

- **Phase:** 2
- **Actor:** Ops, System
- **Overview:** §5 No-Show Handling
- **Preconditions:** No-show scenario applied by ops (e.g. support flow or admin action).
- **Steps:**
  1. Apply renter no-show outcome: 50% refund of rental price to renter; owner receives 50% minus platform fee.
  2. Verify refund and transfer amounts; OPS_ALERT sent.
- **Expected results:**
  - 50% rental refund to renter; owner compensated; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P2-08: Owner no-show (ops-applied) — full refund to renter

- **Phase:** 2
- **Actor:** Ops, System
- **Overview:** §5 No-Show Handling
- **Preconditions:** Owner no-show scenario applied by ops.
- **Steps:**
  1. Apply owner no-show outcome: full refund to renter including service fee.
  2. Verify refund amount; OPS_ALERT sent.
- **Expected results:**
  - Renter made whole; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P2-09: Cancel after approval — deposit hold scheduled is canceled

- **Phase:** 2
- **Actor:** Renter, System
- **Overview:** §5 Cancellation Paths, §12 Edge Cases
- **Preconditions:** Rental approved with startDate > 48h; depositHoldStatus = 'scheduled'; no hold placed yet.
- **Steps:**
  1. As renter, cancel the rental.
  2. Verify no deposit hold is ever placed; refund/transfer per cancellation policy.
- **Expected results:**
  - No deposit PI created; cancellation policy applied.
- [ ] Pass / [ ] Fail

### UAT-P2-10: Cancel after approval — deposit already held is released

- **Phase:** 2
- **Actor:** Renter, System
- **Overview:** §5 Cancellation Paths
- **Preconditions:** Rental approved; depositHoldStatus = 'held'.
- **Steps:**
  1. As renter, cancel the rental.
  2. Verify Stripe PaymentIntent for deposit is canceled; depositHoldStatus = 'released' or equivalent.
- **Expected results:**
  - Deposit released; refund/transfer per policy.
- [ ] Pass / [ ] Fail

### UAT-P2-11: Service fee never refunded on renter cancellation

- **Phase:** 2
- **Actor:** Renter, System
- **Overview:** §5 Cancellation Paths, §9 Fee Structure
- **Preconditions:** Renter cancels after approval (either 24h+ or <24h).
- **Steps:**
  1. Note total charge amount (rental + service fee).
  2. After cancellation, verify refund amount does not include service fee; platform retains service fee.
- **Expected results:**
  - Only rental portion refunded per policy; service fee retained.
- [ ] Pass / [ ] Fail

### UAT-P2-12: Owner cancellation — platform absorbs Stripe fee

- **Phase:** 2
- **Actor:** Owner, System
- **Overview:** §5 Cancellation Paths
- **Preconditions:** Owner cancels after confirming.
- **Steps:**
  1. Verify renter receives full refund (rental + service fee).
  2. Verify Stripe processing fee is not deducted from owner; platform absorbs it.
- **Expected results:**
  - Renter whole; platform pays Stripe fee on refund.
- [ ] Pass / [ ] Fail

---

## 8. UAT Scenarios — §6 Dispute Resolution (Phase 3)

### UAT-P3-01: File dispute within 24h of return — success

- **Phase:** 3
- **Actor:** Renter or Owner, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Rental completed; returnConfirmedAt set within last 24 hours; no existing dispute.
- **Steps:**
  1. As renter or owner, file a dispute (e.g. damage) via UI/API.
  2. Verify dispute is created; ownerTransferStatus set to 'frozen'; payout cron will skip rental.
- **Expected results:**
  - Dispute created; payout frozen.
- [ ] Pass / [ ] Fail

### UAT-P3-02: File dispute after 24h window — rejected

- **Phase:** 3
- **Actor:** Renter or Owner, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Rental completed; returnConfirmedAt more than 24 hours ago.
- **Steps:**
  1. Attempt to file a dispute.
  2. Verify request rejected (400) with message that filing window closed.
- **Expected results:**
  - Dispute not created; clear error message.
- [ ] Pass / [ ] Fail

### UAT-P3-03: No-show dispute from start date (no return confirmed)

- **Phase:** 3
- **Actor:** Owner, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Rental status approved; startDate is today or past; returnConfirmedAt not set.
- **Steps:**
  1. As owner, file dispute with reason renter_no_show (or owner_no_show as applicable).
  2. Verify dispute is created; payout frozen.
- **Expected results:**
  - No-show dispute allowed from start date.
- [ ] Pass / [ ] Fail

### UAT-P3-04: Dispute filed — payout cron skips rental

- **Phase:** 3
- **Actor:** System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute for rental; returnConfirmedAt > 24h ago; otherwise eligible for payout.
- **Steps:**
  1. Run process-payouts cron.
  2. Verify this rental is not processed; ownerTransferStatus remains 'frozen'; no transfer; deposit not released.
- **Expected results:**
  - Cron skips rental while dispute open.
- [ ] Pass / [ ] Fail

### UAT-P3-05: Resolve favor_renter — deposit released, unfreeze, renter notified

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute; depositHoldStatus = 'held'.
- **Steps:**
  1. As admin, resolve dispute with outcome favor_renter.
  2. Verify deposit is released (Stripe cancel); depositHoldStatus = 'released'; ownerTransferStatus = 'pending'; dispute resolved.
  3. Verify both parties notified of resolution.
- **Expected results:**
  - Deposit released; transfer unfrozen; next cron can payout rental amount only; parties notified.
- [ ] Pass / [ ] Fail

### UAT-P3-06: Resolve favor_provider — deposit captured, unfreeze

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute; depositHoldStatus = 'held'.
- **Steps:**
  1. As admin, resolve with outcome favor_provider.
  2. Verify deposit is captured via Stripe; depositHoldStatus = 'captured'; ownerTransferStatus = 'pending'; dispute resolved.
  3. Verify transfer (when cron runs) includes rental + deposit amount to owner (per design).
- **Expected results:**
  - Deposit captured to platform/owner; unfrozen; parties notified.
- [ ] Pass / [ ] Fail

### UAT-P3-07: Resolve favor_provider with expired deposit — skip capture, still resolve

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute; depositHoldStatus = 'expired'.
- **Steps:**
  1. As admin, resolve with outcome favor_provider.
  2. Verify capture is skipped (no Stripe capture call); dispute still resolved; ownerTransferStatus = 'pending'; OPS_ALERT sent.
- **Expected results:**
  - Resolution and unfreeze; no capture; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P3-08: Resolve dismissed — same as favor_renter (release deposit)

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute; deposit held.
- **Steps:**
  1. As admin, resolve with outcome dismissed.
  2. Verify deposit released; unfreeze; both parties notified.
- **Expected results:**
  - Same behavior as favor_renter.
- [ ] Pass / [ ] Fail

### UAT-P3-09: Partial capture (partial_provider) — correct amount captured

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute; deposit held; partial amount specified (e.g. $100 of $200).
- **Steps:**
  1. As admin, resolve with outcome partial_provider and partial amount.
  2. Verify Stripe capture for that amount only; depositHoldStatus = 'captured'; dispute resolved; unfreeze.
- **Expected results:**
  - Partial amount captured; owner receives rental + partial deposit per design.
- [ ] Pass / [ ] Fail

### UAT-P3-10: Dispute button visible only when eligible

- **Phase:** 3
- **Actor:** Renter, Owner
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Various rental states (completed within 24h, completed after 24h, active, pending).
- **Steps:**
  1. As renter or owner, view rental detail when within 24h of return — verify File Dispute (or equivalent) is visible.
  2. View when after 24h — verify button hidden or disabled.
  3. When active dispute exists — verify file button hidden.
- **Expected results:**
  - Button visibility matches filing window and existing-dispute rules.
- [ ] Pass / [ ] Fail

### UAT-P3-11: Evidence submission and deadline

- **Phase:** 3
- **Actor:** Renter, Owner, Admin
- **Overview:** §6 Dispute Resolution (evidence collection)
- **Preconditions:** Dispute in evidence_requested or under_review.
- **Steps:**
  1. Upload evidence (image/text) as renter or owner; verify stored and audit logged.
  2. After evidence deadline, attempt upload — verify rejected.
  3. As admin, request additional evidence — verify notification to relevant party.
- **Expected results:**
  - Evidence accepted within window; deadline enforced; admin can request more.
- [ ] Pass / [ ] Fail

### UAT-P3-12: Resolution notifications to both parties

- **Phase:** 3
- **Actor:** Admin, Renter, Owner
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute.
- **Steps:**
  1. As admin, resolve dispute (any outcome).
  2. Verify renter and owner both receive resolution notification (in-app and/or email per product).
- **Expected results:**
  - Both parties notified of resolution and outcome.
- [ ] Pass / [ ] Fail

### UAT-P3-13: Already resolved dispute — cannot resolve again

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Dispute already resolved.
- **Steps:**
  1. As admin, attempt to resolve again.
  2. Verify request rejected (400) with clear message.
- **Expected results:**
  - No double resolution.
- [ ] Pass / [ ] Fail

### UAT-P3-14: Only renter or owner can file dispute for their rental

- **Phase:** 3
- **Actor:** Other user, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Rental exists; user is neither renter nor owner.
- **Steps:**
  1. Attempt to file dispute for that rental.
  2. Verify 403 Forbidden.
- **Expected results:**
  - Only parties to the rental can file.
- [ ] Pass / [ ] Fail

### UAT-P3-15: Active dispute blocks new dispute

- **Phase:** 3
- **Actor:** Renter or Owner, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Open dispute already exists for rental.
- **Steps:**
  1. Attempt to file another dispute for same rental.
  2. Verify rejected with message that active dispute exists.
- **Expected results:**
  - One active dispute per rental.
- [ ] Pass / [ ] Fail

### UAT-P3-16: Deposit capture failure — dispute not resolved, stays frozen

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** §6 Dispute Resolution
- **Preconditions:** Dispute with held deposit; Stripe capture will fail (e.g. simulate or use expired PI).
- **Steps:**
  1. As admin, resolve favor_provider.
  2. Verify capture fails; dispute NOT resolved; ownerTransferStatus remains 'frozen'; OPS_ALERT sent.
- **Expected results:**
  - Resolution blocked until financial op succeeds; ops alerted.
- [ ] Pass / [ ] Fail

---

## 9. UAT Scenarios — §7 Webhooks & Cron

### UAT-P1-29: payment_intent.succeeded — paidAt set

- **Phase:** 1
- **Actor:** System
- **Overview:** §7 Webhooks
- **Preconditions:** Charge created (rental or deposit); webhook endpoint configured.
- **Steps:**
  1. Ensure payment_intent.succeeded is sent (or simulate); handler runs.
  2. Verify payment record status = 'succeeded', paidAt set.
- **Expected results:**
  - DB updated from webhook.
- [ ] Pass / [ ] Fail

### UAT-P1-30: payment_intent.payment_failed — renter notified

- **Phase:** 1
- **Actor:** System, Renter
- **Overview:** §7 Webhooks
- **Preconditions:** Payment attempt that fails (e.g. decline).
- **Steps:**
  1. payment_intent.payment_failed webhook received; handler runs.
  2. Verify payment record status = 'failed'; renter notified.
- **Expected results:**
  - Status updated; renter notified.
- [ ] Pass / [ ] Fail

### UAT-P1-31: payment_intent.canceled (deposit) — expired or intentional

- **Phase:** 1
- **Actor:** System, Ops
- **Overview:** §7 Webhooks
- **Preconditions:** Deposit hold existed; Stripe sends payment_intent.canceled (e.g. expiry or manual cancel).
- **Steps:**
  1. Handler runs; verify depositHoldStatus set to 'expired' if not intentional release; ops alerted if applicable.
- **Expected results:**
  - Lifecycle updated; no duplicate release if already released.
- [ ] Pass / [ ] Fail

### UAT-P1-32: transfer.reversed — ownerTransferStatus failed, ops alerted

- **Phase:** 1
- **Actor:** System, Ops
- **Overview:** §7 Webhooks
- **Preconditions:** Transfer was created; Stripe sends transfer.reversed (or simulate).
- **Steps:**
  1. Handler runs; verify ownerTransferStatus = 'failed'; ops email received.
- **Expected results:**
  - Status updated; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P1-33: Duplicate webhook — no-op, 200

- **Phase:** 1
- **Actor:** System
- **Overview:** §7 Webhooks, §8 Idempotency
- **Preconditions:** Same webhook event (e.g. payment_intent.succeeded) sent twice for same payment.
- **Steps:**
  1. Send same event again; verify handler returns 200; DB state unchanged (no duplicate update).
- **Expected results:**
  - Idempotent; no duplicate side effects.
- [ ] Pass / [ ] Fail

### UAT-P1-34: process-payouts cron — batch limit 20

- **Phase:** 1
- **Actor:** System
- **Overview:** §7 Cron
- **Preconditions:** More than 20 rentals eligible for payout.
- **Steps:**
  1. Run process-payouts cron once; verify at most 20 processed; others remain for next run.
- **Expected results:**
  - Batch limit respected.
- [ ] Pass / [ ] Fail

### UAT-P1-35: process-payouts — atomic claim (processing)

- **Phase:** 1
- **Actor:** System
- **Overview:** §7 Cron, §8 Idempotency
- **Preconditions:** One eligible rental.
- **Steps:**
  1. Run cron; verify payoutStatus moves pending → processing during run, then completed (or failed).
  2. If two cron instances run concurrently, verify only one processes each rental (atomic claim).
- **Expected results:**
  - No double transfer; concurrency safe.
- [ ] Pass / [ ] Fail

### UAT-P1-36: schedule-deposit-holds — batch limit 20

- **Phase:** 1
- **Actor:** System
- **Overview:** §7 Cron
- **Preconditions:** More than 20 rentals with depositHoldStatus = 'scheduled' and startDate within 48h.
- **Steps:**
  1. Run cron once; verify at most 20 get hold placed.
- **Expected results:**
  - Batch limit 20.
- [ ] Pass / [ ] Fail

---

## 10. UAT Scenarios — §8 Idempotency & §9 Fees

### UAT-P1-37: Idempotency key on rental charge

- **Phase:** 1
- **Actor:** System
- **Overview:** §8 Idempotency
- **Preconditions:** Rental request ID known.
- **Steps:**
  1. After approval, in Stripe verify charge created with idempotency key rental-charge-{rentalRequestId}.
- **Expected results:**
  - Key format correct; duplicate request does not create second charge.
- [ ] Pass / [ ] Fail

### UAT-P1-38: Idempotency key on deposit hold

- **Phase:** 1
- **Actor:** System
- **Overview:** §8 Idempotency
- **Preconditions:** Rental ID known.
- **Steps:**
  1. After hold placed, verify deposit PaymentIntent created with idempotency key deposit-hold-{rentalId}.
- **Expected results:**
  - Key format correct.
- [ ] Pass / [ ] Fail

### UAT-P1-39: Idempotency key on transfer

- **Phase:** 1
- **Actor:** System
- **Overview:** §8 Idempotency
- **Preconditions:** Rental eligible for payout.
- **Steps:**
  1. After payout, verify transfer created with idempotency key transfer-owner-{rentalId}.
- **Expected results:**
  - Key format correct; duplicate cron run does not double transfer.
- [ ] Pass / [ ] Fail

### UAT-P1-40: Service fee in charge at booking

- **Phase:** 1
- **Actor:** Renter, System
- **Overview:** §9 Fee Structure
- **Preconditions:** Rental request with known rental price.
- **Steps:**
  1. Complete booking; verify charge amount = rental price + service fee (e.g. calculateServiceFee).
- **Expected results:**
  - Service fee included in charge; renter pays it.
- [ ] Pass / [ ] Fail

### UAT-P1-41: Platform fee 20% at transfer

- **Phase:** 1
- **Actor:** System
- **Overview:** §9 Fee Structure
- **Preconditions:** Rental with known totalAmount (rental price).
- **Steps:**
  1. After payout, verify transfer amount = 80% of rental price (20% platform fee).
- **Expected results:**
  - PLATFORM_FEE_PERCENTAGE applied correctly.
- [ ] Pass / [ ] Fail

### UAT-P1-42: Deposit auth hold — no processing fee to renter

- **Phase:** 1
- **Actor:** System
- **Overview:** §9 Fee Structure
- **Preconditions:** Deposit hold placed.
- **Steps:**
  1. Verify hold is authorization only; no extra fee charged for the hold itself.
- **Expected results:**
  - Auth hold only; no fee for hold.
- [ ] Pass / [ ] Fail

---

## 11. UAT Scenarios — §10 Operations Alerting & §12 Edge Cases

### UAT-P1-43: Deposit hold failure — ops email

- **Phase:** 1
- **Actor:** Ops
- **Overview:** §10 Operations Alerting
- **Preconditions:** Deposit hold fails (e.g. card decline).
- **Steps:**
  1. Verify email sent to OPS_ALERT_EMAIL; log has alertType "ops".
- **Expected results:**
  - Ops notified.
- [ ] Pass / [ ] Fail

### UAT-P1-44: Deposit expiry — ops email

- **Phase:** 1
- **Actor:** Ops
- **Overview:** §10 Operations Alerting
- **Preconditions:** Hold expired; monitor-deposit-expiry cron ran.
- **Steps:**
  1. Verify ops email received; no email to renter/owner.
- **Expected results:**
  - Internal alert only.
- [ ] Pass / [ ] Fail

### UAT-P1-45: Owner transfer failure — ops email

- **Phase:** 1
- **Actor:** Ops
- **Overview:** §10 Operations Alerting
- **Preconditions:** Transfer fails or transfer.reversed.
- **Steps:**
  1. Verify ops email received.
- **Expected results:**
  - Ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P1-46: Cron processing error — ops alerted

- **Phase:** 1
- **Actor:** Ops
- **Overview:** §10 Operations Alerting
- **Preconditions:** Unexpected error during cron (e.g. Stripe timeout).
- **Steps:**
  1. Verify error logged with alertType "ops"; ops email if configured.
- **Expected results:**
  - Ops can investigate.
- [ ] Pass / [ ] Fail

### UAT-P1-47: Alerts internal only — not to renter/owner

- **Phase:** 1
- **Actor:** Renter, Owner
- **Overview:** §10 Operations Alerting
- **Preconditions:** Any ops alert event (e.g. transfer failure).
- **Steps:**
  1. Verify renter and owner do not receive ops alert emails; only OPS_ALERT_EMAIL does.
- **Expected results:**
  - Internal only.
- [ ] Pass / [ ] Fail

### UAT-P1-48: Owner never confirms return — no payout

- **Phase:** 1
- **Actor:** System
- **Overview:** §12 Edge Cases
- **Preconditions:** Rental past end date; return never confirmed.
- **Steps:**
  1. Run process-payouts cron; verify rental not eligible; no transfer.
- **Expected results:**
  - Payout requires return confirmation.
- [ ] Pass / [ ] Fail

### UAT-P1-49: Dispute filed — frozen, cron skips

- **Phase:** 1/3
- **Actor:** System
- **Overview:** §12 Edge Cases
- **Preconditions:** Dispute filed during 24h window.
- **Steps:**
  1. Verify ownerTransferStatus = 'frozen'; process-payouts skips; deposit not released.
- **Expected results:**
  - Frozen until resolution.
- [ ] Pass / [ ] Fail

### UAT-P1-50: Multiple rentals eligible — each processed independently

- **Phase:** 1
- **Actor:** System
- **Overview:** §12 Edge Cases
- **Preconditions:** Several completed rentals, 24h past return, no disputes.
- **Steps:**
  1. Run process-payouts; verify each eligible rental gets transfer; no cross-impact.
- **Expected results:**
  - All processed up to batch limit; correct amounts each.
- [ ] Pass / [ ] Fail

### UAT-P1-51: Double webhook delivery — no duplicate state

- **Phase:** 1
- **Actor:** System
- **Overview:** §12 Edge Cases
- **Preconditions:** Send same webhook event twice (e.g. payment_intent.succeeded).
- **Steps:**
  1. Verify second delivery results in no duplicate DB update; handler returns 200.
- **Expected results:**
  - Idempotent.
- [ ] Pass / [ ] Fail

### UAT-P1-52: Charge ID stored for transfer

- **Phase:** 1
- **Actor:** System
- **Overview:** §12 Edge Cases
- **Preconditions:** Rental charge captured.
- **Steps:**
  1. Verify rental_charge_id (or equivalent) stored in lifecycle; used as source_transaction on transfer.
- **Expected results:**
  - Transfer uses correct charge ID.
- [ ] Pass / [ ] Fail

---

## 12. UAT Scenarios — Phase 3 Chargebacks

### UAT-P3-17: charge.dispute.created — existing internal dispute linked

- **Phase:** 3
- **Actor:** System, Ops
- **Overview:** Phase 3 Chargebacks
- **Preconditions:** Internal dispute exists for rental; Stripe chargeback created for same charge.
- **Steps:**
  1. Send charge.dispute.created webhook (or simulate); handler runs.
  2. Verify internal dispute linked (stripeChargebackId set); payout frozen; OPS_ALERT with sendEmailAlert.
- **Expected results:**
  - Dispute linked; frozen; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P3-18: charge.dispute.created — no internal dispute, auto-create

- **Phase:** 3
- **Actor:** System, Ops
- **Overview:** Phase 3 Chargebacks
- **Preconditions:** No internal dispute; Stripe chargeback created for a rental charge.
- **Steps:**
  1. Webhook handler runs; verify internal dispute auto-created with reasonCode payment_issue; stripeChargebackId set; payout frozen; OPS_ALERT sent.
- **Expected results:**
  - Dispute created; linked; frozen; ops alerted.
- [ ] Pass / [ ] Fail

### UAT-P3-19: charge.dispute.created — unknown charge, no crash

- **Phase:** 3
- **Actor:** System
- **Overview:** Phase 3 Chargebacks
- **Preconditions:** Charge ID not in system.
- **Steps:**
  1. Send webhook for unknown charge; verify handler returns 200; error logged; no throw.
- **Expected results:**
  - Graceful handling; no retry storm.
- [ ] Pass / [ ] Fail

### UAT-P3-20: Admin submits chargeback evidence

- **Phase:** 3
- **Actor:** Admin, System
- **Overview:** Phase 3 Chargebacks
- **Preconditions:** Dispute with stripeChargebackId; admin has evidence.
- **Steps:**
  1. As admin, submit evidence via admin UI/API; verify stripe.disputes.update called; audit logged.
  2. Non-admin attempt — verify 403.
- **Expected results:**
  - Evidence submitted to Stripe; admin-only; audit trail.
- [ ] Pass / [ ] Fail

### UAT-P3-21: charge.dispute.closed — outcome recorded

- **Phase:** 3
- **Actor:** System, Ops
- **Overview:** Phase 3 Chargebacks
- **Preconditions:** Chargeback closed (won or lost) in Stripe.
- **Steps:**
  1. Send charge.dispute.closed; verify handler records outcome; audit log; ops alerted.
- **Expected results:**
  - Outcome and audit; ops aware.
- [ ] Pass / [ ] Fail

### UAT-P3-22: Duplicate chargeback webhook — idempotent

- **Phase:** 3
- **Actor:** System
- **Overview:** Phase 3 Chargebacks
- **Preconditions:** charge.dispute.created already processed for a charge.
- **Steps:**
  1. Send same event again; verify no duplicate dispute created; 200.
- **Expected results:**
  - Idempotent.
- [ ] Pass / [ ] Fail

---

## 13. UAT Scenarios — Phase 4 Operational Tooling

### UAT-P4-01: Admin can open payment lifecycle list

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Admin user; Phase 4 deployed.
- **Steps:**
  1. Log in as admin; navigate to Payments → Lifecycle (or equivalent).
  2. Verify list loads with columns: rental id, renter, owner, depositHoldStatus, ownerTransferStatus, payoutStatus, timestamps.
- **Expected results:**
  - List visible; data correct.
- [ ] Pass / [ ] Fail

### UAT-P4-02: Filter lifecycle list by status

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Multiple lifecycle records with different statuses.
- **Steps:**
  1. Filter by depositHoldStatus = 'failed'; verify only failed deposits shown.
  2. Filter by payoutStatus = 'pending'; verify only pending shown.
  3. Filter by ownerTransferStatus = 'frozen'; verify only frozen shown.
- **Expected results:**
  - Filters apply correctly; URL or state reflects filters.
- [ ] Pass / [ ] Fail

### UAT-P4-03: Search lifecycle list by rental or user

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Known rental id or owner/renter id.
- **Steps:**
  1. Search by rental id (partial or full); verify matching records.
  2. Search by owner or renter id; verify matching records.
- **Expected results:**
  - Search returns correct subset.
- [ ] Pass / [ ] Fail

### UAT-P4-04: Pagination and link to detail

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** More than one page of results.
- **Steps:**
  1. Verify pagination controls; change page; URL updates (if URL-synced).
  2. Click a row or link to open lifecycle detail for one rental.
- **Expected results:**
  - Pagination works; detail opens for selected rental.
- [ ] Pass / [ ] Fail

### UAT-P4-05: Lifecycle detail — full timeline and Stripe IDs

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with lifecycle and optional dispute.
- **Steps:**
  1. Open lifecycle detail for a rental; verify charge ID, deposit PaymentIntent ID, transfer ID (if completed), returnConfirmedAt, dispute link if dispute exists.
- **Expected results:**
  - All identifiers and timeline visible; link to dispute review if applicable.
- [ ] Pass / [ ] Fail

### UAT-P4-06: Payment metrics cards on dashboard

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Various lifecycle states in DB.
- **Steps:**
  1. Open Payments section; verify metric cards show counts for payouts (pending, processing, completed, failed), transfers (pending, completed, failed, frozen), deposits (scheduled, held, released, expired, failed, captured, not_applicable).
- **Expected results:**
  - Counts match actual data; problematic counts (e.g. failed) highlighted.
- [ ] Pass / [ ] Fail

### UAT-P4-07: Reset payout status (processing → pending)

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with payoutStatus = 'processing' (e.g. cron crashed).
- **Steps:**
  1. Open lifecycle detail; click Reset Payout Status; confirm (optional reason); submit.
  2. Verify payoutStatus = 'pending'; audit log entry created with admin id, action payout_status_reset, previous/new status.
  3. Run process-payouts cron; verify rental is processed.
- **Expected results:**
  - Reset allows cron retry; audit logged.
- [ ] Pass / [ ] Fail

### UAT-P4-08: Reset payout status (failed → pending)

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with payoutStatus = 'failed'.
- **Steps:**
  1. Reset payout status; verify moves to 'pending'; audit log; next cron retries.
- **Expected results:**
  - Same as UAT-P4-07 for failed.
- [ ] Pass / [ ] Fail

### UAT-P4-09: Reset payout status — invalid state rejected

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with payoutStatus = 'completed' or 'pending'.
- **Steps:**
  1. Attempt reset; verify 400 or UI error: only processing/failed can be reset.
- **Expected results:**
  - Clear rejection message.
- [ ] Pass / [ ] Fail

### UAT-P4-10: Reset transfer status (failed → pending)

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with ownerTransferStatus = 'failed'.
- **Steps:**
  1. Reset transfer status; verify moves to 'pending'; audit log; if payoutStatus was failed, it also resets to pending per design.
  2. Run process-payouts; verify transfer retried.
- **Expected results:**
  - Retry possible; audit logged.
- [ ] Pass / [ ] Fail

### UAT-P4-11: Reset transfer status — invalid state rejected

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with ownerTransferStatus = 'pending' or 'completed'.
- **Steps:**
  1. Attempt reset; verify rejected with clear message.
- **Expected results:**
  - Only failed can be reset.
- [ ] Pass / [ ] Fail

### UAT-P4-12: Manual release deposit (held → released)

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with depositHoldStatus = 'held'.
- **Steps:**
  1. Open lifecycle detail; click Release Deposit; confirm (optional reason); submit.
  2. Verify Stripe PaymentIntent canceled; depositHoldStatus = 'released'; depositReleasedAt set; audit log; renter notified.
- **Expected results:**
  - Deposit released; audit and notification.
- [ ] Pass / [ ] Fail

### UAT-P4-13: Manual release deposit — already canceled in Stripe

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling, §12 Edge Cases
- **Preconditions:** depositHoldStatus = 'held' in DB but Stripe PI already canceled (e.g. expired).
- **Steps:**
  1. Trigger manual release; verify treated as success; local state updated to 'released'; no error to user.
- **Expected results:**
  - Idempotent; state consistent.
- [ ] Pass / [ ] Fail

### UAT-P4-14: Manual release deposit — invalid state rejected

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** depositHoldStatus = 'released' or 'expired' or 'not_applicable'.
- **Steps:**
  1. Attempt release; verify 400 or UI error: only held can be released.
- **Expected results:**
  - Clear rejection.
- [ ] Pass / [ ] Fail

### UAT-P4-15: Cron run history list and filter

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Payment crons have run (schedule-deposit-holds, process-payouts, monitor-deposit-expiry, detect-stale-processing).
- **Steps:**
  1. Navigate to Payments → Cron History; verify table of runs with job name, started, completed, duration, status, eligible/succeeded/failed counts.
  2. Filter by job name; verify only that job's runs shown.
- **Expected results:**
  - History visible; filter works.
- [ ] Pass / [ ] Fail

### UAT-P4-16: Stale processing detection — ops alerted

- **Phase:** 4
- **Actor:** Ops
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** At least one rental with payoutStatus = 'processing' and updatedAt older than threshold (e.g. 1 hour).
- **Steps:**
  1. Run detect-stale-processing cron (or wait for scheduled run); verify ops receives alert (email) with event stale_processing_detected, count, rental ids.
- **Expected results:**
  - Ops alerted; no automatic reset (manual override required).
- [ ] Pass / [ ] Fail

### UAT-P4-17: Non-admin cannot access payment lifecycle API/UI

- **Phase:** 4
- **Actor:** Non-admin user
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** User without admin role.
- **Steps:**
  1. Attempt to open Payments lifecycle list or detail or metrics or cron history; verify 403 or redirect.
  2. Attempt GET /api/admin/payments/lifecycle; verify 403.
- **Expected results:**
  - Admin-only access enforced.
- [ ] Pass / [ ] Fail

### UAT-P4-18: Audit log visible on lifecycle detail

- **Phase:** 4
- **Actor:** Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with at least one override (e.g. payout reset) and audit entry.
- **Steps:**
  1. Open lifecycle detail; verify audit section shows recent entries: admin, action, timestamp, previous/new state, reason.
- **Expected results:**
  - Audit trail visible per rental.
- [ ] Pass / [ ] Fail

### UAT-P4-19: Cron history recorded after each run

- **Phase:** 4
- **Actor:** System, Admin
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Cron endpoints configured to record history.
- **Steps:**
  1. Run process-payouts (success); verify new row in cron history with status success and counts.
  2. Run a cron that fails; verify row with status failure and error message.
- **Expected results:**
  - Every run recorded; failures visible.
- [ ] Pass / [ ] Fail

### UAT-P4-20: Stale detection does not modify records

- **Phase:** 4
- **Actor:** System
- **Overview:** Phase 4 Operational Tooling
- **Preconditions:** Rental with payoutStatus = 'processing' (stale).
- **Steps:**
  1. Run detect-stale-processing; verify alert sent; payoutStatus still 'processing' (no auto-reset).
- **Expected results:**
  - Read-only detection; manual override required to unstick.
- [ ] Pass / [ ] Fail

---

## 14. Test Environment and Data

- **Environment:** Use Stripe **test mode** (test keys). Ensure webhook endpoint points to test URL (e.g. ngrok or staging) and events are sent for payment*intent.*, transfer.\_, charge.refunded, charge.dispute.\* as needed.
- **Cron:** Trigger crons manually via GET with `Authorization: Bearer {CRON_SECRET}` or use GitHub Actions in a test workflow. Ensure CRON_SECRET is set in environment.
- **Test users:** Have at least one **renter** (with valid test payment method), one **owner** (with Stripe Connected account in test), and one **admin**.
- **Test data:** Create rentals in various states: pending, approved (scheduled vs immediate deposit), active, completed with return confirmed (within/outside 24h), with and without disputes, with failed deposit or failed transfer. Use Stripe test cards (e.g. 4000000000000341 for decline, 4000000000003220 for 3DS) as needed.
- **Ops alerts:** Configure OPS_ALERT_EMAIL to a mailbox you can check; verify each alert type at least once.
- **Phase 4:** If Phase 4 is deployed, use admin dashboard for lifecycle list, detail, metrics, overrides, and cron history; otherwise omit Phase 4 scenarios or mark N/A.

---

## 15. Sign-Off

| Role          | Name | Date | UAT complete (all sections run) |
| ------------- | ---- | ---- | ------------------------------- |
| Tester        |      |      | [ ]                             |
| Product Owner |      |      | [ ]                             |

_Last updated: March 2026 • Internal use only_
