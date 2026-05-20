# Stripe Connect Gating — Design Document

## Overview

This design moves the Stripe Connect requirement from listing creation to booking acceptance, with **two enforcement layers**: a fast cached-flag check that short-circuits the API, and an authoritative live `stripe.accounts.retrieve()` call made immediately before any PaymentIntent or transfer. Users without a connected Stripe account can create, publish, and receive booking requests on listings; the requirement only fires at the accept step. When it fires, the owner is routed to the existing earnings-and-payouts page in a "return-after-onboarding" mode that returns them to the originating booking on completion.

### Design Decisions and Refinements From Requirements

These are choices the user made during the design dialogue. They resolve open questions in `1-requirements.md`:

1. **JIT onboarding form factor: extend the existing earnings-and-payouts page, not a new route.** Req 4 in `1-requirements.md` refers to a "JIT modal." This design resolves that to a `returnTo`-aware mode of the existing page at `/dashboard/payments/earnings-and-payouts` ([page.tsx](src/app/dashboard/payments/earnings-and-payouts/page.tsx)). That page already hosts the embedded onboarding component when the user is not onboarded; we add a `?returnTo=<relative-dashboard-url>` query param that (a) hides tabs and the earnings dashboard chrome, (b) renders accept-context copy, and (c) navigates back to `returnTo` on completion. All references to "JIT modal" or "JIT page" in `1-requirements.md` are reinterpreted as "JIT mode of the earnings-and-payouts page" for purposes of this design.
2. **Analytics: structured server logs only.** Req 10's events are emitted via the existing logger with a consistent shape. No new analytics vendor is introduced.
3. **Rollout: atomic deploy in one PR.** No feature flag. The old listing-creation gates and the new acceptance gates ship together. Reversibility is via revert.
4. **Expiry mechanism: persisted `expiresAt` column.** Both `rentalRequests` and `serviceBookings` get a new `expiresAt` timestamp set at creation time. The expiry cron queries on this column.

### Constraints From Existing System

- US-only Stripe Connect Express accounts; not changed here.
- Embedded `ConnectAccountOnboarding` already in use at [src/features/payments/components/connect-onboarding.tsx](src/features/payments/components/connect-onboarding.tsx) — reused as-is.
- The `account.updated` webhook at [src/services/stripe/webhook-handlers.ts:82-93](src/services/stripe/webhook-handlers.ts#L82-L93) keeps cached user flags in sync. This design does not modify the webhook.
- GitHub Actions cron at [.github/workflows/cron-jobs.yml](.github/workflows/cron-jobs.yml) is the driver — the workflow `curl`s each `/api/cron/*` route with a `CRON_SECRET` bearer token. New cron jobs are added as steps in the existing hourly or daily job and follow the existing `verifyCronSecret()` pattern on the route handler. (`vercel.json` contains one vestigial cron entry; it is not relied on.)
- `sendNotification()` at [src/features/notifications/utils/send-notification.ts](src/features/notifications/utils/send-notification.ts) handles in-app + email + push in one call.

## Architecture

### High-Level Request Flow

```mermaid
sequenceDiagram
  participant Owner
  participant UI as Accept Dialog
  participant API as /api/.../approve|accept
  participant Svc as RentalService / ServiceBookingService
  participant Helper as getPayoutReadiness + assertConnectReady
  participant Stripe
  participant DB

  Owner->>UI: Click Accept
  UI->>API: POST approve / accept

  API->>Svc: approveRentalRequest / acceptBooking
  Svc->>Helper: getPayoutReadiness(user)
  alt Cached flags say not ready
    Helper-->>Svc: { onboardingStatus: 'pending' | 'restricted' | 'not_started' }
    Svc-->>API: throw PaymentSetupRequiredError
    API-->>UI: 403 PAYMENT_SETUP_REQUIRED
    UI->>Owner: Redirect to /dashboard/payments/earnings-and-payouts?returnTo=...
  else Cached flags say verified
    Helper->>Stripe: stripe.accounts.retrieve(accountId)
    alt Live: charges_enabled & payouts_enabled both true
      Helper->>DB: (no-op; flags already correct)
      Helper-->>Svc: { onboardingStatus: 'verified' }
      Svc->>Stripe: create PaymentIntent, etc. (existing flow)
      Svc-->>API: success
    else Live: capability regression
      Helper->>DB: update connectChargesEnabled/connectPayoutsEnabled
      Helper-->>Svc: { onboardingStatus: 'restricted' }
      Svc-->>API: throw PaymentSetupRequiredError
      API-->>UI: 403 PAYMENT_SETUP_REQUIRED
    end
  end
```

### Module Layout

```
src/
├── features/
│   ├── payments/
│   │   └── lib/
│   │       ├── payout-readiness.ts        (NEW — getPayoutReadiness, types)
│   │       └── assert-connect-ready.ts    (NEW — live re-check helper)
│   ├── rentals/
│   │   └── services/
│   │       └── rental-service.ts          (MODIFIED — call assertConnectReady)
│   └── services/
│       └── services/
│           └── service-booking-service.ts (MODIFIED — call assertConnectReady)
├── app/
│   ├── api/
│   │   └── cron/
│   │       └── expire-pending-bookings/   (NEW — cron route)
│   │           └── route.ts
│   └── dashboard/
│       ├── payments/
│       │   └── earnings-and-payouts/
│       │       └── page.tsx               (MODIFIED — accept returnTo query param)
│       ├── listings/
│       │   └── add/page.tsx               (MODIFIED — remove gate)
│       └── services/
│           └── listings/
│               └── create/page.tsx        (MODIFIED — remove gate)
├── features/
│   └── listings/
│       └── services/
│           └── listing-service.ts         (MODIFIED — remove gate)
├── db/
│   └── schemas/
│       ├── rentals.schema.ts              (MODIFIED — add expiresAt)
│       └── services.schema.ts             (MODIFIED — add expiresAt)
└── features/
    └── payments/
        └── components/
            ├── earnings-and-payouts-page-client.tsx  (MODIFIED — returnTo mode)
            └── payout-readiness-banner.tsx           (NEW — soft prompt)
```

### Rollout

One PR containing the schema migration, the new helpers, the cron job, the earnings-and-payouts `returnTo` mode, the removed listing-creation gates, and the acceptance enforcement. No feature flag. Verified in staging with a Stripe test account in each state (`not_started`, `pending`, `restricted`, `verified`). Reversibility is `git revert` + roll back migration.

## Components and Interfaces

### 1. `getPayoutReadiness(user)` — derived view

**Location:** `src/features/payments/lib/payout-readiness.ts`

```ts
export type OnboardingStatus =
  | "not_started"
  | "pending"
  | "restricted"
  | "verified";

export type PayoutReadiness = {
  stripeConnected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingStatus: OnboardingStatus;
};

export function getPayoutReadiness(user: {
  stripeConnectedAccountId: string | null;
  connectChargesEnabled: boolean;
  connectPayoutsEnabled: boolean;
  connectOnboardingComplete: boolean;
}): PayoutReadiness;
```

**Logic:**

- `stripeConnectedAccountId === null` → `{ stripeConnected: false, onboardingStatus: 'not_started' }`.
- Has accountId, both flags true → `onboardingStatus: 'verified'`.
- Has accountId, both flags false, `connectOnboardingComplete === false` → `onboardingStatus: 'pending'`.
- Has accountId, partial capability (one flag true, one false) OR `connectOnboardingComplete === true` but a flag is false → `onboardingStatus: 'restricted'`.

**Callers:** UI gating (accept dialog, soft-prompt banner), the JIT onboarding page (to choose copy variant), `assertConnectReady` (for fast-path short-circuit), logging events.

### 2. `assertConnectReady(userId, opts)` — authoritative gate

**Location:** `src/features/payments/lib/assert-connect-ready.ts`

```ts
export type AssertConnectReadyOptions = {
  /** Booking type for log context. */
  bookingType: "rental" | "service";
  /** Booking ID for log context. */
  bookingId: string;
  /** Stripe SDK client (injected for testability). */
  stripe: Stripe;
};

export async function assertConnectReady(
  userId: string,
  opts: AssertConnectReadyOptions,
): Promise<void>;
```

**Behavior:**

1. Load the user's cached flags via `userDAL.findById(userId)`.
2. Compute `readiness = getPayoutReadiness(user)`.
3. If `readiness.onboardingStatus !== 'verified'` → emit `accept_blocked_payment_setup_required` log event and throw `PaymentSetupRequiredError({ onboardingStatus, missingCapabilities })`. No Stripe call.
4. Otherwise, call `stripe.accounts.retrieve(user.stripeConnectedAccountId)` with one retry on `StripeRateLimitError` / `StripeAPIError` / `StripeConnectionError` (1-second backoff).
5. If `account.charges_enabled` AND `account.payouts_enabled` both true → return; no flag update needed.
6. If regression (either is false) → update `users.connectChargesEnabled`, `users.connectPayoutsEnabled`, recompute `connectOnboardingComplete`, emit `accept_blocked_payment_setup_required` log event with `{ regression: true }`, throw `PaymentSetupRequiredError`.
7. If the retrieve call fails after retry → fail closed: throw `PaymentSetupRequiredError({ onboardingStatus: 'unknown', reason: 'stripe_unreachable' })`.

**Why this shape:** Combining the cached-flag fast path and the live re-check in one helper means the two service paths (`RentalService`, `ServiceBookingService`) call exactly one function, in exactly one place, with no opportunity to skip the live check.

### 3. `PaymentSetupRequiredError` — typed error

**Location:** `src/features/payments/lib/errors.ts`

```ts
export class PaymentSetupRequiredError extends Error {
  readonly code = "PAYMENT_SETUP_REQUIRED";
  constructor(
    public details: {
      onboardingStatus: OnboardingStatus | "unknown";
      missingCapabilities?: ("charges" | "payouts")[];
      reason?: "stripe_unreachable";
    },
  ) {
    super("Payment setup required");
  }
}
```

The two API route handlers translate this into:

```
HTTP 403
{
  "error": "PAYMENT_SETUP_REQUIRED",
  "onboardingStatus": "pending",
  "missingCapabilities": ["payouts"]
}
```

### 4. Modified `RentalService.approveRentalRequest`

**Location:** `src/features/rentals/services/rental-service.ts`

Replace the existing `userDAL.isConnectOnboardingComplete()` block at lines 416-423 with a single call:

```ts
await assertConnectReady(rentalRequest.ownerId, {
  bookingType: "rental",
  bookingId: rentalRequest.id,
  stripe,
});
```

This is the only Stripe Connect check on this code path. All downstream PaymentIntent creation continues to assume readiness.

### 5. Modified `ServiceBookingService.acceptBooking`

**Location:** `src/features/services/services/service-booking-service.ts`

Replace the existing `assertProviderConnectForCharge(providerId)` call at lines 297-303 with:

```ts
await assertConnectReady(providerId, {
  bookingType: "service",
  bookingId: bookingId,
  stripe,
});
```

`assertProviderConnectForCharge` can be deleted as part of this change (its callers were limited to this one path).

### 6. Listing-creation gate removal

Three sites delete the existing Stripe Connect precondition:

- [src/app/dashboard/listings/add/page.tsx:21-50](src/app/dashboard/listings/add/page.tsx#L21-L50) — remove the readiness check and the error-state UI; render the listing form unconditionally for authenticated users.
- [src/app/dashboard/services/listings/create/page.tsx:35-59](src/app/dashboard/services/listings/create/page.tsx#L35-L59) — same.
- [src/features/listings/services/listing-service.ts:164-177](src/features/listings/services/listing-service.ts#L164-L177) — remove `userDAL.isConnectOnboardingComplete()` precondition. Service listing creation has an equivalent block to remove.

### 7. JIT Mode on the Existing Earnings-and-Payouts Page

**Location:** [src/app/dashboard/payments/earnings-and-payouts/page.tsx](src/app/dashboard/payments/earnings-and-payouts/page.tsx) (server component) + [src/features/payments/components/earnings-and-payouts-page-client.tsx](src/features/payments/components/earnings-and-payouts-page-client.tsx) (client island).

**Route:** existing — `/dashboard/payments/earnings-and-payouts?returnTo=<relative-dashboard-url>`

**Why extend instead of create a new route:** The existing page is already where users connect their Stripe account. When not onboarded, it renders `<InitiateStripeOnboarding />`; when onboarded, it renders `<OwnerSection />` plus tabs and an explainer. A parallel route would duplicate this logic and risk drift. We add a `returnTo` query param that adjusts the page's behavior while keeping a single source of truth for the onboarding entry point.

**Behavior changes on the page:**

1. Server component reads the `returnTo` query param. Validates it:
   - Must start with `/dashboard/` (regex: `/^\/dashboard\/[^/].*/` to reject `//evil.com`-style schemes).
   - Absolute URLs and protocol-relative URLs rejected (prevents open-redirect).
   - If invalid or missing, the page renders in its current behavior (no JIT mode).
2. Computes `readiness = getPayoutReadiness(user)` and passes both `returnTo` and `readiness` to the client component.
3. **When `returnTo` is set:**
   - Hide the `<PaymentsTabs />` chrome, `<OwnerSection />`, and `<PaymentExplainerSection />`.
   - Render only the onboarding component (`<InitiateStripeOnboarding />` / `<ConnectOnboarding />`) with accept-context copy varying by `readiness.onboardingStatus`:
     - `not_started` → "Connect your payout account to accept this booking"
     - `pending` → "Finish connecting your payout account"
     - `restricted` → "Your payout account needs more information"
     - `verified` → `router.replace(returnTo)` immediately (someone followed a stale link)
   - On onboarding completion (the existing `/api/stripe/update-onboarding-status` callback succeeds), `router.push(returnTo)` instead of switching to `<OwnerSection />`.
4. **When `returnTo` is not set:** Page renders exactly as it does today — no behavioral change.

**Why a page-level mode, not a modal:** `ConnectAccountOnboarding` is tall (Stripe's hosted flow renders dozens of form fields and KYC sub-screens). A modal can clip content and breaks on mobile. Full-page rendering sidesteps both issues, and the existing page already handles the embedded layout correctly.

**Copy never uses:** "SSN", "KYC", "verification", "tax ID". Only "payout account", "get paid", "connect your bank".

### 8. Accept dialog — error handling and redirect

**Location:** `src/features/rentals/components/renting-lending/approve-request-dialog.tsx` and the equivalent service-booking accept component.

**Change:** On `403 PAYMENT_SETUP_REQUIRED` from the accept API:

- Suppress the generic error toast.
- Navigate to `/dashboard/payments/earnings-and-payouts?returnTo=<current-booking-url>`.
- The booking remains in `pending` state (the server did not transition it).

No pre-flight check is added on the client. We always attempt the accept and react to the 403 — this is simpler, races-safe (cache could be stale either way), and means the JIT redirect is driven by the authoritative server check, not by a possibly-stale client view.

### 9. Soft-prompt banner

**Location:** `src/components/payments/payout-readiness-banner.tsx`

**Where it renders:** As a dismissible banner inside the dashboard layout, visible on all `/dashboard/*` routes where the current user has at least one published listing AND `onboardingStatus !== 'verified'`.

**Dismissal:** Per-session (sessionStorage key `payout-readiness-banner-dismissed`). Resets on next session while readiness remains incomplete.

**Copy variants** (matching `onboardingStatus`):

- `not_started` → "Connect your payout account so you can accept bookings the moment a request comes in." CTA: "Connect now"
- `pending` → "Finish setting up your payout account to accept bookings." CTA: "Finish setup"
- `restricted` → "Your payout account needs an update. Bookings can't be accepted until this is fixed." CTA: "Update now"

All CTAs link to `/dashboard/payments/earnings-and-payouts` (no `returnTo` — the soft prompt is dashboard-level, not booking-specific; after onboarding the user lands on the normal earnings dashboard).

### 10. Pending-booking expiry cron

**Location:** `src/app/api/cron/expire-pending-bookings/route.ts`

**Schedule:** Hourly. Added as a new step in the `hourly` job of [.github/workflows/cron-jobs.yml](.github/workflows/cron-jobs.yml), alongside the existing `monitor-deposit-expiry`, `detect-stale-processing`, and `release-reviews` steps. No changes to `vercel.json`. The workflow `curl`s the new route with the existing `CRON_SECRET` bearer.

**Why hourly:** The pending-booking expiry window is 72 hours, so the cron's own precision past ~1 hour is invisible to users. Hourly fits the existing batch (no new workflow needed), keeps renter notifications fresh (within an hour of actual expiry), and is cheap to run.

**Logic per tick:**

1. Verify `CRON_SECRET` via existing `verifyCronSecret()`.
2. Query both tables for rows where `status = 'pending'` AND `expiresAt < NOW()`.
3. For each rental request:
   - Update `status = 'cancelled'`, `cancelledAt = NOW()`, with a `cancellationReason = 'expired_no_acceptance'` (new enum value or string).
   - Release any pre-authorized deposit hold (per existing payment lifecycle).
   - `sendNotification()` to renter ("The owner did not respond in time").
   - `sendNotification()` to owner — if `getPayoutReadiness(owner).onboardingStatus !== 'verified'`, copy includes a soft prompt to complete payout setup; otherwise generic "request expired" copy.
   - Emit log event `pending_booking_expired_owner_not_ready` (with `ownerOnboardingStatus`).
4. For each service booking: same flow, using `serviceBookings` table and the matching status fields.

**Idempotency:** Each row is updated in a single transaction guarded by `WHERE status = 'pending'` — concurrent ticks cannot double-expire.

**Failure behavior:** Per-row try/catch; one bad row does not stop the batch. Failures emit `pending_booking_expiry_failed` log events and surface in operations alerts (existing pattern from `monitor-deposit-expiry`).

### 11. Structured logging

**Location:** A thin wrapper in `src/features/payments/lib/log-events.ts` over the existing logger.

```ts
type GatingEvent =
  | "listing_created_without_stripe_connect"
  | "connect_onboarding_started_from_accept"
  | "connect_onboarding_completed_from_accept"
  | "accept_blocked_payment_setup_required"
  | "pending_booking_expired_owner_not_ready";

export function logGatingEvent(
  event: GatingEvent,
  props: {
    userId: string;
    bookingType?: "rental" | "service";
    bookingId?: string;
    listingId?: string;
    onboardingStatus?: OnboardingStatus | "unknown";
    [key: string]: unknown;
  },
): void;
```

Emit sites:

- `listing_created_without_stripe_connect` → `ListingService.createListing` (and service equivalent), after successful creation when `onboardingStatus !== 'verified'`.
- `connect_onboarding_started_from_accept` → earnings-and-payouts page mount when `returnTo` is set.
- `connect_onboarding_completed_from_accept` → onboarding completion callback when `returnTo` was set, after `update-onboarding-status` returns.
- `accept_blocked_payment_setup_required` → inside `assertConnectReady` when it throws.
- `pending_booking_expired_owner_not_ready` → cron, after each expiry.

Log shape is the same as existing logger entries (JSON, server-side). Searchable via existing log infra.

## Data Models

### New columns

**`rentalRequests.expiresAt`** — `timestamptz NOT NULL`

**`serviceBookings.expiresAt`** — `timestamptz NOT NULL`

### Default value at row creation

Both insert sites add `expiresAt = createdAt + interval '72 hours'`. The window is centralized in a constant `PENDING_BOOKING_EXPIRY_WINDOW_HOURS = 72` in `src/constants/payments.ts`. Changing the window in future is a one-line change.

### Migration

```sql
ALTER TABLE rental_requests
  ADD COLUMN expires_at timestamptz;

UPDATE rental_requests
  SET expires_at = created_at + interval '72 hours'
  WHERE expires_at IS NULL;

ALTER TABLE rental_requests
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX rental_requests_status_expires_at_idx
  ON rental_requests (status, expires_at)
  WHERE status = 'pending';

-- Same three statements for service_bookings.
```

Partial index on `status = 'pending'` keeps the cron query indexed without inflating index size for terminal-state rows.

### `cancellationReason`

If the existing schema does not already have a `cancellationReason` field, add `cancellationReason text` (nullable) to both tables. Used to distinguish expiry-driven cancellation from user-initiated cancellation in the renter notification and in analytics queries. If a field already exists, reuse it.

### No user table changes

The user table is not modified. Payout readiness is fully derived from `stripeConnectedAccountId`, `connectChargesEnabled`, `connectPayoutsEnabled`, `connectOnboardingComplete`.

## Error Handling

### API error contract

The accept endpoints (`POST /api/rentals/[id]/approve`, `POST /api/services/bookings/[id]/accept`) translate `PaymentSetupRequiredError` into:

```
HTTP 403
Content-Type: application/json

{
  "error": "PAYMENT_SETUP_REQUIRED",
  "onboardingStatus": "pending" | "restricted" | "not_started" | "unknown",
  "missingCapabilities": ["charges" | "payouts"]
}
```

Only the authenticated booking owner/provider receives this body. Third parties receive the existing 403/404.

### Client error handling

Accept-dialog components branch on `error.code === 'PAYMENT_SETUP_REQUIRED'`:

- Do not show a generic error toast.
- Navigate to `/dashboard/payments/earnings-and-payouts?returnTo=<current-booking-url>`.
- Booking remains pending; the user can retry from the same URL after onboarding.

All other error codes flow through the existing error UX.

### Live Stripe call failure

`stripe.accounts.retrieve` failures are wrapped in one retry on transient error classes (rate-limit, API, connection). After retry, failure is treated as fail-closed: a `PaymentSetupRequiredError({ onboardingStatus: 'unknown', reason: 'stripe_unreachable' })` is thrown. The owner is routed to the earnings-and-payouts page (in `returnTo` mode), which on `unknown` shows generic "Connect issue — please retry shortly" copy and a manual retry button. The booking remains pending.

### Webhook delay (owner just finished onboarding)

If the user returns to the booking before `account.updated` has flipped cached flags:

- Cached flag check fails fast.
- `assertConnectReady` does not call Stripe (it short-circuits on cached flags being false).
- This is the wrong answer — the user has actually onboarded.

**Mitigation:** The earnings-and-payouts page's onboarding completion callback writes the updated capabilities directly to the user row before navigating back, via the existing `/api/stripe/update-onboarding-status` endpoint. The user returns to the booking with cached flags already correct. The `account.updated` webhook arrives later and is idempotent.

### Capability regression (cached says ready, live says not)

Caught by the live re-check. Cached flags are updated to match live; the booking remains pending; the user is routed to the earnings-and-payouts page (in `returnTo` mode) with `restricted` copy.

### Cron job failure

Per-row try/catch keeps the batch alive on bad rows. Failed rows emit `pending_booking_expiry_failed` log events. The next cron tick picks them up again. Permanent failures (a row that fails 10+ ticks) trip an ops alert via the same channel used by `monitor-deposit-expiry`.

### Deposit auth hold release on expiry

If the renter has a pre-authorized deposit on a pending booking (only possible if the booking was approved before then re-entering pending — edge case), the expiry cron must release the authorization before transitioning state. Use the existing `stripe.paymentIntents.cancel` path documented in `specs/payments/phase1/`.

## Testing Strategy

### Unit tests

- `getPayoutReadiness` — table-driven test covering all four `onboardingStatus` branches and the partial-capability cases.
- `assertConnectReady`:
  - Cached flags fail → throws without calling Stripe (verify Stripe client not called).
  - Cached flags pass, live OK → resolves; no DB write.
  - Cached flags pass, live regression → updates DB, throws.
  - Stripe transient error → retried once, then throws `PaymentSetupRequiredError` with `reason: 'stripe_unreachable'`.
  - Stripe non-transient error → throws immediately (no retry).
- Expiry cron job logic:
  - Picks up only `pending` rows with `expiresAt < NOW()`.
  - Idempotent under concurrent ticks (use `pg_advisory_lock` or `SELECT ... FOR UPDATE SKIP LOCKED` in test fixtures).
  - Continues batch on single-row failure.

### Integration tests

- `POST /api/rentals/[id]/approve` happy path: owner with `verified` status → 200, booking transitions to `approved`, log event `accept_succeeded` (existing).
- Same endpoint with owner in each non-`verified` state → 403 `PAYMENT_SETUP_REQUIRED` with correct `onboardingStatus` in body; booking stays `pending`.
- `POST /api/services/bookings/[id]/accept` — same matrix.
- Listing creation with non-`verified` user → 200, listing created, `listing_created_without_stripe_connect` log event emitted.
- Cron route `POST /api/cron/expire-pending-bookings`:
  - With valid `CRON_SECRET` and seeded expired rows → rows transition to `cancelled`, notifications sent (mock `sendNotification`).
  - With invalid secret → 401.

### End-to-end tests

One scripted Playwright flow (Stripe test mode):

1. New user signs up, no Stripe Connect.
2. Creates rental listing → published successfully.
3. Second test user submits booking request against the listing.
4. First user clicks Accept → redirected to `/dashboard/payments/earnings-and-payouts?returnTo=...`.
5. Completes Stripe Connect onboarding (using Stripe test mode + test SSN/bank).
6. Auto-redirected back to the booking, clicks Accept → succeeds, PaymentIntent created.

A second E2E variant simulates the regression path by using Stripe CLI to manually reject capabilities post-onboarding.

### Manual UAT

- Soft-prompt banner appears on dashboard for non-`verified` users with published listings; dismisses for the session; reappears next session.
- Earnings-and-payouts page in `returnTo` mode renders correctly on mobile (chrome hidden, onboarding component visible).
- Earnings-and-payouts page with no `returnTo` query param renders unchanged from current behavior.
- `returnTo` open-redirect protection: `?returnTo=https://evil.com`, `?returnTo=//evil.com`, and `?returnTo=/login` all reject and the page falls back to its default (non-JIT) rendering.
- Capability-regression path: manually set `connectPayoutsEnabled = false` in DB on a verified account, click Accept → user is routed to the earnings-and-payouts page with `restricted` copy.

### Non-functional verification

- Latency budget: time `POST /api/rentals/[id]/approve` p95 in staging with `assertConnectReady` enabled; confirm <10ms regression on fast-path (cached-flag fail) and <800ms on slow-path (live Stripe call).
- Failure-mode coverage: with Stripe set to error mode (Stripe CLI), confirm accept returns 403 `stripe_unreachable` and booking remains pending — not silently advanced.

---

Does the design look good? If so, we can move on to the task list. Worth flagging:

- I left `cancellationReason` as "add if not present" — happy to inspect the existing schema and pin that down if you want.
- The `returnTo` open-redirect protection is conservative (relative `/dashboard/...` URLs only). If you need it to accept other paths, tell me which.
- I left the soft-prompt banner placement at "inside dashboard layout, all `/dashboard/*` routes." If you want it scoped tighter (only home / only the requests list), say so.
