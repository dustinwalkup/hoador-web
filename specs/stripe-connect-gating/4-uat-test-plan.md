# Stripe Connect Gating — User Acceptance Test (UAT) Plan

Hoador • Internal Specification

Pairs with [1-requirements.md](1-requirements.md), [2-design.md](2-design.md), [3-tasks.md](3-tasks.md), [HANDOFF.md](HANDOFF.md).

---

## 1. Introduction

This document defines hands-on UAT scenarios for the Stripe Connect gating rework: the requirement to onboard a payout account has moved from listing creation to booking acceptance. Scenarios are written to be executed on **local dev** against **Stripe test mode**, switching between two pre-existing test accounts ("Owner" and "Renter"). Backend-only checks (cron, log events, migration) use copy-paste `curl` / SQL.

- **Scope:** All work in Epics 1–9 of [3-tasks.md](3-tasks.md): listing-creation decoupling, derived payout readiness, hard backend gate, JIT onboarding UX, `returnTo` validation, capability-regression handling, soft-prompt banner, pending-booking expiry cron, structured logging, and migration 0062 (`expires_at` + cancellation columns).
- **How to use:** Execute each scenario in order within a section. Tick Pass/Fail. Sections are _roughly_ independent, but **§4 once-only** (real Stripe Connect onboarding) is a one-way operation — re-running prior "not verified" scenarios against the same Owner afterwards will fail.

---

## 2. Traceability — Epics → UAT IDs

| Epic / Task in [3-tasks.md](3-tasks.md) | UAT scenarios                        |
| --------------------------------------- | ------------------------------------ |
| 1. Foundation (readiness types, errors) | UAT-SCG-08, 09, 13, 14 (indirect)    |
| 2. Data model (`expiresAt`, reason)     | UAT-SCG-20, 21                       |
| 3. Backend acceptance gate              | UAT-SCG-16, 17, 18                   |
| 4. Listing creation without Connect     | UAT-SCG-01, 02                       |
| 5. Frontend pre-check + 403 safety net  | UAT-SCG-08, 13 (pre-check); 16 (403) |
| 6. JIT mode on earnings-and-payouts     | UAT-SCG-09–12, 14–16, 22, 23         |
| 7. Soft-prompt banner                   | UAT-SCG-03–06                        |
| 8. Pending-booking expiry cron          | UAT-SCG-19–21                        |
| 9. E2E coverage                         | Covered indirectly by every section  |
| Logging (`logGatingEvent`)              | UAT-SCG-24                           |

---

## 3. Test Environment

### 3.1 App

```bash
bun run dev
```

The app must be running on `http://localhost:3000` (or wherever your `.env.local` points). Server logs (pino JSON) must be visible in your terminal — you'll grep them in §6.

### 3.2 Required env (`.env.local`)

- `STRIPE_SECRET_KEY` — Stripe test-mode secret
- `STRIPE_WEBHOOK_SECRET` — for `account.updated` (needed to mark Connect verified)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe test-mode publishable
- `CRON_SECRET` — required for §5 cron tests
- `DATABASE_URL` — points at your dev DB; you'll run a handful of `psql` snippets

### 3.3 Stripe webhook listener (required for Connect to flip verified)

In a second terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```

Keep this running for the duration of UAT — without it, completing Stripe onboarding will not flip your user to `verified`.

### 3.4 Stripe Connect test inputs (memorize for §4)

| Field          | Test value                         |
| -------------- | ---------------------------------- |
| SSN            | `000-00-0000`                      |
| DOB            | Any past date making you ≥18       |
| Phone          | Any valid-looking US phone         |
| Address        | Any US address                     |
| Routing number | `110000000`                        |
| Account number | `000123456789`                     |
| Verification   | Stripe auto-approves test accounts |

### 3.5 Test accounts

| Label  | Role in scenarios             | Preconditions                                                                                                    |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Owner  | Lists items, accepts requests | Active in the same community as Renter. **Must start with no Stripe Connect account** (clear in §3.7 if needed). |
| Renter | Submits booking requests      | Active in the same community as Owner. Has at least one saved payment method in `/dashboard/payments`.           |

### 3.6 Migration sanity (one-time)

Run `bun run db:migrate` if you haven't already. Then verify:

```sql
-- expires_at column exists on both tables and is NOT NULL:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name IN ('rental_requests', 'service_bookings')
  AND column_name IN ('expires_at', 'cancellation_reason', 'cancelled_at');

-- partial indexes exist:
SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'rental_requests_pending_expires_at_idx',
  'sb_pending_expires_at_idx'
);

-- 'expired_no_acceptance' is in the cancellation_reason enum:
SELECT unnest(enum_range(NULL::cancellation_reason));
```

Expected: both columns present (`expires_at NOT NULL`, `cancellation_reason` nullable), both indexes returned, enum includes `expired_no_acceptance`.

### 3.7 Resetting Owner's Connect state between runs (DB)

If you need to "undo" Connect setup mid-UAT (rare — only if you finished onboarding and want to redo `not_started` scenarios), connect to your dev DB and run:

```sql
UPDATE "user"
SET
  stripe_connected_account_id = NULL,
  connect_charges_enabled = false,
  connect_payouts_enabled = false,
  connect_onboarding_complete = false
WHERE email = '<owner-email>';
```

Note: this leaves the orphaned Stripe Connect account on Stripe's side. Optional cleanup: delete it from your Stripe test-mode dashboard.

---

## 4. Scenarios

> Convention: Owner and Renter are logged out at the start of each scenario unless noted. "Click Accept" refers to the primary accept button on the booking detail UI.

### §4.1 — Listing creation without Connect (Epic 4)

#### UAT-SCG-01: Owner creates a rental listing without Stripe Connect

- **Actor:** Owner
- **Preconditions:** Owner has no Stripe Connect account (verify via §3.7 SQL: all four columns null/false).
- **Steps:**
  1. Log in as Owner.
  2. Go to `/dashboard/listings/add`.
  3. Fill out a rental listing (category, name, description, daily rate, security deposit, etc.) and submit.
- **Expected:**
  - The page renders the form without redirecting to a "Set up payouts first" prompt.
  - The submit succeeds; the listing appears in the Owner's listings list (`pending_review` is fine).
  - Terminal log line includes `"event":"listing_created_without_stripe_connect"` with the Owner's userId and listingId.
- [x] Pass / [ ] Fail

#### UAT-SCG-02: Owner creates a service listing without Stripe Connect

- **Actor:** Owner
- **Preconditions:** Same as 01.
- **Steps:**
  1. Log in as Owner.
  2. Go to `/dashboard/services/listings/create`.
  3. Fill out a service listing and submit.
- **Expected:**
  - Form renders, no Connect gate, listing is created.
  - Terminal log includes `"event":"listing_created_without_stripe_connect"` with `bookingType` absent and the new service listing's id.
- [x] Pass / [ ] Fail

### §4.2 — Soft-prompt banner (Epic 7)

#### UAT-SCG-03: Banner appears on dashboard when Owner has a published listing and is `not_started`

- **Actor:** Owner
- **Preconditions:** UAT-SCG-01 done; the listing must be `approved` and `is_active = true` (the banner uses the same definition as "active listing"). If your dev seed doesn't auto-approve, log in as Admin and approve the listing, **or** run:

  ```sql
  UPDATE listings
  SET approval_status = 'approved', status = 'available', is_active = true
  WHERE owner_id = (SELECT id FROM "user" WHERE email = '<owner-email>')
    AND name = '<listing-name>';
  ```

- **Steps:**
  1. Log in as Owner. Visit `/dashboard`.
- **Expected:**
  - A yellow/amber banner is visible above the dashboard content.
  - Copy: "Connect your payout account so you can accept bookings the moment a request comes in."
  - CTA button "Connect now" links to `/dashboard/payments/earnings-and-payouts` (no `returnTo` in the URL).
- [x] Pass / [ ] Fail

#### UAT-SCG-04: Banner dismissal is session-scoped

- **Actor:** Owner
- **Preconditions:** UAT-SCG-03 passing.
- **Steps:**
  1. On `/dashboard`, click the banner's dismiss (×) button.
  2. Navigate to another dashboard page (e.g. `/dashboard/listings`).
  3. Refresh the tab (`Cmd+R`).
  4. Close the tab and open a fresh tab (or new private window), log in again, visit `/dashboard`.
- **Expected:**
  - After step 1: banner disappears immediately.
  - Step 2: banner still hidden.
  - Step 3: banner still hidden (same session).
  - Step 4: banner reappears (new session).
- [x] Pass / [ ] Fail

#### UAT-SCG-05: Banner hidden when Owner has no published listings

- **Actor:** Owner
- **Preconditions:** Owner has no `approved`+`available`/`rented` listings (you can flip one to inactive via DB: `UPDATE listings SET is_active = false WHERE ...`).
- **Steps:**
  1. Visit `/dashboard`.
- **Expected:** No banner shown.
- [x] Pass / [ ] Fail

#### UAT-SCG-06: Banner copy reflects `pending` state mid-onboarding

- **Actor:** Owner
- **Preconditions:** UAT-SCG-03 listing visible. To simulate `pending` state (i.e. Stripe account exists but `chargesEnabled`/`payoutsEnabled` are still false):

  ```sql
  UPDATE "user"
  SET stripe_connected_account_id = 'acct_uat_dummy',
      connect_charges_enabled = false,
      connect_payouts_enabled = false,
      connect_onboarding_complete = false
  WHERE email = '<owner-email>';
  ```

- **Steps:**
  1. Reload `/dashboard` (open a new session if you dismissed in 04).
- **Expected:**
  - Banner copy: "Finish setting up your payout account to accept bookings."
  - CTA label: "Finish setup".
- **Cleanup:** revert to `not_started` via §3.7 SQL before continuing.
- [x] Pass / [ ] Fail

### §4.3 — Backend gate + frontend redirect, rentals (Epics 3, 5)

#### UAT-SCG-07: Renter submits a rental request to Owner

- **Actor:** Renter
- **Preconditions:** UAT-SCG-01 listing is approved and visible in the community.
- **Steps:**
  1. Log in as Renter.
  2. Browse to the Owner's listing.
  3. Submit a rental request with valid dates (start within 48h is fine) and a saved payment method.
- **Expected:**
  - Request submitted; appears in Renter's "Renting" list as `pending`.
  - DB check (optional):

    ```sql
    SELECT id, status, expires_at,
           expires_at - created_at AS lifetime
    FROM rental_requests
    WHERE renter_id = (SELECT id FROM "user" WHERE email = '<renter-email>')
    ORDER BY created_at DESC LIMIT 1;
    ```

    `expires_at` is set, `lifetime` ≈ 72 hours.

- [x] Pass / [ ] Fail

#### UAT-SCG-08: Owner clicks Accept while not Connect-verified → pre-check modal → JIT mode

- **Actor:** Owner
- **Preconditions:** UAT-SCG-07 request exists; Owner is still `not_started`.
- **Steps:**
  1. Log in as Owner.
  2. Open the rental request detail page (under `/dashboard/rental/...` or via the request in "Lending").
  3. Click Accept.
  4. In the modal that opens, verify the copy, then click the primary CTA.
- **Expected:**
  - **No** generic error toast appears.
  - Step 3 opens the **Payout Setup Required** modal — it does **not** open the normal Approve Request modal and does **not** immediately navigate.
    - Title: **"Connect your payout account"**
    - Description: "Before you can accept this booking, connect a payout account so we can pay you when the renter is charged."
    - Primary CTA label: **"Connect now"**. Secondary label: **"Not now"**.
  - Clicking **Not now** closes the modal and leaves the user on the rental request page; status stays `pending`.
  - Clicking **Connect now** navigates the browser to `/dashboard/payments/earnings-and-payouts?returnTo=<the rental request URL>` (verify the URL bar).
  - The rental request status is **still** `pending` either way (no state change despite the click) — verify in DB or by reloading the request page.
  - Terminal logs do **not** include `"event":"accept_blocked_payment_setup_required"` for this click — the pre-check intercepts before any API call. That log line is reserved for the 403 safety-net path exercised in §4.6 (UAT-SCG-16).
- [x] Pass / [ ] Fail

### §4.4 — JIT mode rendering and Stripe Connect completion (Epic 6) — **one-way operation**

> ⚠️ Once you complete Stripe Connect onboarding in UAT-SCG-11, the Owner is permanently `verified` for this UAT session. To re-run §4.1–§4.3 against this Owner, run the §3.7 reset SQL first.

#### UAT-SCG-09: JIT page hides normal payments chrome and uses contextual copy

- **Actor:** Owner
- **Preconditions:** Continuing from UAT-SCG-08 (on the JIT URL).
- **Steps:**
  1. Inspect the page rendered at `/dashboard/payments/earnings-and-payouts?returnTo=...`.
- **Expected:**
  - The "Payment methods" / "Earnings & payouts" tab bar (`PaymentsTabs`) is **not** visible.
  - The owner-section earnings dashboard and the payment explainer section are **not** visible.
  - The Stripe Connect onboarding card is the dominant element; heading reads **"Connect your payout account to accept this booking"** (note: this is `not_started` copy — for `restricted`, see UAT-SCG-16).
  - Description, tips list ("Select Individual", "SSN + DOB are required", "Use a bank account in your name"), and the embedded Stripe Connect Onboarding component are present.
  - Terminal log: `"event":"connect_onboarding_started_from_accept"` with the Owner's `onboardingStatus: "not_started"`.
- [x] Pass / [ ] Fail

#### UAT-SCG-10: `returnTo` validation rejects unsafe values

- **Actor:** Owner
- **Preconditions:** Logged in as Owner; doesn't matter what their Connect state is.
- **Steps:** Visit each URL in turn (try in incognito or after dismissing earlier banners) and observe behavior:
  1. `/dashboard/payments/earnings-and-payouts?returnTo=https://evil.example.com`
  2. `/dashboard/payments/earnings-and-payouts?returnTo=//evil.example.com`
  3. `/dashboard/payments/earnings-and-payouts?returnTo=/login`
  4. `/dashboard/payments/earnings-and-payouts?returnTo=/dashboard/rental/abc`
- **Expected:**
  - URLs 1–3 render the **normal** earnings page (with `PaymentsTabs` visible) — `returnTo` was rejected, no JIT mode.
  - URL 4 renders **JIT mode** (no tabs) — accepted.
- [x] Pass / [ ] Fail

#### UAT-SCG-11: Complete real Stripe Connect onboarding and auto-return to the booking

- **Actor:** Owner
- **Preconditions:** UAT-SCG-09 passing; webhook listener (`stripe listen`) is running (§3.3).
- **Steps:**
  1. From the JIT page, work through the embedded Stripe Connect Onboarding component using the test values from §3.4. Choose "Individual", use any plausible name matching the SSN `000-00-0000`.
  2. Submit. The component will indicate completion (Stripe auto-approves test accounts).
  3. Watch your terminals:
     - App server: `"event":"connect_onboarding_completed_from_accept"` log line.
     - Stripe CLI: `account.updated` webhook delivered with `200`.
  4. After completion the page should navigate to `returnTo` (the original rental request).
  5. On the rental request page, click Accept again.
- **Expected:**
  - Step 3: both log lines appear.
  - Step 4: you land back on the rental request page (no manual navigation needed).
  - Step 5: the request transitions to `approved` (Accept succeeded). Renter sees the change in their "Renting" view.
- [x] Pass / [ ] Fail

#### UAT-SCG-12: Verified Owner visiting a JIT URL is bounced to `returnTo` automatically

- **Actor:** Owner (now `verified` from 11)
- **Preconditions:** Owner is `verified`.
- **Steps:**
  1. Visit `/dashboard/payments/earnings-and-payouts?returnTo=/dashboard/rentals` directly.
- **Expected:**
  - The server responds with a redirect; you land on `/dashboard/rentals` without ever seeing JIT content.
- [x] Pass / [ ] Fail

### §4.5 — Services parity (Epics 3, 5, 6 — service path)

> If you haven't completed the rental flow yet, services scenarios can be done with the _same_ Owner if you reset Connect state via §3.7. Otherwise, the service-side gate is structurally identical; spot-check the redirect and skip a full repeat.

#### UAT-SCG-13: Renter submits a service booking; Provider clicks Accept while not verified → pre-check modal → JIT mode

- **Actor:** Renter, then Owner (acting as service Provider)
- **Preconditions:** Owner is `not_started` (run §3.7 reset SQL if needed); the service listing from UAT-SCG-02 is approved.
- **Steps:**
  1. As Renter, request a booking on the service listing.
  2. As Owner, open the booking detail (`/dashboard/services/bookings/<id>`) and click Accept.
  3. In the modal that opens, verify the copy, then click the primary CTA.
- **Expected:**
  - Step 2 opens the **Payout Setup Required** modal (same shared component as UAT-SCG-08) — it does **not** open the normal Accept Booking modal and does **not** immediately navigate.
    - Title: **"Connect your payout account"**, CTA **"Connect now"**, secondary **"Not now"**.
  - **Not now** closes the modal; booking stays `pending`.
  - **Connect now** navigates to `/dashboard/payments/earnings-and-payouts?returnTo=/dashboard/services/bookings/<id>`.
  - No error toast at any step.
  - Booking status remains `pending` either way.
  - Terminal logs do **not** include `"event":"accept_blocked_payment_setup_required"` for this click — pre-check intercepts before any API call. (The server-side log fires only when the 403 safety net activates — see UAT-SCG-16.)
- [x] Pass / [ ] Fail

#### UAT-SCG-14: JIT completion auto-returns to the service booking

- **Actor:** Owner
- **Preconditions:** Continuing from 13.
- **Steps:**
  1. Complete Connect onboarding inside the JIT view (or if Owner is already verified from 11, skip directly).
  2. After auto-return, click Accept on the service booking.
- **Expected:**
  - Booking transitions to `accepted`; Renter sees the change.
- [x] Pass / [ ] Fail

### §4.6 — Capability regression (Epics 1, 6, 7)

#### UAT-SCG-15: Cached-flag regression — verified Owner whose `connect_payouts_enabled` flips false in DB

- **Actor:** Owner (already `verified`)
- **Preconditions:** A new pending rental request from Renter (resubmit one) and Owner is currently `verified`.
- **Steps:**
  1. Simulate Stripe regression in the DB:

     ```sql
     UPDATE "user"
     SET connect_payouts_enabled = false
     WHERE email = '<owner-email>';
     ```

  2. Log in as Owner and visit `/dashboard`. (The banner check.)
  3. Open the pending rental request and click Accept.
  4. In the modal that opens, inspect the copy, then click the primary CTA.
  5. On the JIT page, inspect the heading.

- **Expected:**
  - Step 2: dashboard banner copy "Your payout account needs an update. Bookings can't be accepted until this is fixed." CTA "Update now".
  - Step 3: the **Payout Setup Required** modal opens (pre-check catches the stale cached flag).
    - Modal title: **"Your payout account needs an update"**
    - Description: "Your payout account is missing information. Update it so this booking can be accepted and you can get paid."
    - Primary CTA: **"Update now"**. No toast.
  - Step 4: clicking **Update now** navigates to `/dashboard/payments/earnings-and-payouts?returnTo=<rental request URL>`.
  - Step 5: JIT heading reads **"Your payout account needs more information"** (the `restricted` copy).
  - No `"event":"accept_blocked_payment_setup_required"` log line for this click — pre-check intercepted, no API call. The server-side log is exercised by UAT-SCG-16, where cached flags still say verified.
- **Cleanup:** restore with `UPDATE "user" SET connect_payouts_enabled = true WHERE email = '<owner-email>';`.
- [x] Pass / [ ] Fail

#### UAT-SCG-16: `assertConnectReady` catches live capability regression even when cached flags say verified

- **Actor:** Owner
- **Preconditions:** Owner is fully verified in your dev DB **but** their Stripe Connect account in the dashboard has had a payouts requirement reintroduced (or use the Stripe Dashboard to disable payouts on the test account). If that's hard to reproduce, run:

  ```sql
  -- Force a "stale cached verified, live restricted" state:
  UPDATE "user"
  SET connect_charges_enabled = true,
      connect_payouts_enabled = true,
      connect_onboarding_complete = true
  WHERE email = '<owner-email>';
  -- Then disable payouts capability in Stripe test dashboard for acct_...
  ```

  > This is the one path where the 403 safety net (not the pre-check modal) is exercised — the cached flags say verified, so the pre-check sees nothing wrong and lets the normal Approve flow open. Only the server's live `stripe.accounts.retrieve` catches the regression.

- **Steps:**
  1. Have Renter submit a fresh rental request.
  2. As Owner, click Accept. The normal Approve Request modal opens (not the pre-check modal — cached flags say verified).
  3. Click **Approve & Charge Payment** inside that modal to send the request.
- **Expected:**
  - The server returns 403 `PAYMENT_SETUP_REQUIRED`; the client's 403 handler redirects to JIT mode with `restricted` copy. **No toast.**
  - The user's DB row is updated to reflect the regression (`connect_payouts_enabled = false`) — verify in DB after the click.
  - Log line: `"event":"accept_blocked_payment_setup_required"` with `onboardingStatus: "restricted"` and the regression marker.
- [x] Pass / [ ] Fail

### §4.7 — Negative path: server unreachable

#### UAT-SCG-17: Stripe-unreachable failure mode

- **Actor:** Owner
- **Preconditions:** Hard to reproduce without manipulating network. **Optional / skip in normal UAT.** If you want to exercise it, temporarily set `STRIPE_SECRET_KEY` to an invalid value, restart the dev server, then click Accept while cached flags say verified.
- **Expected:**
  - Accept returns 403 with `reason: "stripe_unreachable"` in the response body (visible in browser devtools Network tab).
  - User redirected to JIT mode.
- [ ] Pass / [ ] Fail / [ ] Skipped

### §4.8 — Pending-booking expiry cron (Epic 8)

#### UAT-SCG-18: Cron endpoint requires CRON_SECRET

- **Actor:** Tester (curl)
- **Steps:**
  1. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/expire-pending-bookings`
  2. `curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer wrong" http://localhost:3000/api/cron/expire-pending-bookings`
  3. `curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/expire-pending-bookings | jq .`
- **Expected:**
  - Step 1 → `401`.
  - Step 2 → `401`.
  - Step 3 → `200` and JSON of shape `{ success: true, rentalsChecked, servicesChecked, expiredCount, failedCount, timestamp }`.
- [ ] Pass / [ ] Fail

#### UAT-SCG-19: Cron auto-cancels a pending rental whose `expires_at` has passed

- **Actor:** Tester (DB + curl)
- **Preconditions:** A pending rental request exists between Owner (not verified) and Renter. Use the one from UAT-SCG-07 or submit a fresh one.
- **Steps:**
  1. Backdate `expires_at` so the cron picks it up:

     ```sql
     UPDATE rental_requests
     SET expires_at = NOW() - interval '1 hour'
     WHERE id = '<request-id>' AND status = 'pending';
     ```

  2. Trigger the cron:

     ```bash
     curl -s -H "Authorization: Bearer $CRON_SECRET" \
       http://localhost:3000/api/cron/expire-pending-bookings | jq .
     ```

  3. Re-query the row:

     ```sql
     SELECT status, cancellation_reason, cancelled_at
     FROM rental_requests WHERE id = '<request-id>';
     ```

  4. Log in as Renter, check notifications.
  5. Log in as Owner, check notifications.

- **Expected:**
  - Cron response: `expiredCount` ≥ 1.
  - Row is now `status = 'cancelled'`, `cancellation_reason = 'expired_no_acceptance'`, `cancelled_at` set.
  - Renter notification copy mentions "the owner did not respond in time" and does **not** mention Stripe/payouts/Connect.
  - Owner notification copy includes the soft-prompt "Set up your payout account..." and links to `/dashboard/payments/earnings-and-payouts` (because Owner is not verified). When Owner is verified, Owner copy is neutral instead.
  - Terminal log: `"event":"pending_booking_expired_owner_not_ready"` with `bookingType: "rental"`, the bookingId, and `onboardingStatus` for the Owner.
- [ ] Pass / [ ] Fail

#### UAT-SCG-20: Cron releases the deposit pre-auth on a pending rental

- **Actor:** Tester
- **Preconditions:** A pending rental request that had a security deposit > 0 captured. Confirm `security_deposit_auth_id` is non-null:

  ```sql
  SELECT id, security_deposit_auth_id FROM rental_requests WHERE id = '<request-id>';
  ```

- **Steps:**
  1. Backdate `expires_at` and trigger the cron as in UAT-SCG-19.
  2. Open the corresponding PaymentIntent in your Stripe test dashboard (or `stripe payment_intents retrieve <id>`).
- **Expected:**
  - PaymentIntent status is `canceled` (Stripe-side).
  - App-side row is `cancelled` as in 19.
  - If deposit release errored for some reason, the row is still expired and a `expire-pending-bookings: deposit hold release failed` error appears in the terminal; `expiredCount` still increments. (This is the per-row resilience contract.)
- [ ] Pass / [ ] Fail

#### UAT-SCG-21: Cron auto-cancels a pending service booking

- **Actor:** Tester
- **Preconditions:** A pending service booking (from UAT-SCG-13 or a fresh one) between Owner and Renter.
- **Steps:** Same shape as UAT-SCG-19 but against `service_bookings`:

  ```sql
  UPDATE service_bookings SET expires_at = NOW() - interval '1 hour'
  WHERE id = '<booking-id>' AND status = 'pending';
  ```

  Then re-run the cron and re-query.

- **Expected:**
  - Row is `cancelled` with `cancellation_reason = 'expired_no_acceptance'`.
  - Both parties get notifications; renter copy is neutral; provider copy includes payout prompt iff not verified.
  - Log line: `"event":"pending_booking_expired_owner_not_ready"` with `bookingType: "service"` (when provider isn't verified).
- [ ] Pass / [ ] Fail

#### UAT-SCG-22: Cron is idempotent under concurrent ticks

- **Actor:** Tester
- **Steps:**
  1. Backdate a pending request as in 19.
  2. Fire the cron twice in a row:

     ```bash
     for i in 1 2; do
       curl -s -H "Authorization: Bearer $CRON_SECRET" \
         http://localhost:3000/api/cron/expire-pending-bookings | jq .
     done
     ```

- **Expected:**
  - First call: `expiredCount = 1` (for that row).
  - Second call: `expiredCount = 0` — the `WHERE status='pending'` clause in `markRequestExpired` is the guard.
  - The row's `cancelled_at` did **not** change on the second run.
  - No duplicate notifications were sent (check Renter's notification list).
- [ ] Pass / [ ] Fail

### §4.9 — JIT URL safety (Epic 6)

#### UAT-SCG-23: A JIT URL with an unrecognized `returnTo` falls back to the normal page

- Covered in UAT-SCG-10; this is the same safety contract. Tick here if you ran 10.
- [ ] Pass / [ ] Fail / [ ] N/A

### §4.10 — Structured logging spot-check (Epic 10 / "Logging" section of design)

#### UAT-SCG-24: Each gating event was observed at least once

In your terminal scrollback (or pipe `bun run dev` through `tee` to a file), confirm you saw lines containing each event below at least once during the prior scenarios:

```
"event":"listing_created_without_stripe_connect"     <- §4.1
"event":"accept_blocked_payment_setup_required"      <- §4.6 (UAT-SCG-16 only — the live-regression / 403 safety-net path)
"event":"connect_onboarding_started_from_accept"     <- §4.4
"event":"connect_onboarding_completed_from_accept"   <- §4.4 (real Stripe finish)
"event":"pending_booking_expired_owner_not_ready"    <- §4.8
```

- **Note:** `accept_blocked_payment_setup_required` is a server-side log emitted by `assertConnectReady` when the API returns 403. The pre-check modal in §4.3 / §4.5 intercepts on the client before any API call, so it does **not** produce this log. Only the cached-flags-say-verified-but-live-says-restricted path in UAT-SCG-16 still hits the server and triggers the event.
- **Expected:** All five strings present in your run history. If UAT-SCG-16 was skipped, mark `accept_blocked_payment_setup_required` as **N/A** rather than failing this scenario.
- [ ] Pass / [ ] Fail / [ ] N/A on missing event

---

## 5. Sign-off

| Section                       | Tester | Date | Pass count | Fail count |
| ----------------------------- | ------ | ---- | ---------- | ---------- |
| §4.1 Listing creation         |        |      |            |            |
| §4.2 Banner                   |        |      |            |            |
| §4.3 Rentals gate + redirect  |        |      |            |            |
| §4.4 JIT mode (rentals)       |        |      |            |            |
| §4.5 Services parity          |        |      |            |            |
| §4.6 Capability regression    |        |      |            |            |
| §4.7 Negative path (optional) |        |      |            |            |
| §4.8 Expiry cron              |        |      |            |            |
| §4.9 returnTo safety          |        |      |            |            |
| §4.10 Logging                 |        |      |            |            |

**Release blocker rule:** any failure in §4.3, §4.4, §4.6, or §4.8 blocks release. §4.7 is informational. Banner / logging failures are P1 but not blockers.
