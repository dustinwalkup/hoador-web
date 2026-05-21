# Stripe Connect Gating — Move From Listing Creation to Booking Acceptance — Requirements Document

## Introduction

Today Hoador requires a fully onboarded Stripe Connect Express account before a user can create a rental or service listing. This gate sits at the wrong place in the funnel: it forces the highest-friction step (KYC, SSN, bank account) before the user has felt any product value, and it suppresses listing supply.

This spec moves the hard Stripe Connect requirement from **listing creation** to **booking acceptance** — the first moment money actually needs to move. Users can create and publish listings without a connected payout account; the requirement is enforced just-in-time when an owner attempts to accept a rental request or a provider attempts to accept a service booking.

This change affects both **rentals** (owner approves renter via `/api/rentals/[id]/approve`) and **services** (provider accepts requester via `/api/services/bookings/[id]/accept`). It does not change the underlying Stripe Connect onboarding component, the `account.updated` webhook, the user schema, or the platform-hold payment lifecycle defined in `specs/payments/phase1`.

### Scope

**In scope:**

- Removing the Stripe Connect onboarding requirement from rental and service listing creation (frontend and service-layer checks).
- Hard server-side enforcement at the two booking-acceptance endpoints.
- Just-in-time (JIT) onboarding UX at the acceptance touchpoint, with context preservation across the Stripe onboarding redirect.
- A derived `payoutReadiness` view on the user (no schema migration).
- Pending-booking auto-expiry when an owner never completes Stripe.
- Handling of partial Stripe Connect capability states (e.g. `charges_enabled=true`, `payouts_enabled=false`).
- Renter-facing messaging when an accept is pending owner onboarding.
- Analytics events for the new funnel.

**Out of scope:**

- The admin listing-approval workflow (already exists, see `specs/listing-review/`).
- The in-app Payments UI page (separate, see `specs/payments-page/`).
- The payment lifecycle (capture, deposit hold, transfer) — see `specs/payments/phase1/`.
- Stripe Connect account creation and the `account.updated` webhook (already implemented).
- Multi-currency or non-US payout support (US-only Express remains a platform constraint).
- Changes to the renter-side customer flow — only the owner/provider payout side is affected.

### Key Architectural Decisions

1. **Booking acceptance is the single hard gate.** All other Stripe Connect checks are advisory/soft prompts. There is no other path through which the platform creates a PaymentIntent or initiates a transfer.
2. **Listings remain fully discoverable and bookable without Stripe Connect.** Renters and requesters can submit booking requests against any approved listing regardless of the owner's payout status.
3. **Payout readiness is a derived view, not a new column.** A helper computes `{ stripeConnected, chargesEnabled, payoutsEnabled, onboardingStatus }` from the existing `stripeConnectedAccountId`, `connectChargesEnabled`, `connectPayoutsEnabled`, and `connectOnboardingComplete` columns on the `users` table.
4. **Acceptance re-checks Stripe live before charging.** Cached DB flags are used to render UI and short-circuit the API, but the canonical check just before any PaymentIntent or transfer call uses a live `stripe.accounts.retrieve()` to catch capability regressions.
5. **Pending bookings expire if the owner never completes onboarding.** The renter is notified and refunded any pre-authorized amount, and the listing is _not_ automatically taken down.

## Requirements

### Requirement 1: Decouple Listing Creation From Stripe Connect

**User Story:** As a tool owner or service provider, I want to create and publish a listing without first connecting a Stripe payout account, so that I can describe what I'm offering before being asked for sensitive financial information.

#### Acceptance Criteria

1. The system SHALL remove the Stripe Connect onboarding check from the rental listing creation page at `src/app/dashboard/listings/add/page.tsx`.
2. The system SHALL remove the Stripe Connect onboarding check from the service listing creation page at `src/app/dashboard/services/listings/create/page.tsx`.
3. The system SHALL remove the `userDAL.isConnectOnboardingComplete()` enforcement from `ListingService` at `src/features/listings/services/listing-service.ts` so that listing creation no longer throws when Stripe Connect is incomplete.
4. The system SHALL remove the equivalent check from the service listing creation service path.
5. WHERE a user without a connected Stripe account submits a listing for admin approval THEN the system SHALL accept the submission and route it through the existing admin review flow unchanged.
6. WHEN an admin approves a listing whose owner has not completed Stripe Connect THEN the system SHALL publish the listing as live and make it discoverable to renters/requesters.
7. The system SHALL NOT display a Stripe-related error or gating screen at any step of the listing creation flow.

### Requirement 2: Derived Payout Readiness View

**User Story:** As a developer, I want a single canonical helper for "is this user ready to accept bookings", so that downstream code (gating, UI, analytics) makes consistent decisions without each caller assembling its own predicate.

#### Acceptance Criteria

1. The system SHALL expose a server-side helper (e.g. `getPayoutReadiness(user)`) that returns an object of shape `{ stripeConnected: boolean, chargesEnabled: boolean, payoutsEnabled: boolean, onboardingStatus: 'not_started' | 'pending' | 'restricted' | 'verified' }`.
2. The helper SHALL derive its values from the existing `users` table columns (`stripeConnectedAccountId`, `connectChargesEnabled`, `connectPayoutsEnabled`, `connectOnboardingComplete`) — no schema migration is introduced.
3. WHERE `stripeConnectedAccountId` is null THEN `onboardingStatus` SHALL be `'not_started'` and `stripeConnected` SHALL be `false`.
4. WHERE `stripeConnectedAccountId` is set AND `connectOnboardingComplete` is false THEN `onboardingStatus` SHALL be `'pending'`.
5. WHERE `connectChargesEnabled` and `connectPayoutsEnabled` are both true THEN `onboardingStatus` SHALL be `'verified'`.
6. WHERE Stripe Connect is partially capable (e.g. `chargesEnabled=true` AND `payoutsEnabled=false`) THEN `onboardingStatus` SHALL be `'restricted'`.
7. The helper SHALL be the single source of truth used by all gating UI, the JIT onboarding modal, and any analytics events.
8. The system SHALL NOT add new persisted columns to the user table for this feature.

### Requirement 3: Booking Acceptance Hard Gate — Backend

**User Story:** As the platform, I want booking acceptance to be the single enforced gate for Stripe Connect readiness, so that no listing can take real money from a renter until the owner can actually receive it.

#### Acceptance Criteria

1. WHEN an owner submits a rental approval to `POST /api/rentals/[id]/approve` THEN the system SHALL verify the owner's Stripe Connect readiness before any side effects.
2. WHEN a provider submits a service booking accept to `POST /api/services/bookings/[id]/accept` THEN the system SHALL verify the provider's Stripe Connect readiness before any side effects.
3. The system SHALL perform the readiness check in two layers:
   - **Fast path** — the cached `connectChargesEnabled` AND `connectPayoutsEnabled` columns must both be true.
   - **Authoritative path** — immediately before creating any PaymentIntent or transfer, the system SHALL call `stripe.accounts.retrieve(stripeConnectedAccountId)` and verify `charges_enabled === true` AND `payouts_enabled === true`.
4. IF the fast-path check fails THEN the system SHALL return HTTP 403 with body `{ error: 'PAYMENT_SETUP_REQUIRED', onboardingStatus, missingCapabilities }` and SHALL NOT call Stripe further.
5. IF the authoritative-path check fails (cached flags say ready, live Stripe says not ready) THEN the system SHALL return HTTP 403 with the same error shape, SHALL update the cached flags from the live response, AND SHALL NOT create the PaymentIntent.
6. WHERE the readiness check fails THEN the system SHALL NOT change the booking's status — the request remains in its prior state (e.g. `pending`) so the owner can retry after completing onboarding.
7. The system SHALL log a structured event including `userId`, `bookingId`, `bookingType` (`rental` | `service`), and `onboardingStatus` whenever a 403 `PAYMENT_SETUP_REQUIRED` is returned.

### Requirement 4: Booking Acceptance — Just-in-Time Onboarding UX

**User Story:** As an owner with a pending booking, I want to be guided directly into Stripe onboarding from the accept screen and returned to the same booking afterward, so that I do not lose context or have to navigate back manually.

#### Acceptance Criteria

1. WHEN the owner views a pending rental request OR service booking THEN the system SHALL display the accept action regardless of Stripe Connect status.
2. WHEN the owner clicks Accept AND `getPayoutReadiness(user).onboardingStatus !== 'verified'` THEN the system SHALL open a Just-in-Time onboarding modal instead of submitting the accept request.
3. The JIT modal SHALL display:
   - A heading that frames the action positively (e.g. "Connect your payout account to accept this booking"), NOT a Stripe-branded or verification-themed heading.
   - A short explanation of why payout setup is required (one sentence).
   - A primary CTA labeled "Connect payout account" (or similar) that initiates the existing `ConnectOnboarding` flow.
   - A secondary "Not now" / dismiss option that leaves the booking in pending state.
4. WHEN the owner completes Stripe Connect onboarding from the JIT flow THEN the system SHALL return the user to the original accept context (the same rental or service booking) and not to a generic dashboard.
5. WHEN the user returns from Stripe onboarding AND the `account.updated` webhook has updated their flags THEN the system SHALL automatically re-present the accept action without requiring a page refresh, or at minimum display a clear "Onboarding complete — accept booking now" CTA.
6. WHERE the user returns from Stripe onboarding but the `account.updated` webhook has not yet fired THEN the system SHALL still allow them to attempt accept; the server-side authoritative check (Requirement 3.3) is the source of truth.
7. The system SHALL NOT use any of the following copy in user-facing UI: "Enter your SSN", "Stripe verification required", "KYC", "Tax ID required".
8. The system SHALL use positively framed copy such as "Get paid for your rentals" or "Connect your bank to accept bookings" wherever a Stripe Connect prompt is shown outside the JIT modal.

### Requirement 5: Pending Booking Auto-Expiry

**User Story:** As a renter/requester, I want a request that sits unaccepted to expire predictably rather than hang forever, so that I know when to look elsewhere and am not left in limbo.

#### Acceptance Criteria

1. The system SHALL define a configurable expiry window for pending booking requests (default: 72 hours from request creation).
2. WHEN a pending rental request OR service booking has been in `pending` state past the expiry window AND the owner has NOT accepted THEN the system SHALL transition it to `expired`.
3. WHEN a request expires THEN the system SHALL notify the renter/requester via the existing notification channel with a message indicating the owner did not respond in time.
4. WHEN a request expires THEN the system SHALL notify the owner that the request expired and (where applicable) include a soft prompt to complete Stripe Connect setup so future requests can be accepted.
5. WHEN a request expires THEN the system SHALL NOT take down the listing or mark the owner as inactive.
6. WHERE the owner has Stripe Connect set up but simply did not respond THEN the expiry behavior SHALL be identical — the auto-expiry SHALL NOT discriminate by Connect status.
7. WHERE the renter/requester has any pre-authorized amount (e.g. a deposit auth hold tied to a future-dated start) THEN the system SHALL release that authorization before sending the expiry notification.

### Requirement 6: Multi-Listing, Single Connect Account

**User Story:** As an owner with multiple listings, I want to onboard once and have all my listings unlock at the same time, so that I don't repeat the payout setup per listing.

#### Acceptance Criteria

1. The system SHALL treat the Stripe Connect account as a property of the user, not of the listing.
2. WHEN the `account.updated` webhook reports `charges_enabled` and `payouts_enabled` are both true THEN the system SHALL mark the user as `verified` and all their existing listings SHALL become bookable end-to-end without additional setup.
3. The system SHALL NOT create per-listing Stripe Connect accounts or per-listing onboarding flows.

### Requirement 7: Partial Capability Handling

**User Story:** As the platform, I want to correctly handle Stripe Connect accounts that are partially capable (e.g. can charge but cannot receive payouts), so that funds are never trapped or transferred to an account that cannot receive them.

#### Acceptance Criteria

1. WHERE `payouts_enabled` is false (regardless of `charges_enabled`) THEN the system SHALL block booking acceptance with `onboardingStatus = 'restricted'`.
2. WHERE `charges_enabled` is false THEN the system SHALL block booking acceptance with `onboardingStatus = 'restricted'`.
3. The system SHALL re-fetch live Stripe account state at acceptance time (per Requirement 3.3) so that capability regressions (a previously verified account being moved back to `restricted` by Stripe) are detected before any transfer is attempted.
4. WHEN the live re-check reveals a regression THEN the system SHALL update the cached `connectChargesEnabled`, `connectPayoutsEnabled`, and `connectOnboardingComplete` columns to match the live state.
5. WHERE `onboardingStatus` is `'restricted'` THEN the JIT onboarding modal SHALL frame the message as "Finish setting up your payout account" (not "Start setup"), and the CTA SHALL deep-link into the user's existing Connect account rather than starting a new one.

### Requirement 8: Soft Prompts Outside the Hard Gate

**User Story:** As a user without a connected payout account, I want gentle, well-timed prompts to set up payouts so I'm ready when a booking comes in, without being blocked from doing anything else.

#### Acceptance Criteria

1. WHERE the user has at least one published listing AND `onboardingStatus !== 'verified'` THEN the system SHALL display a non-blocking banner or card prompt (e.g. in the dashboard) recommending payout setup.
2. WHEN the user receives their first booking request AND `onboardingStatus !== 'verified'` THEN the system SHALL surface a higher-emphasis prompt on the booking screen.
3. The system SHALL NOT block any non-payment action (listing edits, messaging, profile updates, viewing requests) based on Stripe Connect status.
4. WHERE the user is in `pending` or `restricted` status THEN the soft prompt copy SHALL reflect the actual state (e.g. "Finish setting up your payout account" vs. "Connect a payout account").

### Requirement 9: Renter-Facing UX During Owner Onboarding

**User Story:** As a renter/requester whose request is pending, I want to understand what's happening without being exposed to the owner's payment internals, so that the experience feels normal and respectful.

#### Acceptance Criteria

1. The system SHALL NOT expose the owner's Stripe Connect status to the renter/requester.
2. WHILE a booking request is in `pending` state THEN the renter/requester SHALL see a neutral "Waiting on owner" status — identical regardless of whether the owner has Stripe Connect set up.
3. WHEN the booking expires per Requirement 5 THEN the renter-facing message SHALL say the owner did not respond in time and SHALL NOT mention payment setup.
4. The system SHALL allow the renter/requester to cancel a pending request at any time before acceptance with no Stripe-related consequences.

### Requirement 10: Analytics & Observability

**User Story:** As a product owner, I want to measure whether moving the gate to acceptance improves listing creation conversion without hurting overall fulfilled bookings, so that I can validate the decision and detect regressions.

#### Acceptance Criteria

1. The system SHALL emit a `listing_created_without_stripe_connect` event when a user publishes a listing while `onboardingStatus !== 'verified'`.
2. The system SHALL emit a `connect_onboarding_started_from_accept` event when a user starts Stripe Connect onboarding via the JIT modal.
3. The system SHALL emit a `connect_onboarding_completed_from_accept` event when a user completes onboarding within the JIT flow and is returned to the acceptance context.
4. The system SHALL emit an `accept_blocked_payment_setup_required` event whenever the API returns 403 `PAYMENT_SETUP_REQUIRED`.
5. The system SHALL emit a `pending_booking_expired_owner_not_ready` event when a pending booking auto-expires AND the owner's `onboardingStatus` is not `'verified'` at expiry time.
6. Each event SHALL include `userId`, `bookingType` (`rental` | `service`) where applicable, `onboardingStatus`, and `listingId` / `bookingId` where applicable.

## Non-Functional Requirements

### Performance

1. The fast-path readiness check SHALL add no more than one indexed column lookup to the existing acceptance request and SHALL NOT increase API latency by more than 10ms p95.
2. The authoritative live `stripe.accounts.retrieve` call SHALL be performed at most once per acceptance attempt.
3. The JIT modal SHALL render within 200ms of the user clicking Accept.

### Reliability

1. The authoritative live check SHALL be wrapped in a single retry on transient Stripe API errors (`StripeRateLimitError`, `StripeAPIError`, `StripeConnectionError`).
2. WHERE the live check cannot be completed after retry THEN the system SHALL fail closed (return 403, do not proceed) rather than fail open.
3. WHERE the `account.updated` webhook is delayed THEN the live authoritative check SHALL still allow a freshly-onboarded user to accept their booking without waiting for the webhook.

### Security

1. The system SHALL NOT expose another user's Stripe Connect status, account ID, or capability flags through any API response.
2. The 403 `PAYMENT_SETUP_REQUIRED` response SHALL only be returned to the authenticated owner/provider of the booking — third parties SHALL receive the existing generic 403/404.
3. The JIT modal flow SHALL NOT pass any sensitive Stripe credentials through the client; the existing server-side onboarding link generation SHALL be reused.

### Usability

1. All Stripe-related copy SHALL use positive, value-framed language (per Requirement 4.7 and 4.8).
2. The JIT onboarding flow SHALL preserve return context to the originating booking with zero manual navigation by the user.
3. The dashboard soft prompt SHALL be dismissible per-session but SHALL re-appear on subsequent sessions while readiness is incomplete.

## Assumptions

1. The existing Stripe Connect onboarding component at `src/features/users/components/connect-onboarding.tsx` is suitable for embedding inside the JIT modal flow.
2. The existing `account.updated` webhook handler at `src/services/stripe/webhook-handlers.ts` accurately reflects `charges_enabled` / `payouts_enabled` into the cached user columns.
3. The admin listing-review flow (`specs/listing-review/`) does not currently require the owner to have completed Stripe Connect, OR will be updated independently to remove any such requirement.
4. The payment lifecycle defined in `specs/payments/phase1/` creates the rental PaymentIntent immediately after acceptance — meaning acceptance is the only meaningful enforcement point for Stripe Connect readiness.
5. Service bookings follow the same "accept = trigger immediate charge" model as rentals; provider readiness must be enforced at the accept step.
6. Renter/requester customer-side Stripe state (saved payment methods, Stripe Customer ID) is unaffected by this change.

## Constraints

1. Stripe Connect Express accounts remain US-only (existing platform constraint, not changed here).
2. The existing user schema (`stripeConnectedAccountId`, `connectChargesEnabled`, `connectPayoutsEnabled`, `connectOnboardingComplete`) is not modified — payout readiness is derived from these fields.
3. The existing `account.updated` webhook contract is not modified.
4. The existing PaymentIntent and transfer flows (per `specs/payments/phase1/`) are not modified — only the _precondition checks_ leading into them.
5. The change must work within the Next.js App Router architecture.

## Edge Cases

1. **Owner onboards mid-acceptance** — User clicks Accept → JIT modal → completes onboarding → returns. If the `account.updated` webhook has not yet flipped the cached flags, the authoritative live check (Requirement 3.3) still allows the accept to proceed and updates the flags inline.
2. **Stripe regresses a verified account** — Cached flags say verified, live retrieve returns `payouts_enabled=false`. The accept is blocked, cached flags are updated, the JIT modal is shown with "Finish setting up your payout account" copy.
3. **Multiple pending requests on one listing, owner not onboarded** — All requests remain pending until either the owner onboards and accepts each, or the per-request expiry fires individually.
4. **Owner declines instead of accepting** — Decline does not require Stripe Connect (no money moves on decline). Existing decline flow is unaffected.
5. **Renter cancels a pending request** — Allowed at any time; no Stripe Connect check applies.
6. **Owner onboards, then deletes their Connect account** — `account.closed` webhook (already handled) flips cached flags to false; subsequent accepts are blocked with `onboardingStatus = 'restricted'` and the JIT modal prompts re-onboarding.
7. **User attempts to accept a booking on a listing whose admin approval was revoked** — Existing listing-approval check takes precedence over the Stripe Connect check; user sees the existing listing-status error, not a payout error.
8. **Webhook arrives out-of-order** — Authoritative live check is the source of truth at accept time; webhook ordering does not affect correctness of the gate.
9. **Listing created without Stripe, never receives a booking** — No action required. Listing stays live and discoverable; soft prompts continue per Requirement 8.
10. **Owner has two listings, accepts on one (completing onboarding), then accepts on the other** — Second accept passes the fast-path check (cached flags are now true) and the live re-check; no second onboarding round-trip.

## Out of Scope (Deferred / Separate Specs)

1. **In-app Payments UI** — embedded balance, payouts, payments-list, and documents components (covered by `specs/payments-page/`).
2. **Payment lifecycle** — manual transfers, deposit auth holds, dispute window (covered by `specs/payments/phase1/`).
3. **Admin listing-review workflow** — already in place (`specs/listing-review/`).
4. **Multi-currency support / non-US Connect accounts** — platform constraint.
5. **Payment method validation pre-booking** — the renter's payment method check at booking-request time is unchanged.
6. **Email/SMS notification redesign** — uses existing notification infrastructure; copy refresh only.

## Success Criteria

1. Users can complete the full listing creation flow (rental and service) and reach the "live listing" state without ever being shown a Stripe Connect prompt.
2. No PaymentIntent or transfer is ever created against a Stripe Connect account that does not have `charges_enabled` and `payouts_enabled` both true at the moment of the API call.
3. An owner can complete Stripe Connect onboarding from the JIT modal and return to the originating booking with zero manual navigation.
4. A pending booking with an unresponsive owner auto-expires within the configured window and the renter receives a clear notification.
5. Listing creation conversion (created → published) increases measurably after launch (target metric — exact threshold set during rollout planning).
6. The rate of `accept_blocked_payment_setup_required` events stays low and decreases week-over-week as users complete JIT onboarding.
7. No regression in fulfilled-booking rate (accepted → completed) compared to pre-change baseline.
