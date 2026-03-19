# Stripe Connect Payment Requirements

Hoador • Internal Specification

---

## 1. Payment Capture

### Trigger

Rental payment is captured when the **owner confirms** the rental request (approves it).

Deposit auth hold is placed **separately** — either immediately at approval (if pickup is within 48 hours) or scheduled via cron job to be placed 48 hours before pickup.

### What Gets Captured

- **Rental amount**: full rental cost + service fee, captured as an immediate charge into the platform account. No `transfer_data` — funds stay in the platform account until the dispute window closes.
- **Deposit amount**: placed as an **authorization hold** (`capture_method: 'manual'`), not a real charge. The hold reserves funds on the renter's card without moving money. The hold is released (cancelled) at no cost on clean return.

Neither amount is transferred to the owner at this stage.

### Stripe Implementation

- Rental charge: `capture_method: 'automatic'`, `off_session: true`, `confirm: true`, no `transfer_data`, no `application_fee_amount`
- Deposit hold: `capture_method: 'manual'`, `off_session: true`, `confirm: true` — creates a `requires_capture` PaymentIntent
- Idempotency key on rental charge: `rental-charge-{rentalRequestId}`
- Idempotency key on deposit hold: `deposit-hold-{rentalId}`
- `paymentType` metadata distinguishes the two: `rental_charge` vs `security_deposit_hold`
- Charge ID (`paymentIntent.latest_charge`) is stored at capture time for use as `source_transaction` on later owner transfers
- If the rental charge fails with a retryable Stripe error (`StripeRateLimitError`, `StripeAPIError`, `StripeConnectionError`), the system retries once after a 1-second delay

---

## 2. Deposit Handling

### Auth Hold Placement

- Deposit uses **authorization holds** (not real charges). Standard Stripe auth holds last **7 days**.
- If `startDate > 48 hours` from approval: `depositHoldStatus` is set to `'scheduled'` — the hourly cron job places the hold when the rental is within 48 hours of pickup.
- If `startDate <= 48 hours` from approval: hold is placed **immediately** at approval time.
- If the listing has no security deposit (`securityDeposit === 0`): `depositHoldStatus` is set to `'not_applicable'` and no hold is placed.

### Hold Failure

- If the auth hold fails, the rental **still proceeds** — it is not cancelled.
- Both renter and owner are notified once: renter is told to update their payment method, owner is told the rental is proceeding without deposit protection.
- `depositHoldStatus` is set to `'failed'`.
- There are two retry paths:
  - **Manual (renter-triggered):** The rental detail page shows a **"Retry Deposit Hold"** button when `depositHoldStatus = 'failed'` and the rental has not yet started. Clicking it (`POST /api/rentals/[id]/retry-deposit`) immediately attempts the hold using the renter's current default payment method. On success: `'held'`. On failure: an error is shown inline; status stays `'failed'`; no additional notifications are sent.
  - **Automatic (cron):** The schedule-deposit-holds cron also picks up `'failed'` deposits within the 48h pickup window and retries the hold with the renter's current payment method. On success: `'held'`. On failure: status stays `'failed'`; ops is alerted; renter and owner are **not** re-notified (initial notification was already sent).

### Release (Clean Return)

- Deposit hold is released by calling `stripe.paymentIntents.cancel()` on the deposit PaymentIntent — this is **not** a refund (since the hold was never captured).
- Release happens as part of the payout processing cron, **after** the 24-hour dispute window closes with no open disputes.
- `depositHoldStatus` transitions: `'held'` → `'released'`, with `depositReleasedAt` timestamp recorded.

### Expiry (Rentals > 7 Days)

- Standard Stripe auth holds expire after 7 days. For rentals longer than 7 days, the hold will expire before return.
- The **deposit expiry monitoring cron** runs hourly and checks holds placed more than 6 days ago via `stripe.paymentIntents.retrieve()`.
- If the PaymentIntent status is `'canceled'` (expired by Stripe), `depositHoldStatus` is set to `'expired'` and ops is alerted.
- **No user notification** is sent for expirations — ops handles case by case.
- This is an accepted Phase 1 limitation. Extended authorizations (up to 30 days) are planned for a future phase.

### Dispute Filed

- If a dispute is open when the payout cron runs, the deposit hold is **not released** — it remains held pending dispute resolution.
- If the hold has already expired (`depositHoldStatus: 'expired'`), the cron skips deposit release and proceeds directly to evaluating the owner transfer (which will also be blocked by the open dispute).

---

## 3. Owner Payout

### Timing

- Owner is **never** paid at booking confirmation.
- Transfer is triggered only after: rental status is `'completed'` (owner confirmed return) **AND** 24-hour dispute window has elapsed **AND** no open disputes exist.
- If a dispute is filed at any point during the window, `ownerTransferStatus` is set to `'frozen'` and the payout cron skips the rental until the dispute is resolved.

### Stripe Implementation

- Rental payment captured with no `transfer_data` — funds sit in platform account.
- After the dispute window closes, the payout cron calls `stripe.transfers.create()` with:
  - `source_transaction`: the Charge ID from the original rental PaymentIntent
  - `destination`: the owner's Stripe Connected Account ID
  - `amount`: rental charge minus platform fee (20%, defined by `PLATFORM_FEE_PERCENTAGE`)
  - Idempotency key: `transfer-owner-{rentalId}`
- Platform fee is calculated as `Math.round(totalAmount * PLATFORM_FEE_PERCENTAGE * 100)` in cents and deducted from the transfer amount.

### Transfer Failure

- `transfer.reversed` webhook sets `ownerTransferStatus: 'failed'` and alerts the ops team.
- The system does **not** automatically retry failed transfers — manual intervention is required.
- Common failure causes: owner's connected account deactivated, insufficient platform balance.

---

## 4. Return Confirmation

### Trigger

- Owner calls `POST /api/rentals/[id]/confirm-return` to confirm the tool has been returned.
- Sets `returnConfirmedAt` on the rental record and transitions `rental_requests.status` to `'completed'`.
- Duplicate confirmations are rejected (409 Conflict).

### What Happens

- An audit log entry is created with the owner's user ID and timestamp.
- The renter is notified that the return has been acknowledged.
- **No payout or deposit operations** are triggered at return confirmation time — these are handled by the payout processing cron after the 24-hour dispute window.

### Limitations

- Only the owner confirms return (single-party confirmation). Both-party confirmation is a potential future enhancement.
- If the owner never confirms return, the payout cron will never find the rental eligible. A future phase may add auto-completion after the end date plus a grace period.

---

## 5. Cancellation Paths

> **Phase 2** — Automated cancellation paths; no-show is ops-driven.

### Renter Cancels Before Owner Confirms

- No payment has been taken — no Stripe action required.
- Cancel rental request in DB only.

### Renter Cancels After Owner Confirms (Pre-Pickup)

- **Cancellation policy tiers:** Full refund of **rental price** (not service fee) if cancelled **24 hours or more** before pickup. **50% refund** of rental price if cancelled **less than 24 hours** before pickup. The **service fee is never refunded** when the renter cancels — the platform retains it.
- **Owner transfer:** Any non-refunded balance of the rental price (e.g. 50% on &lt;24h cancellation) is transferred to the owner minus the platform fee (20% of rental price). No transfer is created when the full rental price is refunded (≥24h cancellation).
- Deposit hold is released (cancelled) since it was never captured.
- Stripe retains the processing fee (~2.9% + $0.30) on the rental charge refund — **platform absorbs this cost**.
- **OPS_ALERT** is sent for all renter cancellations after approval.

### Owner Cancels After Confirming

- **Full refund** of rental charge to renter **including service fee** (renter made whole).
- Deposit hold is released.
- **Platform** absorbs the Stripe processing fee (not the owner).

### Active Rental

- **Cancellation is not allowed** for rentals in `active` status.
- Early termination (e.g. tool returned before end date) has **no effect on payment** — no partial refund, no proration.

### No-Show Handling

- **Renter no-show:** 50% refund of **rental price only** (service fee not refunded) to renter. Owner receives remaining compensation (50% of rental price) minus platform fee. **OPS_ALERT** sent to admin.
- **Owner no-show:** Full refund to renter **including service fee**. **OPS_ALERT** sent to admin.
- No-show is reported by either party via support; ops applies the outcome (no automated time-based no-show in Phase 2).

---

## 6. Dispute Resolution (Internal)

> **Phase 3** — Not implemented in Phase 1. The 24-hour dispute window and `frozen` transfer status are in place, but the actual dispute filing and resolution workflow is deferred.

### Filing Window

- Owner has 24 hours after confirmed return to file a damage claim.
- The payout cron checks for open disputes before processing — a dispute filed at any point during the window will block the payout.

### Current Phase 1 Behavior

- If a dispute is open (status: `'open'`, `'evidence_requested'`, or `'under_review'`), the payout cron skips the rental entirely.
- `ownerTransferStatus` is set to `'frozen'` when a dispute is detected.
- Deposit hold remains in place if not expired.
- Resolution outcomes and mediation are deferred to Phase 3.

### Stripe Chargebacks (Bank-Level Disputes)

> **Phase 3** — Chargeback evidence collection and automated response are not implemented in Phase 1.

---

## 7. Webhook & Cron Architecture

### Webhooks (Stripe-Driven Events)

| Event                           | Handler                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `account.updated`               | Update owner's Stripe Connect onboarding status                                                                                           |
| `account.closed`                | Disable payment capabilities for the owner                                                                                                |
| `payment_intent.succeeded`      | Update payment record status to `'succeeded'`, set `paidAt`                                                                               |
| `payment_intent.payment_failed` | Update payment record status to `'failed'`, notify renter                                                                                 |
| `payment_intent.canceled`       | If deposit hold: check if intentional release or expiration; set `depositHoldStatus: 'expired'` + alert ops if not intentionally released |
| `transfer.reversed`             | Set `ownerTransferStatus: 'failed'`, alert ops when transfer is reversed/clawed back                                                      |
| `charge.refunded` (Phase 2)     | Update payment record to `'refunded'`, set `refundedAt`, `refundAmount`, `refundReason` (idempotent)                                      |

All webhook handlers are idempotent — they check current DB status before making changes. Duplicate webhook delivery results in a no-op with HTTP 200.

**Stripe Dashboard:** For Phase 2 refund sync, add the event type `charge.refunded` to your Stripe webhook endpoint (Dashboard → Developers → Webhooks → select endpoint → "Update details" → add event).

### Cron Jobs (3 Separate Endpoints)

**1. Deposit Hold Scheduling** — `GET /api/cron/schedule-deposit-holds` (hourly)

- Finds rentals where `depositHoldStatus = 'scheduled'` and `startDate` is within 48 hours.
- Places the auth hold via Stripe, updates status to `'held'` or `'failed'`.
- Does **not** process rentals with `depositHoldStatus = 'failed'` (awaiting renter payment method update).
- Batch limit: 20 per run.

**2. Payout Processing** — `GET /api/cron/process-payouts` (hourly)

- Finds rentals where `status = 'completed'`, `returnConfirmedAt > 24hrs ago`, `payoutStatus = 'pending'`, no open disputes.
- Atomically claims each rental (`payoutStatus: 'pending' → 'processing'`) to prevent concurrent processing.
- For each rental: (a) release deposit hold if `depositHoldStatus = 'held'`, then (b) create owner transfer if `ownerTransferStatus = 'pending'`.
- On success: `payoutStatus = 'completed'`. On failure: `payoutStatus = 'failed'`, ops alerted.
- Batch limit: 20 per run.

**3. Deposit Expiry Monitoring** — `GET /api/cron/monitor-deposit-expiry` (hourly)

- Finds rentals where `depositHoldStatus = 'held'` and hold was placed more than 6 days ago.
- Checks actual PaymentIntent status via Stripe API.
- If expired (`status: 'canceled'`): sets `depositHoldStatus = 'expired'`, alerts ops.
- No user notification — ops handles case by case.

All cron endpoints verify `Authorization: Bearer {CRON_SECRET}` and require Vercel Pro plan for hourly scheduling (4 total cron jobs including the existing notification cleanup).

---

## 8. Idempotency Protection

### Stripe Idempotency Keys

Every Stripe API call includes a deterministic idempotency key:

| Operation      | Key Format                        |
| -------------- | --------------------------------- |
| Rental charge  | `rental-charge-{rentalRequestId}` |
| Deposit hold   | `deposit-hold-{rentalId}`         |
| Owner transfer | `transfer-owner-{rentalId}`       |
| Refund         | `refund-rental-{rentalId}`        |

### DB Status Gates

The `rental_payment_lifecycle` table (1:1 with rentals) tracks all statuses:

| Field                 | Values                                                                                               | Purpose                  |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------ |
| `depositHoldStatus`   | `scheduled`, `held`, `released`, `expired`, `release_failed`, `failed`, `captured`, `not_applicable` | Gates deposit operations |
| `ownerTransferStatus` | `pending`, `processing`, `completed`, `failed`, `frozen`                                             | Gates owner transfer     |
| `payoutStatus`        | `pending`, `processing`, `completed`, `failed`                                                       | Cron concurrency lock    |

Before every Stripe call, the system checks the corresponding status field. If the status is not in the expected pre-operation state, the Stripe call is skipped.

### Cron Concurrency Lock

- The payout cron uses an atomic `UPDATE ... WHERE payoutStatus = 'pending'` to set `payoutStatus = 'processing'`.
- If the update affects 0 rows, another cron instance already claimed the rental — skip it.
- After all Stripe operations complete: `payoutStatus = 'completed'` or `'failed'`.
- If a cron crashes mid-processing, the rental is left in `'processing'` state and requires manual investigation.

---

## 9. Fee Structure

| Fee                   | Who Pays                   | Calculation                                                                                     | When Applied                      |
| --------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------- |
| **Service fee**       | Renter                     | Breakeven fee covering Stripe's 2.9% + $0.30 on the rental charge — via `calculateServiceFee()` | Added to rental charge at booking |
| **Platform fee**      | Deducted from owner payout | 20% of rental price (`PLATFORM_FEE_PERCENTAGE`)                                                 | Deducted at transfer time         |
| **Deposit auth hold** | No fee                     | Auth holds incur no Stripe processing fee                                                       | N/A                               |

---

## 10. Operations Alerting

### Channels

- **Structured logging**: all ops-relevant events use `getLogger().error()` with `alertType: "ops"` for searchability.
- **Email alerts**: critical failures also send email to `OPS_ALERT_EMAIL` (configured via environment variable).

### Events That Trigger Alerts

| Event                                       | Log | Email |
| ------------------------------------------- | --- | ----- |
| Deposit hold placement failure              | Yes | Yes   |
| Deposit hold expiration detected            | Yes | Yes   |
| Deposit hold release failure                | Yes | Yes   |
| Owner transfer failure                      | Yes | Yes   |
| Cron processing error (unexpected)          | Yes | Yes   |
| Renter cancellation post-approval (Phase 2) | Yes | Yes   |
| Owner cancellation (Phase 2)                | Yes | Yes   |
| Renter no-show (Phase 2)                    | Yes | Yes   |
| Owner no-show (Phase 2)                     | Yes | Yes   |

Operations alerts are **internal only** — never sent to renters or owners.

---

## 11. Data Model

### New Table: `rental_payment_lifecycle`

1:1 with `rentals`. Tracks the full payment lifecycle for each rental.

| Column                   | Type             | Description                                |
| ------------------------ | ---------------- | ------------------------------------------ |
| `id`                     | uuid             | Primary key                                |
| `rental_id`              | uuid (unique FK) | Links to rentals table                     |
| `rental_charge_id`       | varchar          | Stripe Charge ID for `source_transaction`  |
| `deposit_hold_status`    | enum             | See Section 8                              |
| `deposit_hold_placed_at` | timestamp        | When the auth hold was placed              |
| `deposit_released_at`    | timestamp        | When the hold was released                 |
| `owner_transfer_status`  | enum             | See Section 8                              |
| `payout_status`          | enum             | See Section 8                              |
| `stripe_transfer_id`     | varchar          | Stripe Transfer ID after successful payout |
| `owner_transferred_at`   | timestamp        | When the transfer completed                |

### Modified Tables

- **`rentals`**: added `return_confirmed_at` (timestamp) — when the owner confirmed return
- **`payments`**: added `payment_type` (enum: `rental_charge`, `security_deposit_hold`) — distinguishes payment records by type

---

## 12. Edge Cases

1. **Deposit auth hold fails at placement**: rental proceeds without deposit protection. Both parties notified once. Renter can update payment method to trigger retry.
2. **Owner never confirms return**: payout cron will never find the rental eligible. Future phase may add auto-completion after end date + grace period.
3. **Dispute filed during 24-hour window**: `ownerTransferStatus` set to `'frozen'`. Payout cron skips the rental. Deposit hold remains if not expired.
4. **Cron crashes after releasing deposit but before transferring**: `depositHoldStatus = 'released'`, `ownerTransferStatus = 'pending'`, `payoutStatus = 'processing'`. Next cron run skips (not `'pending'`). Manual intervention required.
5. **Renter's payment method declined at approval**: approval fails, rental request stays `pending` with `paymentStatus: 'failed'`. Renter notified.
6. **Owner's connected account deactivated before payout**: `stripe.transfers.create()` fails, `ownerTransferStatus = 'failed'`, ops alerted.
7. **Double webhook delivery**: handlers check DB status before changes — duplicate is a no-op.
8. **Rental with zero deposit**: `depositHoldStatus = 'not_applicable'`. Cron skips deposit operations, proceeds to owner transfer.
9. **Deposit hold expires during rental (>7 days)**: expiry monitoring cron detects, sets `'expired'`, alerts ops only. No user notification.
10. **Approval happens <48hrs before pickup**: deposit hold placed immediately, not scheduled.
11. **Multiple rentals eligible simultaneously**: cron processes in batch (up to 20). Each independently locked via `payoutStatus: 'processing'`.
12. **Charge ID not stored**: if `latest_charge` cannot be resolved at capture time, the transfer will fail later and ops is alerted.
13. **Deposit hold placed but rental is cancelled before pickup**: Phase 2 automates release of the hold (or cancels scheduling) and applies the tiered refund (renter) or full refund (owner).

---

## Phase Roadmap

- **Phase 1 (Current)**: Platform-hold payment capture, deposit auth holds with cron scheduling, 24-hour dispute window, automated owner payout, return confirmation, deposit failure recovery, ops alerting
- **Phase 2**: Cancellation policies — renter/owner cancellation paths, tiered refund rules, deposit hold release on cancellation, Stripe fee accounting on refunds, no-show handling
- **Phase 3**: Dispute resolution & chargebacks — damage claims, deposit capture for damage, mediation outcomes, chargeback evidence collection
- **Phase 4**: Operational tooling — admin dashboard for payment states, stale processing alerts, manual override tools, payout scheduling preferences

---

_Last updated: March 12, 2026 • Internal use only_
