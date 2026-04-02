# HOA Services Marketplace (Phase 1) — User Acceptance Test (UAT) Plan

Hoador • Internal Specification

---

## 1. Introduction

This document defines **User Acceptance Test (UAT)** scenarios for the HOA Services Marketplace Phase 1 feature. UAT is run by a business tester or product owner to verify that the system meets acceptance criteria from a user's perspective and is fit for release.

- **Scope:** All services behavior described in `specs/services/phase1/1-requirements.md` (Requirements 1–11): listing creation and admin approval, service discovery and browsing, booking requests, provider accept/decline, payment capture at acceptance, job completion, provider payout via cron (24-hour dispute window), cancellations and refunds, no-show reporting, mutual reviews, and provider profiles.
- **Relationship to other test docs:** `4-test-plan.md` covers unit, integration, and technical tests. This UAT plan is complementary: executable, end-to-end scenarios that a non-developer can run and sign off.
- **How to use:** Execute each scenario in the test environment (see Section 11), verify expected results, and mark Pass/Fail. Use the traceability table below to ensure every requirement has coverage.

---

## 2. Traceability: Requirements to UAT

| Requirement                       | UAT Scenario IDs                      |
| --------------------------------- | ------------------------------------- |
| Req 1: Service Listing Creation   | UAT-SVC-01 through UAT-SVC-05         |
| Req 2: Admin Listing Approval     | UAT-SVC-06 through UAT-SVC-09         |
| Req 3: Service Discovery & Browse | UAT-SVC-10 through UAT-SVC-13         |
| Req 4: Booking Request            | UAT-SVC-14 through UAT-SVC-18         |
| Req 5: Provider Booking Response  | UAT-SVC-19 through UAT-SVC-23         |
| Req 6: Payment Processing         | UAT-SVC-24 through UAT-SVC-27         |
| Req 7: Job Completion & Payout    | UAT-SVC-28 through UAT-SVC-33         |
| Req 8: Cancellations & Refunds    | UAT-SVC-34 through UAT-SVC-40         |
| Req 9: Mutual Reviews             | UAT-SVC-41 through UAT-SVC-45         |
| Req 10: Provider Profile          | UAT-SVC-46 through UAT-SVC-48         |
| Req 11: Notifications             | Covered inline in all scenarios above |
| Edge Cases                        | UAT-SVC-49 through UAT-SVC-55         |

---

## 3. UAT Scenarios — Req 1: Service Listing Creation

### UAT-SVC-01: Provider without Stripe Connect cannot create a listing

- **Actor:** Resident (no Stripe Connected Account)
- **Requirement:** 1.4
- **Preconditions:** User is logged in; user has NOT completed Stripe Connect onboarding.
- **Steps:**
  1. Navigate to `/dashboard/services/listings/create`.
  2. Verify the listing creation form is NOT rendered.
  3. Verify a prompt is shown to complete Stripe Connect onboarding (with a link or CTA).
- **Expected results:**
  - Form is blocked; user sees onboarding prompt.
  - No listing is created.
- [x] Pass / [ ] Fail

---

### UAT-SVC-02: Provider creates a valid fixed-price listing

- **Actor:** Resident (with active Stripe Connected Account)
- **Requirement:** 1.1, 1.2, 1.5
- **Preconditions:** User has an active Stripe Connected Account; at least one service category exists.
- **Steps:**
  1. Navigate to `/dashboard/services/listings/create`.
  2. Fill in: title ("Drain Unclogging"), category (select from dropdown), pricing type (Fixed), price ($75), description, optional service notes.
  3. Submit the form.
  4. Verify a confirmation state is shown: "Your listing has been submitted for review. You'll be notified when it's approved."
  5. Verify the listing does NOT appear in the browse page (`/dashboard/services`).
  6. Verify admin receives a notification that a new listing is pending review.
- **Expected results:**
  - Listing created with `status: pending_approval`.
  - Not visible to other residents.
  - Admin notified.
- [x] Pass / [ ] Fail

---

### UAT-SVC-03: Provider creates a valid hourly listing

- **Actor:** Resident (with active Stripe Connected Account)
- **Requirement:** 1.2
- **Preconditions:** User has an active Stripe Connected Account.
- **Steps:**
  1. Navigate to `/dashboard/services/listings/create`.
  2. Fill in all required fields; select pricing type "Hourly" and enter a rate per hour.
  3. Submit the form.
  4. Verify the listing is created with `status: pending_approval`.
- **Expected results:**
  - Hourly listing created; pricing type and rate stored correctly.
- [x] Pass / [ ] Fail

---

### UAT-SVC-04: Provider edits their listing

- **Actor:** Resident (listing owner)
- **Requirement:** 1.6
- **Preconditions:** Provider has an existing listing (any status).
- **Steps:**
  1. Navigate to `/dashboard/services/listings/[id]/edit`.
  2. Update the title and description.
  3. Save changes.
  4. Verify updated fields are reflected on the listing detail page.
  5. Verify the listing status is unchanged (no re-approval triggered).
- **Expected results:**
  - Listing fields updated; no status change; no re-approval notification sent.
- [x] Pass / [ ] Fail

---

### UAT-SVC-05: Provider deactivates their listing

- **Actor:** Resident (listing owner)
- **Requirement:** 1.7
- **Preconditions:** Provider has an active listing.
- **Steps:**
  1. Navigate to `/dashboard/services/listings/[id]/edit`.
  2. Click the Deactivate button and confirm.
  3. Verify the listing no longer appears on the browse page (`/dashboard/services`).
  4. Verify the listing detail page shows `status: inactive`.
- **Expected results:**
  - Listing removed from browse; status becomes `inactive`.
- [x] Pass / [ ] Fail

---

## 4. UAT Scenarios — Req 2: Admin Listing Approval

### UAT-SVC-06: Admin approves a pending listing

- **Actor:** Admin
- **Requirement:** 2.2, 2.4
- **Preconditions:** A listing with `status: pending_approval` exists; admin is logged in.
- **Steps:**
  1. Navigate to `/admin/dashboard/services/listings/review`.
  2. Verify the pending listing appears in the queue with provider name, title, category, price, and submitted date.
  3. Click Approve; optionally enter an internal note.
  4. Confirm the action.
  5. Verify the listing status becomes `active`.
  6. Verify the listing now appears on the browse page for HOA members.
  7. Verify the provider receives a notification: listing approved.
- **Expected results:**
  - Listing active; visible to residents; provider notified.
- [x] Pass / [ ] Fail

---

### UAT-SVC-07: Admin rejects a pending listing — reason required

- **Actor:** Admin
- **Requirement:** 2.3
- **Preconditions:** A listing with `status: pending_approval` exists.
- **Steps:**
  1. Navigate to the admin listing review queue.
  2. Click Reject without entering a reason.
  3. Verify the form does not submit; error is shown ("Reason is required").
- **Expected results:**
  - Rejection blocked without a reason.
- [x] Pass / [ ] Fail

---

### UAT-SVC-08: Admin rejects a pending listing with a reason

- **Actor:** Admin
- **Requirement:** 2.3, 2.5
- **Preconditions:** A listing with `status: pending_approval` exists.
- **Steps:**
  1. Navigate to the admin listing review queue.
  2. Click Reject; enter reason "Service not HOA-related".
  3. Confirm the action.
  4. Verify the listing status becomes `denied`.
  5. Verify the listing does NOT appear on the browse page.
  6. Verify the provider receives a notification: listing denied with the reason text.
- **Expected results:**
  - Listing denied; not visible; provider notified with reason.
- [x] Pass / [ ] Fail

---

### UAT-SVC-09: Admin review queue shows empty state

- **Actor:** Admin
- **Requirement:** 2.1
- **Preconditions:** No listings with `status: pending_approval` exist.
- **Steps:**
  1. Navigate to `/admin/dashboard/services/listings/review`.
  2. Verify the empty state message is shown: "No listings pending review".
- **Expected results:**
  - Empty state displayed; no listing rows.
- [x] Pass / [ ] Fail

---

## 5. UAT Scenarios — Req 3: Service Discovery & Browse

### UAT-SVC-10: Resident browses active listings for their HOA

- **Actor:** Resident (requester)
- **Requirement:** 3.1, 3.3
- **Preconditions:** At least 2 active listings exist within the user's community; user is logged in.
- **Steps:**
  1. Navigate to `/dashboard/services`.
  2. Verify listing cards are shown; each card displays: title, provider name, provider photo, pricing type and price, aggregate star rating (or "New" if no reviews).
  3. Verify listings from other communities are NOT shown.
- **Expected results:**
  - Correct listings shown; cross-community listings absent.
- [x] Pass / [ ] Fail

---

### UAT-SVC-11: Resident filters listings by category

- **Actor:** Resident
- **Requirement:** 3.2
- **Preconditions:** Active listings exist across at least 2 categories.
- **Steps:**
  1. Navigate to `/dashboard/services`.
  2. Click a category tab (e.g. "Plumbing").
  3. Verify only listings in the selected category are shown.
  4. Click a different category; verify the grid updates.
- **Expected results:**
  - Grid filters correctly by category.
- [x] Pass / [ ] Fail

---

### UAT-SVC-12: Resident views listing detail page

- **Actor:** Resident
- **Requirement:** 3.4
- **Preconditions:** An active listing with reviews exists.
- **Steps:**
  1. From the browse page, click a listing card.
  2. Verify the detail page shows: title, full description, service notes, photo gallery, provider summary (avatar + name + rating → links to provider profile), reviews section, and a booking CTA.
- **Expected results:**
  - All content rendered; booking CTA visible.
- [x] Pass / [ ] Fail

---

### UAT-SVC-13: Provider views their own listing detail — no booking CTA

- **Actor:** Resident (listing owner)
- **Requirement:** 3.5
- **Preconditions:** Provider navigates to their own listing detail page.
- **Steps:**
  1. As the listing provider, navigate to the listing detail page.
  2. Verify the booking CTA is hidden.
  3. Verify a label "This is your listing" is shown instead.
- **Expected results:**
  - Booking CTA absent for listing owner.
- [x] Pass / [ ] Fail

---

## 6. UAT Scenarios — Req 4: Booking Request

### UAT-SVC-14: Resident submits a valid booking request for a fixed listing

- **Actor:** Resident (requester)
- **Requirement:** 4.1, 4.2, 4.5, 4.6, 4.8
- **Preconditions:** Active fixed-price listing exists by another provider; requester has a saved payment method.
- **Steps:**
  1. Navigate to the listing detail page; click the booking CTA.
  2. Step 1 — Details: enter a proposed date, proposed time, and optional notes.
  3. Step 2 — Summary: verify the price breakdown shows listing price + service fee = total.
  4. Step 3 — Confirm: submit the request.
  5. Verify redirect to the booking detail page with a confirmation banner.
  6. Verify booking status is `pending`.
  7. Verify the provider receives a notification: new booking request.
  8. Verify no Stripe charge is created.
- **Expected results:**
  - Booking created with `status: pending`; no payment captured; provider notified.
- [x] Pass / [ ] Fail

---

### UAT-SVC-15: Resident submits a valid booking request for an hourly listing

- **Actor:** Resident (requester)
- **Requirement:** 4.4
- **Preconditions:** Active hourly listing exists by another provider; requester has a saved payment method.
- **Steps:**
  1. Navigate to the listing detail page and start the booking flow.
  2. In Step 1, enter a proposed date, time, and number of hours (e.g. 3).
  3. In Step 2, verify the price breakdown: rate × 3 + service fee = total.
  4. Submit and verify booking is created with `status: pending`.
- **Expected results:**
  - Hourly total calculated correctly; booking created.
- [x] Pass / [ ] Fail

---

### UAT-SVC-16: Resident with no payment method attempts to book

- **Actor:** Resident (no saved payment method)
- **Requirement:** 4 (edge case from requirements)
- **Preconditions:** User has no saved payment method on file.
- **Steps:**
  1. Navigate to a listing detail page.
  2. Click the booking CTA.
  3. Verify a prompt is shown to add a payment method before proceeding.
  4. Verify the booking form is not accessible without a payment method.
- **Expected results:**
  - Booking blocked; user prompted to add a payment method.
- [x] Pass / [ ] Fail

---

### UAT-SVC-17: Resident attempts to book their own listing

- **Actor:** Resident (listing owner)
- **Requirement:** 4.7
- **Preconditions:** Resident has an active listing.
- **Steps:**
  1. As the listing provider, navigate to the booking flow for their own listing.
  2. Attempt to submit a booking request.
  3. Verify the system rejects the request with an error.
- **Expected results:**
  - Booking rejected; error "cannot book your own listing" shown.
- [x] Pass / [ ] Fail

---

### UAT-SVC-18: Booking appears in requester's My Bookings — Booked tab

- **Actor:** Resident (requester)
- **Requirement:** 4.1
- **Preconditions:** Requester has submitted at least one booking request.
- **Steps:**
  1. Navigate to `/dashboard/services/bookings`.
  2. Click the "Booked" tab.
  3. Verify the booking card shows: provider name, listing title, proposed date, status badge "Pending".
- **Expected results:**
  - Booking visible in Booked tab with correct data.
- [x] Pass / [ ] Fail

---

## 7. UAT Scenarios — Req 5: Provider Booking Response

### UAT-SVC-19: Provider accepts a booking — payment succeeds

- **Actor:** Provider, Requester (receives notification)
- **Requirement:** 5.1, 5.2
- **Preconditions:** A pending booking exists; requester has a valid payment method (Stripe test card `4242 4242 4242 4242`).
- **Steps:**
  1. As provider, navigate to `/dashboard/services/bookings` and open the booking detail.
  2. Click Accept.
  3. Verify the booking status becomes `accepted`.
  4. Verify in Stripe Dashboard: a PaymentIntent was created and charged; the charge has no `transfer_data`.
  5. Verify the requester receives a notification: booking accepted with payment confirmation.
- **Expected results:**
  - Booking `accepted`; charge captured; no transfer_data; requester notified.
- [x] Pass / [ ] Fail

---

### UAT-SVC-20: Provider accepts a booking — payment fails

- **Actor:** Provider, Requester
- **Requirement:** 5.3
- **Preconditions:** A pending booking exists; requester has a declining payment method (Stripe test card `4000 0000 0000 9995` — insufficient funds).
- **Steps:**
  1. As provider, open the booking detail and click Accept.
  2. Verify the booking status becomes `payment_failed`.
  3. Verify both parties receive a payment failure notification.
  4. Verify no Stripe charge is captured.
- **Expected results:**
  - Status `payment_failed`; no charge; both parties notified.
- [x] Pass / [ ] Fail

---

### UAT-SVC-21: Provider declines a booking — reason required

- **Actor:** Provider
- **Requirement:** 5.5
- **Preconditions:** A pending booking exists.
- **Steps:**
  1. As provider, open the booking detail and click Decline.
  2. Submit the decline dialog without entering a reason.
  3. Verify the form does not submit; error is shown ("Reason is required").
- **Expected results:**
  - Decline blocked without a reason.
- [x] Pass / [ ] Fail

---

### UAT-SVC-22: Provider declines a booking with a reason

- **Actor:** Provider, Requester
- **Requirement:** 5.4
- **Preconditions:** A pending booking exists.
- **Steps:**
  1. As provider, click Decline; enter reason "Not available on that date".
  2. Confirm the decline.
  3. Verify booking status becomes `declined`.
  4. Verify the requester receives a notification: booking declined with the provider's reason.
  5. Verify no payment is taken.
- **Expected results:**
  - Status `declined`; reason stored; requester notified; no charge.
- [x] Pass / [ ] Fail

---

### UAT-SVC-23: Booking appears in provider's My Bookings — Providing tab

- **Actor:** Provider
- **Requirement:** 5.1
- **Preconditions:** Provider has at least one incoming booking.
- **Steps:**
  1. Navigate to `/dashboard/services/bookings` as the provider.
  2. Click the "Providing" tab.
  3. Verify the booking card shows: requester name, listing title, proposed date, status badge.
- **Expected results:**
  - Booking visible in Providing tab with correct data.
- [x] Pass / [ ] Fail

---

## 8. UAT Scenarios — Req 6: Payment Processing

### UAT-SVC-24: Payment at acceptance — no transfer_data on PaymentIntent

- **Actor:** System (Stripe verification)
- **Requirement:** 6.4
- **Preconditions:** An accepted booking with a captured charge.
- **Steps:**
  1. In Stripe Dashboard, locate the PaymentIntent created at booking acceptance.
  2. Verify the PaymentIntent has no `transfer_data` field.
  3. Verify the charge is held in the platform account.
- **Expected results:**
  - No `transfer_data`; funds in platform account.
- [x] Pass / [ ] Fail

---

### UAT-SVC-25: Payment metadata is correct

- **Actor:** System (Stripe verification)
- **Requirement:** 6.5
- **Preconditions:** An accepted booking with a captured charge.
- **Steps:**
  1. In Stripe Dashboard, open the PaymentIntent.
  2. Verify metadata includes: `paymentType: service_charge`, `bookingId`, `serviceId`, `providerId`, `requesterId`.
- **Expected results:**
  - All metadata fields present and correct.
- [x] Pass / [ ] Fail

---

### UAT-SVC-26: Idempotency — duplicate acceptance attempt does not double-charge

- **Actor:** System
- **Requirement:** 6.7
- **Preconditions:** A booking has already been accepted (charge captured).
- **Steps:**
  1. Attempt to accept the same booking again (e.g. duplicate button click or repeated API call).
  2. Verify the system rejects the action (status is already `accepted`).
  3. Verify Stripe shows only one PaymentIntent for this booking.
- **Expected results:**
  - No duplicate charge; second acceptance rejected.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-27: Fixed vs. hourly charge amount verification

- **Actor:** Requester, System
- **Requirement:** 6.2, 6.3
- **Preconditions:** One accepted booking for a fixed listing ($75); one for an hourly listing ($40/hr × 3hrs).
- **Steps:**
  1. For the fixed listing: verify Stripe charge = $75 + `calculateServiceFee($75)`.
  2. For the hourly listing: verify Stripe charge = ($40 × 3) + `calculateServiceFee($120)` = $120 + service fee.
- **Expected results:**
  - Charge amounts match expected calculations for each pricing type.
- [x] Pass / [ ] Fail

---

## 9. UAT Scenarios — Req 7: Job Completion & Payout

### UAT-SVC-28: Provider marks job complete

- **Actor:** Provider, Requester (receives notification)
- **Requirement:** 7.1, 7.10
- **Preconditions:** An accepted booking.
- **Steps:**
  1. As provider, open the booking detail; click Mark Complete.
  2. Confirm the dialog prompt.
  3. Verify booking status becomes `completed`.
  4. Verify `completedAt` is recorded.
  5. Verify `payoutStatus` is `pending`.
  6. Verify the requester receives a notification: job marked as complete.
  7. Verify no Stripe transfer is created at this moment.
- **Expected results:**
  - Status `completed`; payout deferred; requester notified immediately.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-29: Payout cron does not process booking completed less than 24 hours ago

- **Actor:** System
- **Requirement:** 7.2, 7.3
- **Preconditions:** A booking was marked complete less than 24 hours ago; `payoutStatus: pending`.
- **Steps:**
  1. Trigger GET `/api/cron/process-service-payouts` with a valid `CRON_SECRET`.
  2. Verify the booking is NOT processed; `payoutStatus` remains `pending`.
  3. Verify no Stripe transfer is created for this booking.
- **Expected results:**
  - Booking skipped by cron; payout window not yet closed.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-30: Payout cron processes eligible booking — transfer succeeds

- **Actor:** System, Provider (receives notification)
- **Requirement:** 7.3, 7.4, 7.5, 7.6, 7.7
- **Preconditions:** A booking with `completedAt` > 24 hours ago; `payoutStatus: pending`; provider has active Stripe Connect account.
- **Steps:**
  1. Trigger GET `/api/cron/process-service-payouts` with a valid `CRON_SECRET`.
  2. Verify the cron response includes `successCount: 1`.
  3. In Stripe Dashboard: verify a Transfer was created with:
     - `source_transaction` = the Charge ID from the booking acceptance
     - `destination` = provider's Connected Account ID
     - `amount` = (servicePrice - 20% platform fee) in cents
  4. Verify `payoutStatus` becomes `completed`; `stripeTransferId` and `ownerTransferredAt` are set.
  5. Verify the provider receives a notification: payout sent.
- **Expected results:**
  - Transfer created with correct amount; payout complete; provider notified.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-31: Payout amount — platform fee deducted correctly

- **Actor:** System (Stripe verification)
- **Requirement:** 7.4, 7.5
- **Preconditions:** An eligible booking with `servicePrice: $100.00` (20% platform fee expected).
- **Steps:**
  1. After payout cron runs, open the Stripe Transfer in the Dashboard.
  2. Verify transfer amount = $80.00 (8000 cents) — $100 minus 20% platform fee.
  3. Verify the service fee (requester pass-through) is NOT included in the transfer amount.
- **Expected results:**
  - Transfer = `servicePrice × (1 − 0.20)`; service fee excluded.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-32: Payout cron — transfer fails, ops alerted

- **Actor:** System, Ops
- **Requirement:** 7.8
- **Preconditions:** An eligible booking for payout; provider's Stripe Connected Account is deactivated or will cause transfer failure (simulate via test environment flag or invalid account).
- **Steps:**
  1. Trigger the payout cron.
  2. Verify the cron response includes `failureCount: 1`.
  3. Verify `payoutStatus` becomes `failed`.
  4. Verify ops receives an alert email (OPS_ALERT_EMAIL) with the bookingId and error details.
  5. Verify the booking status remains `completed` — the job was done.
  6. Verify the provider does NOT receive a payout notification.
- **Expected results:**
  - `payoutStatus: failed`; ops alerted; booking stays `completed`.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-33: Payout cron — concurrent runs do not double-transfer

- **Actor:** System
- **Requirement:** 7.11
- **Preconditions:** One eligible booking for payout.
- **Steps:**
  1. Trigger the payout cron twice in rapid succession (two simultaneous requests).
  2. Verify Stripe shows only ONE transfer for this booking.
  3. Verify `payoutStatus` is `completed` (not processed twice).
- **Expected results:**
  - Atomic claim prevents double-transfer; exactly one Stripe transfer created.
- [ ] Pass / [ ] Fail

---

## 10. UAT Scenarios — Req 8: Cancellations & Refunds

### UAT-SVC-34: Requester cancels a pending booking (no charge)

- **Actor:** Requester
- **Requirement:** 8 (cancellation on pending)
- **Preconditions:** A pending booking (no payment captured yet).
- **Steps:**
  1. As requester, open the booking detail and click Cancel.
  2. Confirm the cancellation.
  3. Verify booking status becomes `cancelled`.
  4. Verify no Stripe refund is issued (no charge was ever taken).
- **Expected results:**
  - Booking cancelled; no refund action needed; both parties notified.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-35: Requester cancels an accepted booking — more than 24 hours before proposed date

- **Actor:** Requester
- **Requirement:** 8.1, 8.4
- **Preconditions:** An accepted booking with `proposedDate` more than 24 hours from now; charge has been captured.
- **Steps:**
  1. As requester, open the booking detail; click Cancel.
  2. Verify the cancel dialog shows the applicable refund tier: "Full refund — your proposed date is more than 24 hours away."
  3. Confirm the cancellation.
  4. Verify booking status becomes `cancelled`.
  5. Verify a full refund is issued on the original charge in Stripe.
  6. Verify `refundAmount` = full `totalAmount`; `stripeRefundId` stored.
  7. Verify both parties receive a cancellation notification with refund details.
- **Expected results:**
  - Full refund; both notified.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-36: Requester cancels an accepted booking — within 24 hours of proposed date

- **Actor:** Requester
- **Requirement:** 8.2, 8.4
- **Preconditions:** An accepted booking with `proposedDate` less than 24 hours from now.
- **Steps:**
  1. As requester, open the booking detail; click Cancel.
  2. Verify the cancel dialog shows the applicable refund tier: "50% refund — your proposed date is within 24 hours."
  3. Confirm the cancellation.
  4. Verify booking status becomes `cancelled`.
  5. Verify a 50% partial refund is issued on the original charge in Stripe.
  6. Verify `refundAmount` = 50% of `totalAmount`; `stripeRefundId` stored.
  7. Verify both parties receive a cancellation notification.
- **Expected results:**
  - 50% refund; both notified.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-37: Provider cancels an accepted booking — full refund regardless of timing

- **Actor:** Provider
- **Requirement:** 8.3, 8.4
- **Preconditions:** An accepted booking with `proposedDate` within 24 hours of now (tests that provider always gets full refund).
- **Steps:**
  1. As provider, open the booking detail; click Cancel.
  2. Verify the cancel dialog shows: "You are cancelling — full refund will be issued to the requester."
  3. Confirm the cancellation.
  4. Verify a full 100% refund is issued via Stripe regardless of timing.
  5. Verify `refundAmount` = full `totalAmount`.
  6. Verify both parties receive a cancellation notification.
- **Expected results:**
  - Full refund on provider-initiated cancellation; both notified.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-38: Cancelled booking is read-only — refund amount shown

- **Actor:** Requester or Provider
- **Requirement:** 8.1–8.4
- **Preconditions:** A cancelled booking with a refund issued.
- **Steps:**
  1. Navigate to the booking detail for a cancelled booking.
  2. Verify the booking is read-only — no action buttons (Accept, Decline, Cancel, Complete).
  3. Verify the refund amount is displayed on the detail page.
- **Expected results:**
  - Read-only state; refund amount shown.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-39: Either party files a no-show report

- **Actor:** Requester or Provider
- **Requirement:** 8.5, 8.6, 8.9
- **Preconditions:** An accepted booking.
- **Steps:**
  1. As requester, open the booking detail; click Report No-Show and optionally enter notes.
  2. Confirm the report.
  3. Verify a success message is shown.
  4. Verify booking status remains `accepted` (unchanged).
  5. Verify admin receives a notification: no-show report filed.
  6. Verify no Stripe refund is issued automatically.
- **Expected results:**
  - Report created; admin alerted; no automatic refund; booking status unchanged.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-40: No-show report — booking detail shows report filed

- **Actor:** Requester and Provider
- **Requirement:** 8.6
- **Preconditions:** A no-show report has been filed for a booking.
- **Steps:**
  1. Both requester and provider view the booking detail page.
  2. Verify the no-show report is displayed (or indicated) on the detail page.
- **Expected results:**
  - No-show report surfaced to both parties; awaiting admin review.
- [ ] Pass / [ ] Fail

---

## 11. UAT Scenarios — Req 9: Mutual Reviews

### UAT-SVC-41: Requester leaves a review after an accepted booking

- **Actor:** Requester
- **Requirement:** 9.1, 9.2, 9.5
- **Preconditions:** A booking with `status: accepted` or beyond.
- **Steps:**
  1. Navigate to the booking detail page.
  2. Verify the Leave Review section is shown (star rating + optional comment).
  3. Select 4 stars and enter a comment.
  4. Submit the review.
  5. Verify the submitted review replaces the form inline.
  6. Verify the provider's aggregate rating is updated on their profile page.
- **Expected results:**
  - Review created; aggregate rating updated.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-42: Provider leaves a review for the requester

- **Actor:** Provider
- **Requirement:** 9.1, 9.2
- **Preconditions:** Same booking as above; provider has not yet reviewed.
- **Steps:**
  1. As provider, open the booking detail.
  2. Leave a 5-star review for the requester.
  3. Verify the review is submitted successfully.
  4. Verify both reviews are visible for this booking.
- **Expected results:**
  - Both parties can each submit one review; two reviews total for booking.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-43: Duplicate review from same party is rejected

- **Actor:** Requester
- **Requirement:** 9.3
- **Preconditions:** Requester has already submitted a review for the booking.
- **Steps:**
  1. As requester, attempt to submit a second review for the same booking.
  2. Verify the system rejects the submission with error "review already submitted".
  3. Verify no duplicate review record is created.
- **Expected results:**
  - Second review rejected with 409; only one review per party per booking.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-44: Reviews appear on listing detail page

- **Actor:** Any resident
- **Requirement:** 9.6
- **Preconditions:** At least one review has been submitted for a listing.
- **Steps:**
  1. Navigate to the listing detail page.
  2. Verify the reviews section shows submitted reviews including reviewer name, rating, and comment.
- **Expected results:**
  - Reviews displayed on listing detail.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-45: Provider aggregate rating displays on provider profile

- **Actor:** Any resident
- **Requirement:** 9.7
- **Preconditions:** A provider has received at least two reviews across different bookings.
- **Steps:**
  1. Navigate to the provider's profile at `/dashboard/services/providers/[userId]`.
  2. Verify the aggregate star rating and review count are displayed correctly.
  3. Verify the rating reflects the average of all reviews for that provider.
- **Expected results:**
  - Correct average rating and review count shown.
- [ ] Pass / [ ] Fail

---

## 12. UAT Scenarios — Req 10: Provider Profile

### UAT-SVC-46: Resident views a provider profile

- **Actor:** Resident (requester)
- **Requirement:** 10.1, 10.4
- **Preconditions:** A provider exists with a bio, active listings, and received reviews.
- **Steps:**
  1. From a listing detail page, click the provider's name/avatar.
  2. Verify the profile shows: name, photo, bio, aggregate star rating, review count.
  3. Verify the provider's active listings are displayed in a grid.
  4. Verify all reviews where the provider is the reviewee are listed.
- **Expected results:**
  - Full profile rendered with bio, rating, listings, and reviews.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-47: Provider with no reviews — "No reviews yet" shown

- **Actor:** Any resident
- **Requirement:** 10.4
- **Preconditions:** Provider has no submitted reviews.
- **Steps:**
  1. Navigate to the provider's profile.
  2. Verify the profile displays "No reviews yet" rather than a numeric rating.
- **Expected results:**
  - "No reviews yet" shown; no empty star display.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-48: Provider edits their bio

- **Actor:** Provider
- **Requirement:** 10.2
- **Preconditions:** Provider is viewing their own profile.
- **Steps:**
  1. Navigate to `/dashboard/services/providers/[userId]` as the provider.
  2. Click the bio edit control and update the bio text.
  3. Save changes.
  4. Verify the updated bio is displayed on the profile page.
  5. Verify a different user cannot edit the bio (edit control not shown for non-owner).
- **Expected results:**
  - Bio updated by provider; not editable by others.
- [ ] Pass / [ ] Fail

---

## 13. UAT Scenarios — Edge Cases

### UAT-SVC-49: HOA isolation — resident cannot see listings from another community

- **Actor:** Resident
- **Requirement:** 3.1, Non-Functional Security
- **Preconditions:** Active listings exist in at least two different communities.
- **Steps:**
  1. Log in as a resident of Community A.
  2. Navigate to `/dashboard/services`.
  3. Verify only listings from Community A are shown; Community B listings are absent.
  4. Attempt to access a listing from Community B via direct URL (`/dashboard/services/listings/[id]`).
  5. Verify a 404 or redirect is returned.
- **Expected results:**
  - Strict HOA scoping; cross-community access blocked.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-50: Booking request — hourly listing requires hours field

- **Actor:** Requester
- **Requirement:** 4.4
- **Preconditions:** An active hourly listing.
- **Steps:**
  1. Begin the booking flow for an hourly listing.
  2. In Step 1, omit the hours field and attempt to proceed.
  3. Verify validation error: "Number of hours is required."
- **Expected results:**
  - Form validation prevents submission without hours on hourly listings.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-51: Payment capture retry on transient Stripe error

- **Actor:** System
- **Requirement:** 6 (error handling)
- **Preconditions:** Ability to simulate a retryable Stripe error (rate limit / API error) on the first payment attempt.
- **Steps:**
  1. Trigger booking acceptance with a retryable Stripe error on the first call.
  2. Verify the system retries once.
  3. If the retry succeeds, verify the booking status becomes `accepted`.
  4. Verify only one charge is created (no duplicates).
- **Expected results:**
  - One retry; no duplicate charge; booking accepted on success.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-52: Cron endpoint rejects requests without CRON_SECRET

- **Actor:** System (security)
- **Requirement:** Non-Functional Security
- **Preconditions:** Payout cron endpoint is deployed.
- **Steps:**
  1. Call `GET /api/cron/process-service-payouts` without an Authorization header.
  2. Verify the response is 401 Unauthorized.
  3. Call with an incorrect secret; verify 401.
  4. Call with the correct `CRON_SECRET`; verify 200.
- **Expected results:**
  - Unauthorized requests rejected; correct secret accepted.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-53: Declined booking — read-only detail with reason shown

- **Actor:** Requester
- **Requirement:** 5.4
- **Preconditions:** A booking with `status: declined`.
- **Steps:**
  1. As requester, navigate to the declined booking detail page.
  2. Verify the booking is read-only — no action buttons.
  3. Verify the provider's decline reason is displayed.
- **Expected results:**
  - Decline reason shown; no actions available.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-54: Payment_failed booking — both parties see appropriate state

- **Actor:** Requester and Provider
- **Requirement:** 5.3
- **Preconditions:** A booking with `status: payment_failed`.
- **Steps:**
  1. As requester, open the booking detail. Verify a prompt to update their payment method is shown.
  2. As provider, open the booking detail. Verify the payment failure is indicated and they may re-accept after the requester resolves payment.
- **Expected results:**
  - Both parties see contextual UI for `payment_failed` state.
- [ ] Pass / [ ] Fail

---

### UAT-SVC-55: Services nav link available in dashboard

- **Actor:** Any resident
- **Requirement:** Presentation layer
- **Preconditions:** User is logged in.
- **Steps:**
  1. Log in and navigate to any dashboard page.
  2. Verify a "Services" link is visible in the dashboard navigation.
  3. Click the link; verify it navigates to `/dashboard/services`.
  4. Verify the active state is applied to the link on any `/dashboard/services/*` route.
- **Expected results:**
  - Services nav link present and functional.
- [ ] Pass / [ ] Fail

---

## 14. Pass/Fail Summary

| Scenario ID | Description                                              | Result              |
| ----------- | -------------------------------------------------------- | ------------------- |
| UAT-SVC-01  | Provider without Stripe Connect blocked from listing     | [ ] Pass / [ ] Fail |
| UAT-SVC-02  | Provider creates fixed-price listing                     | [ ] Pass / [ ] Fail |
| UAT-SVC-03  | Provider creates hourly listing                          | [ ] Pass / [ ] Fail |
| UAT-SVC-04  | Provider edits their listing                             | [ ] Pass / [ ] Fail |
| UAT-SVC-05  | Provider deactivates their listing                       | [ ] Pass / [ ] Fail |
| UAT-SVC-06  | Admin approves a pending listing                         | [ ] Pass / [ ] Fail |
| UAT-SVC-07  | Admin rejects listing — reason required                  | [ ] Pass / [ ] Fail |
| UAT-SVC-08  | Admin rejects listing with reason                        | [ ] Pass / [ ] Fail |
| UAT-SVC-09  | Admin review queue empty state                           | [ ] Pass / [ ] Fail |
| UAT-SVC-10  | Resident browses active listings for their HOA           | [ ] Pass / [ ] Fail |
| UAT-SVC-11  | Resident filters listings by category                    | [ ] Pass / [ ] Fail |
| UAT-SVC-12  | Resident views listing detail page                       | [ ] Pass / [ ] Fail |
| UAT-SVC-13  | Provider views own listing — no booking CTA              | [ ] Pass / [ ] Fail |
| UAT-SVC-14  | Submit valid booking request — fixed listing             | [ ] Pass / [ ] Fail |
| UAT-SVC-15  | Submit valid booking request — hourly listing            | [ ] Pass / [ ] Fail |
| UAT-SVC-16  | Requester with no payment method blocked from booking    | [ ] Pass / [ ] Fail |
| UAT-SVC-17  | Resident cannot book their own listing                   | [ ] Pass / [ ] Fail |
| UAT-SVC-18  | Booking appears in My Bookings — Booked tab              | [ ] Pass / [ ] Fail |
| UAT-SVC-19  | Provider accepts booking — payment succeeds              | [ ] Pass / [ ] Fail |
| UAT-SVC-20  | Provider accepts booking — payment fails                 | [ ] Pass / [ ] Fail |
| UAT-SVC-21  | Provider declines booking — reason required              | [ ] Pass / [ ] Fail |
| UAT-SVC-22  | Provider declines booking with reason                    | [ ] Pass / [ ] Fail |
| UAT-SVC-23  | Booking appears in My Bookings — Providing tab           | [ ] Pass / [ ] Fail |
| UAT-SVC-24  | No transfer_data on PaymentIntent                        | [ ] Pass / [ ] Fail |
| UAT-SVC-25  | Payment metadata is correct                              | [ ] Pass / [ ] Fail |
| UAT-SVC-26  | Duplicate acceptance does not double-charge              | [ ] Pass / [ ] Fail |
| UAT-SVC-27  | Fixed vs. hourly charge amount verification              | [ ] Pass / [ ] Fail |
| UAT-SVC-28  | Provider marks job complete                              | [ ] Pass / [ ] Fail |
| UAT-SVC-29  | Cron skips booking completed < 24 hours ago              | [ ] Pass / [ ] Fail |
| UAT-SVC-30  | Cron processes eligible booking — transfer succeeds      | [ ] Pass / [ ] Fail |
| UAT-SVC-31  | Payout amount — 20% platform fee deducted correctly      | [ ] Pass / [ ] Fail |
| UAT-SVC-32  | Payout transfer fails — ops alerted                      | [ ] Pass / [ ] Fail |
| UAT-SVC-33  | Concurrent cron runs — no double-transfer                | [ ] Pass / [ ] Fail |
| UAT-SVC-34  | Requester cancels a pending booking (no charge)          | [ ] Pass / [ ] Fail |
| UAT-SVC-35  | Requester cancels accepted booking > 24hrs — full refund | [ ] Pass / [ ] Fail |
| UAT-SVC-36  | Requester cancels accepted booking ≤ 24hrs — 50% refund  | [ ] Pass / [ ] Fail |
| UAT-SVC-37  | Provider cancels accepted booking — full refund          | [ ] Pass / [ ] Fail |
| UAT-SVC-38  | Cancelled booking is read-only; refund shown             | [ ] Pass / [ ] Fail |
| UAT-SVC-39  | Either party files a no-show report                      | [ ] Pass / [ ] Fail |
| UAT-SVC-40  | No-show report shows on booking detail                   | [ ] Pass / [ ] Fail |
| UAT-SVC-41  | Requester leaves a review                                | [ ] Pass / [ ] Fail |
| UAT-SVC-42  | Provider leaves a review                                 | [ ] Pass / [ ] Fail |
| UAT-SVC-43  | Duplicate review rejected                                | [ ] Pass / [ ] Fail |
| UAT-SVC-44  | Reviews appear on listing detail page                    | [ ] Pass / [ ] Fail |
| UAT-SVC-45  | Provider aggregate rating on profile                     | [ ] Pass / [ ] Fail |
| UAT-SVC-46  | Resident views provider profile                          | [ ] Pass / [ ] Fail |
| UAT-SVC-47  | Provider with no reviews — "No reviews yet"              | [ ] Pass / [ ] Fail |
| UAT-SVC-48  | Provider edits their bio                                 | [ ] Pass / [ ] Fail |
| UAT-SVC-49  | HOA isolation — no cross-community listing access        | [ ] Pass / [ ] Fail |
| UAT-SVC-50  | Hourly listing requires hours field                      | [ ] Pass / [ ] Fail |
| UAT-SVC-51  | Payment capture retry on transient Stripe error          | [ ] Pass / [ ] Fail |
| UAT-SVC-52  | Cron endpoint rejects requests without CRON_SECRET       | [ ] Pass / [ ] Fail |
| UAT-SVC-53  | Declined booking read-only with reason                   | [ ] Pass / [ ] Fail |
| UAT-SVC-54  | payment_failed booking — both parties see correct state  | [ ] Pass / [ ] Fail |
| UAT-SVC-55  | Services nav link in dashboard                           | [ ] Pass / [ ] Fail |

---

## 15. Test Data Requirements

### Stripe Test Cards

| Card Number           | Behavior                      | Use In UAT Scenarios                  |
| --------------------- | ----------------------------- | ------------------------------------- |
| `4242 4242 4242 4242` | Always succeeds               | UAT-SVC-19, UAT-SVC-30, UAT-SVC-35–37 |
| `4000 0000 0000 9995` | Declines (insufficient funds) | UAT-SVC-20                            |
| `4000 0000 0000 0002` | Always declines               | Alternative for UAT-SVC-20            |

### Seeded Test Data Required

- At least 2 service categories (e.g. "Plumbing", "Landscaping")
- At least 2 test communities (for HOA isolation tests — UAT-SVC-49)
- 2 test providers with active Stripe Connected Accounts (test mode)
- 1 test resident with a saved payment method
- 1 test admin account

### Environment Variables Required

| Variable          | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `CRON_SECRET`     | Required for UAT-SVC-29, UAT-SVC-30, UAT-SVC-32, UAT-SVC-33, UAT-SVC-52 |
| `OPS_ALERT_EMAIL` | Required for UAT-SVC-32 ops alert verification                          |

---

## 16. Test Environment

- **Environment:** Staging (connected to Stripe test mode)
- **Stripe mode:** Test mode only — no real charges
- **Pre-flight checks before UAT:**
  - [ ] Stripe Connect onboarding working in test mode
  - [ ] `CRON_SECRET` configured in environment
  - [ ] `OPS_ALERT_EMAIL` configured and receiving test emails
  - [ ] At least 2 service categories seeded in database
  - [ ] GitHub Actions cron workflow deployed (or cron endpoint manually triggerable)

---

## 17. Sign-off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Product Owner    |      |      |           |
| QA Lead          |      |      |           |
| Engineering Lead |      |      |           |

---

_Last updated: March 21, 2026 | Internal use only_
