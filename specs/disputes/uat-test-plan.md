# Disputes — User Acceptance Test (UAT) Plan

Hoador • Internal Specification

---

## 1. Introduction

This document defines **User Acceptance Test (UAT)** scenarios for the Disputes feature, covering both **rental disputes** and **service booking disputes**. UAT is run by a business tester or product owner to verify that the system meets acceptance criteria from a user's perspective and is fit for release.

- **Scope:** Full dispute lifecycle — filing, evidence upload, admin state transitions, resolution (financial operations), internal notes, audit trail, and dashboard views — for both rental and service booking transaction types.
- **Relationship to other test docs:** `specs/services/phase1/4-uat-test-plan.md` covers UAT for the services marketplace. This document covers disputes specifically and is meant to be run in conjunction with that plan.
- **How to use:** Execute each scenario in the test environment (see Section 12), verify expected results, and mark Pass/Fail. Known gaps are labeled `[KNOWN GAP — S#]` and are expected to fail until fixed; flag them as bugs, do not block release sign-off on them unless explicitly required.

---

## 2. Known Gaps (Pre-UAT)

The following issues were identified during implementation review. Gap scenarios are included inline in the test plan below, labeled accordingly.

| Gap | Description                                                                         | Priority |
| --- | ----------------------------------------------------------------------------------- | -------- |
| S1  | Service booking disputes have no automated refund path on resolution                | HIGH     |
| S2  | Payout already processed before dispute is filed — no detection or reversal         | HIGH     |
| S3  | `provider_no_show` / `requester_no_show` can be filed on a completed booking        | HIGH     |
| S4  | Second dispute can be filed on same rental/booking after first is closed            | MEDIUM   |
| S5  | Simultaneous dispute creation race condition returns 500 instead of 409             | MEDIUM   |
| S6  | Whitespace-only text evidence passes validation                                     | MEDIUM   |
| S7  | No upper bound on `partialAmount` vs. actual deposit/payment amount                 | MEDIUM   |
| S8  | No per-user or per-dispute evidence count limit                                     | LOW      |
| S9  | `additionalEvidenceDeadline` auto-set behavior on `under_review` transition unclear | MEDIUM   |
| S10 | No Stripe chargeback webhook handler despite `stripeChargebackId` schema field      | MEDIUM   |
| S11 | "Dismissed" outcome label is ambiguous to users vs. "denied"                        | LOW      |

---

## 3. Traceability: Sections to Test IDs

| Section                               | UAT Scenario IDs                |
| ------------------------------------- | ------------------------------- |
| A: Dispute Creation (Rental)          | UAT-DIS-A01 through UAT-DIS-A12 |
| B: Dispute Creation (Service Booking) | UAT-DIS-B01 through UAT-DIS-B10 |
| C: Evidence Upload                    | UAT-DIS-C01 through UAT-DIS-C10 |
| D: Admin State Transitions            | UAT-DIS-D01 through UAT-DIS-D10 |
| E: Resolution — Rental                | UAT-DIS-E01 through UAT-DIS-E12 |
| F: Resolution — Service Booking       | UAT-DIS-F01 through UAT-DIS-F05 |
| G: Internal Notes                     | UAT-DIS-G01 through UAT-DIS-G06 |
| H: Audit Trail                        | UAT-DIS-H01 through UAT-DIS-H07 |
| I: Dashboard & List Views             | UAT-DIS-I01 through UAT-DIS-I09 |
| J: Cross-Cutting / Negative Cases     | UAT-DIS-J01 through UAT-DIS-J07 |

---

## 4. Test Accounts & Setup

| Role                   | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| **Renter / Requester** | Regular user who books rentals or service bookings         |
| **Owner / Provider**   | Regular user who owns rental listings or provides services |
| **Admin**              | Platform admin with full dispute management access         |

Use separate browser sessions (or incognito windows) for each role. Stripe test mode card: `4242 4242 4242 4242`.

---

## 5. UAT Scenarios — Section A: Dispute Creation (Rental)

### UAT-DIS-A01: Renter files dispute within 24h of return confirmation

- **Actor:** Renter
- **Preconditions:** Completed rental with `returnConfirmedAt` set within the last 24 hours; no active dispute.
- **Steps:**
  1. Navigate to the rental booking detail page.
  2. Click "File a Dispute."
  3. Select reason code: `damage`.
  4. Enter a description (min 10 characters).
  5. Submit.
- **Expected results:**
  - Dispute created with status `open`.
  - User redirected to dispute detail page.
  - Toast: "Dispute created successfully."
  - Owner receives a notification email about the new dispute.
- [x] Pass / [ ] Fail

---

### UAT-DIS-A02: Owner files dispute within 24h of return confirmation

- **Actor:** Owner (rental listing owner)
- **Preconditions:** Completed rental with `returnConfirmedAt` set within the last 24 hours; no active dispute.
- **Steps:**
  1. Navigate to the rental booking detail page.
  2. Click "File a Dispute."
  3. Select reason code: `damage`.
  4. Enter a description.
  5. Submit.
- **Expected results:**
  - Dispute created with status `open` and `createdByRole: provider`.
  - Renter receives notification email.
- [x] Pass / [ ] Fail

---

### UAT-DIS-A03: Dispute filed outside the 24h filing window (expired)

- **Actor:** Renter
- **Preconditions:** Rental with `returnConfirmedAt` set more than 24 hours ago.
- **Steps:**
  1. Navigate to the rental booking detail page.
  2. Attempt to file a dispute.
- **Expected results:**
  - Request rejected with an error message indicating the filing window has expired.
  - No dispute created.
- [x] Pass / [ ] Fail (button not visible)

---

### UAT-DIS-A04: Dispute filed before rental start date

- **Actor:** Renter
- **Preconditions:** Upcoming rental (start date in the future); `returnConfirmedAt` is null.
- **Steps:**
  1. Navigate to the rental booking detail page.
  2. Attempt to file a dispute.
- **Expected results:**
  - Request rejected — filing window has not yet opened.
  - Error message indicates dispute cannot be filed before the rental begins.
- [x] Pass / [ ] Fail (button not visible)

---

### UAT-DIS-A05: Dispute filed on in-progress rental (no return confirmation yet)

- **Actor:** Renter
- **Preconditions:** Rental has started (`now >= startDate`) but `returnConfirmedAt` is null.
- **Steps:**
  1. Navigate to the rental booking detail page.
  2. File a dispute (reason: `non_delivery`).
- **Expected results:**
  - Dispute created successfully — no deadline applies when return has not been confirmed.
  - Status: `open`.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-A06: Renter and owner file no-show disputes against each other

- **Actor:** Renter, then Owner (separate sessions)
- **Preconditions:** Two separate rentals (one per test); rental started, no active disputes.
- **Steps (Renter):**
  1. File dispute with reason `owner_no_show`.
  2. Verify dispute created.
- **Steps (Owner):**
  1. On a different rental, file dispute with reason `renter_no_show`.
  2. Verify dispute created.
- **Expected results:**
  - Both disputes created with correct `createdByRole`.
  - No-show reason codes are accepted.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-A07: Renter attempts to file a service-specific reason code on a rental

- **Actor:** Renter
- **Preconditions:** Active rental.
- **Steps:**
  1. Attempt to file a dispute via API with `reasonCode: "requester_no_show"`.
- **Expected results:**
  - Request rejected — `requester_no_show` is not a valid reason code for rental disputes.
  - Error returned.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-A08: Non-participant attempts to file a dispute on someone else's rental

- **Actor:** User who is not the renter or owner of the rental
- **Preconditions:** A rental exists that the test user is not party to.
- **Steps:**
  1. Attempt to file a dispute via API with the rental's ID.
- **Expected results:**
  - Request rejected with 403 Forbidden.
  - No dispute created.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-A09: Duplicate dispute on same rental rejected

- **Actor:** Renter
- **Preconditions:** An active dispute already exists for the rental.
- **Steps:**
  1. Attempt to file a second dispute for the same rental.
- **Expected results:**
  - Request rejected with a conflict error (dispute already exists for this rental).
  - No second dispute created.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-A10: Monthly rate limit enforced (4th dispute in one month)

- **Actor:** Renter
- **Preconditions:** User has already filed 3 disputes in the current calendar month.
- **Steps:**
  1. Attempt to file a 4th dispute.
- **Expected results:**
  - Request rejected with rate limit error.
  - Message indicates the monthly dispute limit has been reached.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-A11: Payout lifecycle frozen after dispute creation

- **Actor:** Renter
- **Preconditions:** Completed rental with pending payout; `returnConfirmedAt` within 24h.
- **Steps:**
  1. File a dispute.
  2. Check the payment lifecycle record in the database (or admin panel).
- **Expected results:**
  - `ownerTransferStatus` is set to `frozen` in the payment lifecycle record.
  - No payout transfer is processed while dispute is active.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-A12: Both parties receive dispute created notification

- **Actor:** Renter files; Owner receives notification
- **Preconditions:** Rental with valid filing window.
- **Steps:**
  1. Renter files a dispute.
  2. Check Owner's email inbox.
- **Expected results:**
  - Owner receives email: dispute filed, reason code, description excerpt, link to view.
  - Renter does NOT receive a notification for their own filing.
- [ ] Pass / [ ] Fail

---

## 6. UAT Scenarios — Section B: Dispute Creation (Service Booking)

### UAT-DIS-B01: Requester files quality_issue on a completed service booking

- **Actor:** Requester
- **Preconditions:** Service booking with status `completed`; within 24h of `completedAt`.
- **Steps:**
  1. Navigate to the service booking detail page.
  2. Click "File a Dispute."
  3. Select reason `quality_issue` and enter a description.
  4. Submit.
- **Expected results:**
  - Dispute created with `createdByRole: requester`.
  - Provider receives notification email.
  - Service payment lifecycle frozen.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B02: Provider files requester_no_show on an accepted service booking

- **Actor:** Provider
- **Preconditions:** Service booking with status `accepted` (requester did not show up).
- **Steps:**
  1. Navigate to the service booking detail page.
  2. File a dispute with reason `requester_no_show`.
- **Expected results:**
  - Dispute created with `createdByRole: provider`.
  - Requester receives notification.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B03: Requester files provider_no_show on an accepted service booking

- **Actor:** Requester
- **Preconditions:** Service booking with status `accepted` (provider did not show up).
- **Steps:**
  1. Navigate to the service booking detail page.
  2. File a dispute with reason `provider_no_show`.
- **Expected results:**
  - Dispute created with `createdByRole: requester`.
  - Provider receives notification.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B04: Provider attempts to file provider_no_show (wrong role)

- **Actor:** Provider
- **Preconditions:** Service booking with status `accepted`.
- **Steps:**
  1. Attempt to file a dispute with reason `provider_no_show` as the provider.
- **Expected results:**
  - Request rejected — a provider cannot claim their own no-show.
  - Error message indicates invalid reason code for this role.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B05: Requester files provider_no_show on a completed booking [KNOWN GAP — S3]

- **Actor:** Requester
- **Preconditions:** Service booking with status `completed`.
- **Steps:**
  1. Attempt to file a dispute with reason `provider_no_show` on a completed booking.
- **Expected results (desired):**
  - Request rejected — `provider_no_show` is logically inconsistent with a completed booking.
- **Actual behavior:**
  - Dispute is created without error.
- **Status:** KNOWN GAP (S3) — file as bug, do not block release sign-off.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B06: Dispute filed before the scheduled service date

- **Actor:** Requester
- **Preconditions:** Service booking with `scheduledAt` in the future.
- **Steps:**
  1. Attempt to file a dispute before the scheduled service date.
- **Expected results:**
  - Request rejected — filing window has not yet opened.
  - Error message shown.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B07: Dispute filed more than 24h after service completion

- **Actor:** Requester
- **Preconditions:** Service booking `completedAt` is more than 24 hours ago.
- **Steps:**
  1. Attempt to file a dispute.
- **Expected results:**
  - Request rejected — 24h filing window after completion has expired.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B08: Dispute filed on a cancelled or declined booking

- **Actor:** Requester
- **Preconditions:** Service booking with status `cancelled` or `declined`.
- **Steps:**
  1. Attempt to file a dispute on the booking.
- **Expected results:**
  - Request rejected — disputes require booking status `accepted` or `completed`.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B09: Service payout lifecycle frozen on dispute creation

- **Actor:** Requester
- **Preconditions:** Completed service booking with pending payout.
- **Steps:**
  1. File a dispute.
  2. Check the service payment lifecycle record in DB.
- **Expected results:**
  - `ownerTransferStatus` is `frozen`.
  - No provider transfer is processed while dispute is open.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-B10: Dispute filed after provider payout already processed [KNOWN GAP — S2]

- **Actor:** Requester
- **Preconditions:** Service booking where the cron job has already transferred funds to the provider (`ownerTransferStatus: completed`).
- **Steps:**
  1. File a dispute on this booking.
- **Expected results (desired):**
  - System detects payout already processed and rejects or warns accordingly.
- **Actual behavior:**
  - Dispute is created; lifecycle is marked frozen, but funds are already transferred.
- **Status:** KNOWN GAP (S2) — file as bug. Dispute creation succeeds but has no financial effect.
- [ ] Pass / [ ] Fail

---

## 7. UAT Scenarios — Section C: Evidence Upload

### UAT-DIS-C01: Renter uploads image evidence on an open dispute

- **Actor:** Renter
- **Preconditions:** Active dispute in `open` status with evidence deadline in the future.
- **Steps:**
  1. Navigate to the dispute detail page.
  2. Upload a JPEG image under 10MB and under 1920×1920px.
- **Expected results:**
  - Evidence record created with `evidenceType: image`.
  - Image visible in the evidence gallery.
  - `uploadedByRole: renter`.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C02: Provider uploads text evidence on an evidence_requested dispute

- **Actor:** Provider / Owner
- **Preconditions:** Dispute in `evidence_requested` status; deadline in the future.
- **Steps:**
  1. Navigate to the dispute detail page.
  2. Enter text evidence (between 10 and 5000 characters) and submit.
- **Expected results:**
  - Evidence record created with `evidenceType: text`.
  - Text visible in the evidence section.
  - `uploadedByRole: provider`.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C03: Both parties upload evidence; admin sees all submissions

- **Actor:** Renter + Owner (separate sessions), then Admin
- **Preconditions:** Dispute in `evidence_requested` status.
- **Steps:**
  1. Renter uploads image evidence.
  2. Owner uploads text evidence.
  3. Admin views dispute detail.
- **Expected results:**
  - Both evidence items visible to admin with correct `uploadedByRole` labels.
  - Each party can see their own uploads (and ideally the other party's as well per product decision).
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C04: Upload rejected after evidence deadline has expired

- **Actor:** Renter
- **Preconditions:** Dispute with `evidenceDeadline` in the past.
- **Steps:**
  1. Attempt to upload evidence.
- **Expected results:**
  - Upload rejected with error: evidence deadline has passed.
  - UI shows deadline as expired.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C05: Upload rejected on resolved dispute

- **Actor:** Renter
- **Preconditions:** Dispute with status `resolved`.
- **Steps:**
  1. Attempt to upload evidence via API.
- **Expected results:**
  - Request rejected — dispute is not in an evidence-accepting state.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C06: Upload rejected on closed dispute

- **Actor:** Renter
- **Preconditions:** Dispute with status `closed`.
- **Steps:**
  1. Attempt to upload evidence via API.
- **Expected results:**
  - Request rejected — dispute is closed and not accepting evidence.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C07: Whitespace-only text evidence submission [KNOWN GAP — S6]

- **Actor:** Renter
- **Preconditions:** Open dispute with active evidence deadline.
- **Steps:**
  1. Submit text evidence containing only spaces (e.g., 10 space characters).
- **Expected results (desired):**
  - Request rejected — whitespace-only content is not meaningful evidence.
- **Actual behavior:**
  - Evidence record is created (passes the 10-char minimum check).
- **Status:** KNOWN GAP (S6) — file as bug.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C08: Large image is compressed correctly on upload

- **Actor:** Renter
- **Preconditions:** Open dispute. Image is 4K resolution (e.g., 4000×3000px).
- **Steps:**
  1. Upload a large JPEG image.
- **Expected results:**
  - Image processed and stored as JPEG at max 1920×1920px, 85% quality.
  - Evidence record created with image URL.
  - No upload error.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C09: Non-image file type rejected

- **Actor:** Renter
- **Preconditions:** Open dispute.
- **Steps:**
  1. Attempt to upload a PDF or video file as evidence.
- **Expected results:**
  - Upload rejected with error indicating only image files are accepted.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-C10: Non-participant cannot upload evidence

- **Actor:** Unrelated user (not renter, owner, or admin)
- **Preconditions:** Active dispute.
- **Steps:**
  1. Attempt to upload evidence via API using the dispute ID.
- **Expected results:**
  - Request rejected with 403 Forbidden.
- [ ] Pass / [ ] Fail

---

## 8. UAT Scenarios — Section D: Admin State Transitions

### UAT-DIS-D01: Admin moves dispute from open to evidence_requested

- **Actor:** Admin
- **Preconditions:** Dispute in `open` status.
- **Steps:**
  1. Navigate to the dispute detail page.
  2. Click the transition button for `evidence_requested`.
  3. Optionally enter a reason.
  4. Confirm.
- **Expected results:**
  - Dispute status updated to `evidence_requested`.
  - `evidenceDeadline` set (verify in DB or UI).
  - Both parties receive email notification with deadline.
  - Audit log records `state_change` from `open` to `evidence_requested`.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D02: Admin moves dispute directly from open to under_review

- **Actor:** Admin
- **Preconditions:** Dispute in `open` status.
- **Steps:**
  1. Transition directly to `under_review`.
- **Expected results:**
  - Dispute status updated to `under_review`.
  - Audit log records transition.
  - No evidence deadline notification sent (skipped stage).
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D03: Admin moves dispute directly from open to resolved

- **Actor:** Admin
- **Preconditions:** Dispute in `open` status.
- **Steps:**
  1. Transition directly to `resolved`.
- **Expected results:**
  - Status updated to `resolved` — admin can skip intermediate stages.
  - Audit log records transition.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D04: Admin moves evidence_requested to under_review

- **Actor:** Admin
- **Preconditions:** Dispute in `evidence_requested` status.
- **Steps:**
  1. Transition to `under_review`.
- **Expected results:**
  - Status updated to `under_review`.
  - Audit log entry created.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D05: Admin moves under_review to resolved

- **Actor:** Admin
- **Preconditions:** Dispute in `under_review` status.
- **Steps:**
  1. Transition to `resolved`.
- **Expected results:**
  - Status updated to `resolved`.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D06: Admin moves resolved to closed

- **Actor:** Admin
- **Preconditions:** Dispute in `resolved` status.
- **Steps:**
  1. Transition to `closed`.
- **Expected results:**
  - Status updated to `closed` (terminal state).
  - No further transitions available.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D07: Invalid state transition rejected

- **Actor:** Admin
- **Preconditions:** Dispute in `resolved` status.
- **Steps:**
  1. Attempt to transition back to `open` via API.
- **Expected results:**
  - Request rejected — invalid transition.
  - Error message returned.
  - Dispute status unchanged.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D08: Non-admin cannot transition dispute state

- **Actor:** Regular user (renter or owner)
- **Preconditions:** Any active dispute.
- **Steps:**
  1. Attempt to update dispute state via API (`PATCH /api/disputes/[id]/state`).
- **Expected results:**
  - Request rejected with 403 Forbidden.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D09: Evidence deadline is set on evidence_requested transition

- **Actor:** Admin
- **Preconditions:** Dispute in `open` status.
- **Steps:**
  1. Transition to `evidence_requested`.
  2. Check dispute record in DB: `evidenceDeadline` field.
- **Expected results:**
  - `evidenceDeadline` is set to a future date (approximately 7 days from now).
  - UI shows deadline in evidence upload section.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-D10: Additional evidence deadline on under_review transition [KNOWN GAP — S9]

- **Actor:** Admin
- **Preconditions:** Dispute in `evidence_requested` status.
- **Steps:**
  1. Transition to `under_review`.
  2. Check `additionalEvidenceDeadline` in DB.
- **Expected results (desired):**
  - `additionalEvidenceDeadline` auto-set to a new future date for the extended review period.
- **Actual behavior:**
  - Unclear if auto-set or falls back to primary `evidenceDeadline`. Verify and document.
- **Status:** KNOWN GAP (S9) — verify behavior; file as bug if deadline is not set automatically.
- [ ] Pass / [ ] Fail

---

## 9. UAT Scenarios — Section E: Dispute Resolution (Rental)

### UAT-DIS-E01: Admin resolves in favor of renter (deposit released)

- **Actor:** Admin
- **Preconditions:** Rental dispute; rental has a security deposit on hold (`depositHoldStatus: held`).
- **Steps:**
  1. Navigate to dispute detail.
  2. Submit resolution: outcome `favor_renter`, reason (min 10 chars).
- **Expected results:**
  - Dispute status → `resolved`.
  - Security deposit released (Stripe `paymentIntents.cancel`).
  - `depositHoldStatus` → `released` in payment lifecycle.
  - Owner payout unfrozen.
  - Both parties notified by email (outcome: "favor_renter").
  - Financial operation record: `release`, status `succeeded`.
  - Audit log: `resolution` action logged.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E02: Admin resolves in favor of provider (deposit captured)

- **Actor:** Admin
- **Preconditions:** Rental dispute; security deposit on hold.
- **Steps:**
  1. Submit resolution: outcome `favor_provider`, reason.
- **Expected results:**
  - Security deposit captured (Stripe `paymentIntents.capture`).
  - `depositHoldStatus` → `captured`.
  - Owner payout unfrozen.
  - Both parties notified.
  - Financial operation: `capture_deposit`, status `succeeded`.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E03: Admin resolves with partial outcome (partial_renter)

- **Actor:** Admin
- **Preconditions:** Rental dispute; security deposit on hold.
- **Steps:**
  1. Submit resolution: outcome `partial_renter`, `partialAmount` = [some amount less than deposit], reason.
- **Expected results:**
  - Partial deposit captured for the specified amount.
  - Stripe confirms partial capture.
  - Financial operation record shows partial amount.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E04: Admin resolves with partial outcome but no partialAmount provided

- **Actor:** Admin
- **Preconditions:** Rental dispute.
- **Steps:**
  1. Submit resolution: outcome `partial_renter`, no `partialAmount`.
- **Expected results:**
  - Request rejected — `partialAmount` is required for partial outcomes.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E05: Admin resolves as dismissed (deposit released)

- **Actor:** Admin
- **Preconditions:** Rental dispute; security deposit on hold.
- **Steps:**
  1. Submit resolution: outcome `dismissed`, reason.
- **Expected results:**
  - Security deposit released.
  - Owner payout unfrozen.
  - Both parties notified.
  - Outcome displayed as "Dismissed" on dispute detail page.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E06: Resolution rejected with insufficient reason text

- **Actor:** Admin
- **Preconditions:** Active dispute.
- **Steps:**
  1. Submit resolution with reason fewer than 10 characters (e.g., "ok").
- **Expected results:**
  - Request rejected with validation error.
  - Dispute status unchanged.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E07: partialAmount exceeds actual deposit amount [KNOWN GAP — S7]

- **Actor:** Admin
- **Preconditions:** Rental dispute; security deposit on hold for a known amount.
- **Steps:**
  1. Submit resolution with `partial_provider` and `partialAmount` set to more than the deposit amount.
- **Expected results (desired):**
  - Validation rejects amount before Stripe call.
- **Actual behavior:**
  - Stripe rejects the capture; financial operation record created with `failed` status; dispute NOT resolved.
- **Status:** KNOWN GAP (S7) — poor admin UX; file as bug to add server-side upper bound validation.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E08: Deposit not on hold — operation skipped, dispute still resolves

- **Actor:** Admin
- **Preconditions:** Rental dispute where `depositHoldStatus` is NOT `held` (e.g., already released).
- **Steps:**
  1. Submit resolution: outcome `favor_provider`.
- **Expected results:**
  - Deposit operation skipped (nothing to capture).
  - Dispute still marked `resolved`.
  - Financial operation record shows `skipped` or capture not attempted.
  - Both parties notified.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E09: Rental with no security deposit resolves cleanly

- **Actor:** Admin
- **Preconditions:** Rental dispute on a listing that had no security deposit.
- **Steps:**
  1. Submit resolution with any outcome.
- **Expected results:**
  - No Stripe deposit operation attempted.
  - Dispute resolved normally.
  - Payout lifecycle unfrozen.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E10: Financial operation failure prevents dispute resolution

- **Actor:** Admin (Stripe test mode: simulate decline)
- **Preconditions:** Rental dispute; security deposit on hold; use Stripe test card that declines captures.
- **Steps:**
  1. Submit resolution: outcome `favor_provider`.
  2. Stripe returns capture error.
- **Expected results:**
  - Dispute status NOT changed to `resolved`.
  - Financial operation record created with `status: failed` and error message.
  - Owner payout NOT unfrozen.
  - Ops alert sent.
  - Admin UI shows failure.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E11: Payment lifecycle unfrozen after resolution

- **Actor:** Admin
- **Preconditions:** Active rental dispute with frozen payout lifecycle.
- **Steps:**
  1. Resolve the dispute (any outcome).
  2. Check payment lifecycle record in DB.
- **Expected results:**
  - `ownerTransferStatus` is no longer `frozen`.
  - Payout cron will now process the transfer on next run.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-E12: Audit log captures resolution details

- **Actor:** Admin
- **Preconditions:** Any resolved dispute.
- **Steps:**
  1. View audit log via admin interface or `GET /api/disputes/[id]/audit`.
- **Expected results:**
  - `resolution` action log entry exists.
  - Contains: outcome, reason, resolved by (admin user ID), resolved at timestamp.
- [ ] Pass / [ ] Fail

---

## 10. UAT Scenarios — Section F: Dispute Resolution (Service Booking)

### UAT-DIS-F01: Admin resolves service dispute in requester's favor [KNOWN GAP — S1]

- **Actor:** Admin
- **Preconditions:** Service booking dispute.
- **Steps:**
  1. Resolve dispute with outcome `favor_renter` (maps to requester's favor).
- **Expected results (desired):**
  - Automated Stripe refund issued to requester.
  - Provider payout NOT transferred.
- **Actual behavior:**
  - Deposit operations are skipped (`depositOperationStatus: skipped`).
  - No automated refund to requester.
  - Provider payout is unfrozen — provider may still receive payment.
- **Status:** KNOWN GAP (S1) — HIGH priority bug. Service booking dispute resolutions have no automated financial path. Manual intervention required.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-F02: Admin resolves service dispute in provider's favor

- **Actor:** Admin
- **Preconditions:** Service booking dispute.
- **Steps:**
  1. Resolve dispute with outcome `favor_provider`.
- **Expected results:**
  - Provider payout unfrozen.
  - Provider transfer processes on next cron run.
  - `depositOperationStatus: skipped` in response (no deposit mechanism for services).
  - Both parties notified.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-F03: Admin resolves service dispute as dismissed

- **Actor:** Admin
- **Preconditions:** Service booking dispute.
- **Steps:**
  1. Resolve with outcome `dismissed`.
- **Expected results:**
  - Provider payout unfrozen.
  - Requester receives notification (outcome: dismissed).
- [ ] Pass / [ ] Fail

---

### UAT-DIS-F04: Service dispute resolution confirms deposit operations skipped

- **Actor:** Admin
- **Preconditions:** Any service booking dispute.
- **Steps:**
  1. Resolve with any outcome.
  2. Check API response body.
- **Expected results:**
  - Response contains `depositOperationStatus: "skipped"`.
  - No financial operation record for deposit capture/release.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-F05: Both parties receive resolution notification for service dispute

- **Actor:** Admin resolves; check Requester + Provider emails
- **Preconditions:** Service booking dispute.
- **Steps:**
  1. Admin resolves the dispute.
  2. Check both parties' email inboxes.
- **Expected results:**
  - Both requester and provider receive "dispute resolved" email.
  - Email includes outcome and resolution reason.
  - Email includes link to view dispute.
- [ ] Pass / [ ] Fail

---

## 11. UAT Scenarios — Section G: Internal Notes (Admin)

### UAT-DIS-G01: Admin creates an internal note

- **Actor:** Admin
- **Preconditions:** Any active dispute.
- **Steps:**
  1. Navigate to the dispute detail page.
  2. Enter text in the internal notes section and submit.
- **Expected results:**
  - Note appears in the internal notes list (admin view).
  - Note shows creation timestamp.
  - Audit log records `note_created` action.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-G02: Internal notes are not visible to regular users

- **Actor:** Renter or Provider
- **Preconditions:** Dispute with admin-created internal notes.
- **Steps:**
  1. View dispute detail page as renter or provider.
- **Expected results:**
  - Internal notes section is not visible.
  - Notes are not included in the API response for non-admins.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-G03: Admin edits an internal note

- **Actor:** Admin
- **Preconditions:** Dispute with at least one internal note.
- **Steps:**
  1. Click edit on an existing note.
  2. Change the content.
  3. Save.
- **Expected results:**
  - Note content updated.
  - `updatedAt` timestamp refreshed.
  - Audit log records `note_updated` action.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-G04: Admin deletes an internal note

- **Actor:** Admin
- **Preconditions:** Dispute with at least one internal note.
- **Steps:**
  1. Click delete on an existing note.
  2. Confirm deletion.
- **Expected results:**
  - Note removed from list.
  - Audit log records `note_deleted` action.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-G05: Admin attempts to delete a nonexistent note

- **Actor:** Admin
- **Preconditions:** Any active dispute.
- **Steps:**
  1. Send `DELETE /api/disputes/[id]/notes` with a nonexistent `noteId`.
- **Expected results:**
  - Request rejected with 404 Not Found.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-G06: Audit log records all note lifecycle events

- **Actor:** Admin
- **Preconditions:** Dispute where notes have been created, edited, and deleted.
- **Steps:**
  1. View audit log.
- **Expected results:**
  - `note_created`, `note_updated`, and `note_deleted` action entries exist in chronological order.
- [ ] Pass / [ ] Fail

---

## 12. UAT Scenarios — Section H: Audit Trail

### UAT-DIS-H01: dispute_created action logged

- **Actor:** Any participant
- **Preconditions:** Newly created dispute.
- **Steps:**
  1. View audit log via admin API (`GET /api/disputes/[id]/audit`).
- **Expected results:**
  - First entry has `actionType: dispute_created`.
  - Includes filing user ID, role, and timestamp.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-H02: state_change logged with previous and new state

- **Actor:** Admin (after transitioning state)
- **Steps:**
  1. Transition dispute from `open` to `evidence_requested`.
  2. View audit log.
- **Expected results:**
  - `state_change` entry with `previousState: "open"` and `newState: "evidence_requested"`.
  - Admin user ID recorded.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-H03: evidence_uploaded logged on each upload

- **Actor:** Renter uploads two evidence items
- **Steps:**
  1. Upload image evidence.
  2. Upload text evidence.
  3. View audit log.
- **Expected results:**
  - Two `evidence_uploaded` entries in audit log.
  - Each records uploader role and evidence type.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-H04: resolution action logged with full details

- **Actor:** Admin resolves dispute
- **Steps:**
  1. Resolve dispute.
  2. View audit log.
- **Expected results:**
  - `resolution` entry with outcome, reason, resolvedBy, resolvedAt.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-H05: financial_operation logged on deposit capture/release

- **Actor:** Admin resolves rental dispute with deposit operation
- **Steps:**
  1. Resolve dispute (favor_provider — triggers deposit capture).
  2. View audit log.
- **Expected results:**
  - `financial_operation` entry with operation type, amount (if applicable), and Stripe result.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-H06: Non-admin cannot access audit log endpoint

- **Actor:** Regular user
- **Steps:**
  1. Send `GET /api/disputes/[id]/audit` as a non-admin user.
- **Expected results:**
  - Request rejected with 403 Forbidden.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-H07: Audit log entries are immutable

- **Actor:** Admin
- **Steps:**
  1. Attempt to edit or delete an audit log entry (no UI exists; would require direct API/DB manipulation).
- **Expected results:**
  - No edit or delete endpoints exist for audit log entries.
  - Entries are append-only.
- [ ] Pass / [ ] Fail

---

## 13. UAT Scenarios — Section I: Dashboard & List Views

### UAT-DIS-I01: User sees only their own disputes

- **Actor:** Renter
- **Preconditions:** Multiple disputes exist in the system; only some involve this user.
- **Steps:**
  1. Navigate to `/dashboard/disputes`.
- **Expected results:**
  - Only disputes where user is renter, owner, requester, or provider are shown.
  - Other users' disputes are not visible.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I02: Admin sees all disputes with filters

- **Actor:** Admin
- **Preconditions:** Multiple disputes with different statuses and reason codes.
- **Steps:**
  1. Navigate to admin disputes list.
  2. Filter by status: `under_review`.
  3. Filter by reason code: `damage`.
- **Expected results:**
  - Correct disputes returned for each filter.
  - Filters can be combined.
  - Pagination works.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I03: User filters disputes by role

- **Actor:** User who is both a renter and a provider
- **Steps:**
  1. Navigate to `/dashboard/disputes`.
  2. Filter by role: `renter`.
  3. Then filter by role: `provider`.
- **Expected results:**
  - Role filter correctly shows disputes where user has that role.
  - Disputes from other roles are excluded.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I04: User filters disputes by status

- **Actor:** Renter
- **Steps:**
  1. Filter disputes list by status: `resolved`.
- **Expected results:**
  - Only resolved disputes shown.
  - Open disputes not included.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I05: Pagination on disputes list

- **Actor:** Admin (with many disputes)
- **Steps:**
  1. Load page 1 (12 items).
  2. Navigate to page 2.
- **Expected results:**
  - Correct 12 items on page 1.
  - Next page loads correctly.
  - Total count matches.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I06: Non-participant cannot access dispute detail page

- **Actor:** Unrelated user
- **Preconditions:** A dispute exists for a rental/booking this user is not part of.
- **Steps:**
  1. Navigate directly to `/dashboard/disputes/[id]`.
- **Expected results:**
  - Page returns 404 (not found).
  - No dispute details exposed.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I07: Admin dispute stats widget shows correct data

- **Actor:** Admin
- **Steps:**
  1. View admin dashboard.
  2. Check the dispute stats widget.
- **Expected results:**
  - Total disputes count is accurate.
  - Pending count (open + evidence_requested + under_review) is correct.
  - Resolved this month count is correct.
  - Status breakdown bars reflect real distribution.
  - Top reason codes listed.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I08: Service booking detail page shows active dispute banner

- **Actor:** Requester
- **Preconditions:** Service booking with an open dispute.
- **Steps:**
  1. Navigate to the service booking detail page.
- **Expected results:**
  - Active dispute indicator/banner is shown.
  - Link to the dispute detail page is included.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-I09: File dispute button hidden when active dispute exists

- **Actor:** Renter
- **Preconditions:** Rental or service booking with an existing active dispute.
- **Steps:**
  1. Navigate to the booking detail page.
- **Expected results:**
  - "File a Dispute" button is not shown.
  - Existing dispute link is shown instead.
- [ ] Pass / [ ] Fail

---

## 14. UAT Scenarios — Section J: Cross-Cutting / Negative Cases

### UAT-DIS-J01: Monthly rate limit (3 disputes per month)

- **Actor:** Renter
- **Preconditions:** User has already filed 3 disputes in the current calendar month.
- **Steps:**
  1. Attempt to file a 4th dispute this month.
- **Expected results:**
  - Request rejected with rate limit error (3/month exceeded).
- [ ] Pass / [ ] Fail

---

### UAT-DIS-J02: Annual rate limit (10 disputes per year)

- **Actor:** Renter
- **Preconditions:** User has already filed 10 disputes in the current calendar year.
- **Steps:**
  1. Attempt to file an 11th dispute.
- **Expected results:**
  - Request rejected with rate limit error (10/year exceeded).
- [ ] Pass / [ ] Fail

---

### UAT-DIS-J03: Second dispute filed after first is closed (same rental) [KNOWN GAP — S4]

- **Actor:** Renter
- **Preconditions:** A rental where a dispute was filed and then closed/resolved.
- **Steps:**
  1. File a second dispute for the same rental.
- **Expected results (desired):**
  - Request rejected — one dispute per rental (lifetime), or at minimum a strong warning.
- **Actual behavior:**
  - Second dispute is created (closed disputes are not counted as "active").
- **Status:** KNOWN GAP (S4) — file as bug. Rate limits are the only guard against re-dispute abuse.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-J04: Simultaneous dispute creation (race condition) [KNOWN GAP — S5]

- **Actor:** Two concurrent API clients
- **Preconditions:** A rental/booking with no active dispute.
- **Steps:**
  1. Send two simultaneous POST requests to create a dispute for the same rental.
- **Expected results (desired):**
  - One request succeeds (201); the other receives 409 Conflict.
- **Actual behavior:**
  - DB unique index prevents duplicate creation, but the error may surface as an unhandled 500.
- **Status:** KNOWN GAP (S5) — file as bug. Unique constraint violation should be caught and returned as 409.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-J05: Large image compressed correctly

- **Actor:** Renter
- **Preconditions:** Open dispute; 4K resolution image ready.
- **Steps:**
  1. Upload a large image (4000×3000px).
  2. Check the stored image URL (should be Vercel Blob hosted JPEG).
- **Expected results:**
  - Image stored as JPEG, dimensions capped at 1920×1920.
  - No upload failure.
  - Evidence record created.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-J06: Notification emails delivered for all dispute events

- **Actor:** Renter + Owner (using test email inboxes)
- **Steps:**
  1. File a dispute → verify "dispute created" email.
  2. Admin transitions to `evidence_requested` → verify "evidence requested" email to both parties.
  3. Admin resolves dispute → verify "dispute resolved" email to both parties.
- **Expected results:**
  - Three notification events each trigger correct emails.
  - Emails contain relevant details (dispute ID, reason, deadline, outcome).
  - Links in emails point to correct dispute detail pages.
- [ ] Pass / [ ] Fail

---

### UAT-DIS-J07: Ops alert sent for dispute creation and resolution

- **Actor:** System (verify in ops alerting channel)
- **Steps:**
  1. File a dispute.
  2. Resolve a dispute.
  3. Check ops alerting channel (Slack, email, or equivalent).
- **Expected results:**
  - Ops alert sent on dispute creation with filing user, reason, transaction ID.
  - Ops alert sent on resolution with outcome and financial operation status.
- [ ] Pass / [ ] Fail

---

## 15. Test Environment & Prerequisites

1. **Test accounts:** Set up at least 3 accounts — renter/requester, owner/provider, admin.
2. **Stripe test mode:** All payment operations run against Stripe test environment.
   - Valid card: `4242 4242 4242 4242`
   - Declined card (for failure tests): `4000 0000 0000 0002`
3. **Database access:** Direct DB access required for verifying lifecycle states (frozen/unfrozen) and deadline fields.
4. **Email testing:** Use a test inbox service (e.g., Resend test mode, Mailhog, or equivalent) to verify notification delivery.
5. **Timing manipulation:** For filing window tests, `returnConfirmedAt` and `completedAt` may need to be manually adjusted in the DB.
6. **Admin impersonation:** Admin sessions should use the platform admin account; standard user sessions use separate browser profiles or incognito windows.

---

## 16. Sign-Off

| Section                               | Tester | Date | Status |
| ------------------------------------- | ------ | ---- | ------ |
| A: Dispute Creation (Rental)          |        |      |        |
| B: Dispute Creation (Service Booking) |        |      |        |
| C: Evidence Upload                    |        |      |        |
| D: Admin State Transitions            |        |      |        |
| E: Resolution — Rental                |        |      |        |
| F: Resolution — Service Booking       |        |      |        |
| G: Internal Notes                     |        |      |        |
| H: Audit Trail                        |        |      |        |
| I: Dashboard & List Views             |        |      |        |
| J: Cross-Cutting / Negative Cases     |        |      |        |

**Known gaps (S1, S2, S3, S4, S5, S6, S7, S9) must be resolved before production release or explicitly accepted as known limitations by the product owner.**
