# HOA Services Marketplace (Phase 1) — Requirements

## Introduction

The Services Marketplace enables residents within an HOA community to offer and book services directly through the app. Any resident can act as a service provider, a service requester, or both — using the same account. The marketplace is strictly scoped to the resident's HOA: listings are only visible to members of the same community.

Phase 1 focuses on the core transactional loop: service listing creation (with admin approval), booking requests, payment capture at acceptance, job completion, provider payout (after a 24-hour dispute window), mutual reviews, and cancellation/refund handling.

### Scope

**In scope:** Service listing creation and admin approval, service discovery and browsing, booking request flow, provider accept/decline, payment capture at acceptance (Stripe Connect), job completion, payout via cron after 24-hour dispute window, cancellations and refunds, no-show reporting, mutual reviews, provider profile, and notifications.

**Out of scope:** Recurring bookings, instant booking, provider availability calendars, external (non-resident) providers, quote-based services, dispute resolution workflows (disputes are routed to admin manually in Phase 1), listing edits after approval, multi-HOA support.

### Key Architectural Decisions

1. **Payment captured at acceptance** — No payment is taken at booking request time. When the provider accepts, payment is automatically captured from the requester's saved payment method.
2. **24-hour dispute window before payout** — Provider payout is deferred until 24 hours after `completedAt` with no open disputes. A cron job processes eligible payouts, matching the existing rental payout pattern.
3. **Reuse existing Stripe Connect infrastructure** — Service providers use the same Stripe Connected Account onboarding flow as rental tool owners. No new onboarding UI is needed.
4. **20% platform fee at transfer time** — The platform fee is deducted when the payout transfer is created, consistent with the existing `PLATFORM_FEE_PERCENTAGE` constant.
5. **HOA-scoped visibility** — All listings and bookings are isolated to the resident's HOA.
6. **Dual-role support** — A resident may be both a provider and a requester. They cannot book their own listings.

### Fee Structure

- **Service fee** (requester pays): pass-through fee covering Stripe's processing costs — calculated via the existing `calculateServiceFee()` in `src/constants/payments.ts`
- **Platform fee** (20% of service price): deducted from provider payout at transfer time via `PLATFORM_FEE_PERCENTAGE`

---

## Requirements

### Requirement 1: Service Listing Creation

**User Story:** As a resident, I want to create a service listing so that other HOA members can discover and book my services.

#### Acceptance Criteria

1. WHEN a resident submits a service listing THEN the system SHALL create the listing with status `pending_approval` and the listing SHALL NOT be visible to other residents until an admin approves it
2. The listing form SHALL require: title, description, category (selected from admin-seeded list), pricing type (`fixed` or `hourly`), and price/rate
3. The listing form SHALL optionally accept: photos and service notes
4. IF a resident does not have an active Stripe Connected Account THEN the system SHALL prevent listing submission and prompt the resident to complete Stripe Connect onboarding
5. WHEN a listing is submitted THEN the system SHALL notify admin that a new listing is pending approval
6. A provider MAY edit their listing fields at any time — edits to an approved listing do NOT require re-approval in Phase 1
7. A provider MAY deactivate an active listing at any time, which sets listing status to `inactive` and removes it from browse results

---

### Requirement 2: Admin Listing Approval

**User Story:** As an admin, I want to review and approve or reject service listings before they go live so that only appropriate services are visible within the community.

#### Acceptance Criteria

1. WHEN a listing is submitted THEN admin SHALL receive a notification to review the pending listing
2. Admin SHALL be able to approve a listing with an optional internal note
3. Admin SHALL be able to reject a listing with a required reason
4. WHEN admin approves a listing THEN the listing status SHALL change to `active`, the listing SHALL become visible to HOA residents, and the provider SHALL be notified of the approval
5. WHEN admin rejects a listing THEN the listing status SHALL remain `inactive`, the listing SHALL NOT be visible to residents, and the provider SHALL be notified with the rejection reason

---

### Requirement 3: Service Discovery & Browsing

**User Story:** As a resident, I want to browse available services within my HOA so that I can find and book services I need.

#### Acceptance Criteria

1. WHERE a resident is authenticated THEN the system SHALL only display active listings belonging to the resident's HOA
2. Residents SHALL be able to browse listings by service category
3. Each listing card in browse results SHALL display: title, provider name, provider photo, pricing type, price/rate, and aggregate star rating
4. WHEN a resident views a listing detail page THEN the system SHALL display: full description, service notes (if any), provider profile, all reviews for the listing, and a booking CTA
5. A resident SHALL NOT see their own listings as bookable — the booking CTA SHALL be hidden for listings owned by the viewing resident

---

### Requirement 4: Booking Request

**User Story:** As a resident, I want to request a booking for a service by proposing a date and time, so that the provider can review and accept or decline.

#### Acceptance Criteria

1. WHEN a requester submits a booking request THEN the system SHALL create a `ServiceBooking` record with status `pending`
2. The booking request form SHALL require: proposed date and proposed time
3. The booking request form SHALL optionally accept: notes to the provider
4. IF the listing's pricing type is `hourly` THEN the requester SHALL be required to specify an estimated number of hours; the system SHALL display a total price preview (rate × hours + service fee) before submission
5. IF the listing's pricing type is `fixed` THEN the system SHALL display the total price (listing price + service fee) before submission
6. No payment SHALL be captured at booking request time
7. A resident SHALL NOT be able to submit a booking request for their own listing
8. WHEN a booking request is submitted THEN the provider SHALL receive a notification of the new request

---

### Requirement 5: Provider Booking Response (Accept / Decline)

**User Story:** As a service provider, I want to accept or decline booking requests so that I can manage my commitments.

#### Acceptance Criteria

1. WHEN a provider accepts a booking request THEN the system SHALL immediately attempt to capture payment from the requester's saved payment method
2. WHEN payment capture succeeds THEN the booking status SHALL change to `accepted` and the requester SHALL be notified with payment confirmation
3. WHEN payment capture fails THEN the booking status SHALL be set to `payment_failed`, both parties SHALL be notified, and the provider may re-accept after the requester resolves their payment method
4. WHEN a provider declines a booking request THEN the booking status SHALL change to `declined`, no payment SHALL be taken, and the requester SHALL be notified with the provider's decline reason
5. A decline reason is required — the provider SHALL provide a message when declining; the system SHALL reject a decline submission with no reason

---

### Requirement 6: Payment Processing

**User Story:** As the platform, I want to capture payment at booking acceptance using Stripe Connect so that transactions are secure and the platform earns its service fee.

#### Acceptance Criteria

1. WHEN payment is captured at acceptance THEN the system SHALL create a Stripe PaymentIntent for the total charge amount using the requester's saved `customer` and `payment_method`
2. For `fixed` listings: charge amount SHALL equal the listing price plus the service fee (calculated via `calculateServiceFee()`)
3. For `hourly` listings: charge amount SHALL equal (rate × hours specified at booking) plus the service fee (calculated via `calculateServiceFee()`)
4. The system SHALL NOT include `transfer_data` on the PaymentIntent — funds stay in the platform account until the payout transfer is created after the dispute window
5. WHEN creating the PaymentIntent THEN the system SHALL include metadata: `paymentType: 'service_charge'`, `bookingId`, `serviceId`, `providerId`, `requesterId`
6. WHEN the PaymentIntent succeeds THEN the system SHALL store the PaymentIntent ID on the `ServiceBooking` record and create a corresponding record in the payments table with `status: 'succeeded'` and `paymentType: 'service_charge'`
7. The system SHALL generate a deterministic idempotency key of format `service-charge-{bookingId}` for the PaymentIntent creation
8. Platform fee (20%) SHALL be deducted from the provider payout at transfer time via `PLATFORM_FEE_PERCENTAGE` — it is NOT included in the PaymentIntent charge

---

### Requirement 7: Job Completion & Provider Payout

**User Story:** As a service provider, I want to mark a job as complete so that the requester is notified and I receive my payout after the dispute window closes.

#### Acceptance Criteria

1. WHEN a provider marks a booking as complete THEN the booking status SHALL change to `completed` and `completedAt` SHALL be recorded
2. WHEN a booking is marked complete THEN the system SHALL NOT initiate a payout immediately — payout is deferred until after the 24-hour dispute window closes
3. A payout processing cron job SHALL identify bookings WHERE `completedAt` is more than 24 hours ago AND `payoutStatus` is `pending` AND no open dispute exists for the booking, THEN initiate a Stripe Transfer to the provider's Connected Account
4. WHEN creating the payout transfer THEN the system SHALL set: `amount` equal to the charge amount minus the platform fee (in cents), `currency: 'usd'`, `destination` equal to the provider's Stripe Connected Account ID, and `source_transaction` referencing the Charge ID from the service PaymentIntent
5. The platform fee SHALL be calculated as `totalAmount * PLATFORM_FEE_PERCENTAGE` (currently 20%)
6. The system SHALL generate a deterministic idempotency key of format `service-transfer-{bookingId}` for the payout transfer
7. WHEN the payout transfer succeeds THEN `ownerTransferStatus` SHALL be set to `completed`, `ownerTransferredAt` SHALL be recorded, and the provider SHALL be notified that their payout has been sent
8. WHEN the payout transfer fails THEN `ownerTransferStatus` SHALL be set to `failed`, the ops team SHALL be alerted, and the system SHALL NOT automatically retry — manual intervention is required
9. IF `payoutStatus` is NOT `pending` THEN the cron SHALL skip the booking (prevents duplicate transfers)
10. The requester SHALL receive a "job completed" notification immediately when the provider marks the booking complete — this is independent of the payout timing
11. The cron SHALL use an atomic `UPDATE ... WHERE payoutStatus = 'pending'` to set `payoutStatus: 'processing'` before initiating Stripe operations (concurrency lock)

---

### Requirement 8: Cancellations & Refunds

**User Story:** As a requester or provider, I want a clear cancellation policy so that I understand what refund I am entitled to when a booking is cancelled.

#### Acceptance Criteria

1. WHEN a requester cancels a booking AND the proposed date is more than 24 hours away THEN the system SHALL issue a full refund via Stripe refund on the original PaymentIntent and set booking status to `cancelled`
2. WHEN a requester cancels a booking AND the proposed date is 24 hours or less away THEN the system SHALL issue a 50% partial refund via Stripe on the original PaymentIntent and set booking status to `cancelled`
3. WHEN a provider cancels an accepted booking (before marking it complete) THEN the system SHALL issue a full refund to the requester and set booking status to `cancelled`
4. WHEN a cancellation refund is issued THEN the system SHALL record the refund amount and Stripe refund ID on the booking record and notify both parties
5. WHEN either party submits a no-show report THEN the system SHALL create a `ServiceNoShowReport` record and alert admin — no automatic refund is issued until admin confirms the no-show
6. A no-show report SHALL include: `reportedBy` (user ID), `bookingId`, `reportedAt` (timestamp), `notes` (optional)
7. WHEN admin confirms the requester was the no-show THEN the system SHALL issue a 50% refund to the requester (service fee is not refunded) and the remaining balance SHALL be paid out to the provider after the platform fee is deducted — matching the rental no-show payout pattern
8. WHEN admin confirms the provider was the no-show THEN the system SHALL issue a full refund to the requester and no payout SHALL be made to the provider
9. Admin SHALL receive an alert for every no-show report submitted
10. Cancellations and refunds SHALL use the same Stripe refund patterns as the existing rental cancellation flow

---

### Requirement 9: Mutual Reviews

**User Story:** As a resident, I want to leave a review for my service experience so that the community can make informed booking decisions.

#### Acceptance Criteria

1. WHEN a booking reaches `accepted` status or beyond THEN both the provider and requester SHALL be eligible to leave a review for that booking
2. A review SHALL consist of a star rating (1–5, required) and an optional text comment
3. Each party SHALL be able to leave at most one review per booking — the system SHALL reject a second review submission from the same party on the same booking
4. There is no hard review window — reviews may be submitted at any time after the booking is accepted
5. WHEN a review is submitted THEN the system SHALL recalculate and store the provider's aggregate rating (average of all `ServiceReview` records where the resident is the reviewed provider)
6. Reviews SHALL be displayed on the listing detail page
7. A resident's aggregate rating SHALL be displayed on their provider profile

---

### Requirement 10: Provider Profile

**User Story:** As a requester, I want to view a service provider's profile so that I can assess their trustworthiness before booking.

#### Acceptance Criteria

1. WHEN a requester views a provider profile THEN the system SHALL display: name, photo (from existing user profile), provider bio/description, aggregate star rating, and the provider's active service listings
2. A provider MAY edit their bio/description at any time
3. Aggregate rating SHALL be calculated from all `ServiceReview` records where the resident is the reviewed provider
4. IF a provider has no reviews yet THEN the profile SHALL display "No reviews yet" rather than a rating

---

### Requirement 11: Notifications

**User Story:** As a resident, I want to receive timely in-app notifications for booking activity so that I can respond promptly.

#### Acceptance Criteria

1. WHEN a booking request is submitted THEN the provider SHALL receive a notification: new booking request received
2. WHEN a provider accepts a booking THEN the requester SHALL receive a notification: booking accepted with payment confirmation
3. WHEN a provider declines a booking THEN the requester SHALL receive a notification: booking declined with the provider's reason
4. WHEN a provider marks a booking as complete THEN the requester SHALL receive a notification: job marked as complete
5. WHEN a payout transfer succeeds THEN the provider SHALL receive a notification: payout received
6. WHEN a new listing is submitted for approval THEN admin SHALL receive a notification: new listing pending review
7. WHEN a no-show report is filed THEN admin SHALL receive a notification: no-show report filed for review
8. All notifications SHALL use the existing notification infrastructure

---

## Non-Functional Requirements

### Performance

1. The service browse page SHALL load within 2 seconds for up to 100 active listings within an HOA
2. Payment capture at acceptance SHALL complete within 10 seconds
3. The payout processing cron SHALL complete processing of up to 20 eligible bookings within 60 seconds

### Reliability

1. All Stripe PaymentIntent and Transfer operations SHALL include deterministic idempotency keys
2. The payout cron SHALL use atomic status transitions to prevent concurrent processing of the same booking
3. WHERE a Stripe API call fails THEN the system SHALL set the corresponding status to `failed` and log the error — no record SHALL be left in `processing` state indefinitely

### Security

1. All financial operations SHALL be recorded in the audit log
2. Stripe secret keys SHALL NOT be logged or exposed in error messages
3. Service listings and bookings SHALL be accessible only to residents of the same HOA

### Scalability

1. The payout cron SHALL process bookings in batches (limit 20 per run) to stay within serverless function timeouts

---

## Assumptions

1. The existing Stripe Connect onboarding flow (used by rental tool owners) is reused for service providers — no new onboarding UI is needed
2. Service categories are admin-seeded at launch — providers select from an existing list and cannot create new categories
3. Residents who have not completed Stripe Connect onboarding may browse and book services but cannot create listings
4. A resident can be both a provider and a requester using the same account — they cannot book their own listing
5. Provider payout is deferred 24 hours after `completedAt` to allow a dispute window, then processed by cron — matching the existing rental payout model
6. The existing `calculateServiceFee()` utility in `src/constants/payments.ts` is reused for Stripe fee pass-through
7. Photo uploads for listings use the existing image upload infrastructure
8. The existing payout processing cron (from the rental system) may be extended to handle service bookings, or a new cron endpoint is added — determined at design time

---

## Constraints

1. A provider must have an active Stripe Connected Account for their listing to go live and to receive payouts
2. Services are visible only within the resident's HOA — no cross-HOA marketplace in Phase 1
3. No provider calendar or real-time availability management — scheduling is negotiated via proposed date/time and accept/decline
4. No-show handling requires admin review — no automated no-show resolution in Phase 1
5. Hourly services use the estimated hours specified at booking time — there is no post-completion hour adjustment in Phase 1

---

## Edge Cases

1. **Payment capture fails at acceptance**: Booking status set to `payment_failed`. Both parties notified. Provider may re-accept after requester updates their payment method.
2. **Requester has no saved payment method**: System prevents booking request submission and prompts the requester to add a payment method.
3. **Provider's Stripe Connected Account is deactivated before payout**: Payout transfer fails. `ownerTransferStatus` set to `failed`. Ops team alerted. Manual resolution required.
4. **Requester attempts to book their own listing**: System rejects the booking request — a resident cannot book their own service.
5. **Provider marks job complete but payout transfer fails**: Booking remains `completed`. `ownerTransferStatus` set to `failed`. Ops alerted. Requester has already been notified of completion.
6. **Both parties file a no-show report**: Admin sees both reports and determines who was the no-show. If requester: 50% refund (no service fee), remaining balance paid to provider after platform fee. If provider: full refund to requester, no provider payout.
7. **Requester cancels after payment captured — refund tier determination**: Refund percentage is calculated based on time between cancellation and the booking's proposed date.
8. **Provider never marks job complete**: Payout cron will not find the booking eligible (no `completedAt`). Resolution path (e.g., requester-initiated completion or auto-completion after deadline) is deferred to a future phase.
9. **Cron processes the same booking twice concurrently**: Atomic `UPDATE ... WHERE payoutStatus = 'pending'` prevents double-processing; second execution skips the booking.

---

## Out of Scope (Future Phases)

1. **Recurring bookings** — Scheduled repeat service bookings
2. **Instant booking** — Accept-on-request with immediate confirmation, no provider review step
3. **Provider availability calendars** — Structured availability and time-slot management
4. **External providers** — Non-resident service providers
5. **Quote-based services** — Services where price is negotiated per job
6. **Dispute resolution workflow** — Structured dispute claims, evidence collection, and mediation (Phase 1 routes all disputes to admin manually)
7. **Multi-HOA support** — Providers offering services across multiple HOAs
8. **Auto-completion** — Automatically marking a booking complete after the proposed date passes

---

## Success Criteria

1. Residents can create service listings that go live after admin approval
2. Requesters can browse active listings within their HOA, filter by category, and submit a booking request with a proposed date/time
3. Providers can accept or decline booking requests; declined bookings require a reason
4. Payment is automatically captured from the requester's saved payment method when the provider accepts
5. Providers receive payouts 24 hours after marking a job complete (no open disputes), with the 20% platform fee deducted
6. Cancellations trigger the correct Stripe refund tier based on timing relative to the proposed date
7. No-show reports are routed to admin for review before any refund is issued
8. Both parties can leave a mutual review after a booking is confirmed; aggregate ratings appear on provider profiles
9. Admin can approve/reject listings and receive alerts for pending approvals and no-show reports
10. All listings and bookings are strictly isolated to the resident's HOA

---

_Last updated: March 18, 2026 | Internal use only_
