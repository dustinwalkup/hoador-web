# UX Improvements Phase 1 — Requirements Document

## Introduction

This spec covers foundational UX improvements to Hoador focused on reducing confusion, building trust, and coaching users toward successful rentals and service bookings. The improvements target areas where users drop off, feel uncertain, or don't understand what's happening — particularly around rental/booking status, payments, and empty states.

Phase 1 targets improvements that require no new database schema: empty state coaching, status explainers, payment transparency, action nudges (extending the existing overdue widget and push notification infrastructure), a public "How Hoador Works" page and modal, and a microcopy sweep across key pages and surfaces.

Phase 2 (described at the end of this document) covers guided first-time flows and contextual onboarding nudges, which require net-new user schema work (onboarding flags / user metadata).

---

## Requirements

### Requirement 1: Empty State Coaching

**User Story:** As a user encountering an empty section, I want to see a helpful prompt that explains what the section is for and guides me toward action, so that I understand what to do next and feel motivated to engage.

#### Acceptance Criteria

1. WHEN a user views an empty dashboard widget THEN the system SHALL display a contextual empty state with a short headline, a 1–2 sentence explanation, and a primary CTA button or link
2. WHEN a user has no payments or earnings on the payments page THEN the system SHALL display "No payments yet" with supporting copy "List an item to start earning" and a "List an item" CTA
3. WHEN a user has no listings on the manage listings page THEN the system SHALL display "Start earning from items you already own" with "Most listings take under 2 minutes" and a "List an item" CTA
4. WHEN a user has no rentals in their activity view (borrower) THEN the system SHALL display "Rent your first item" with "Browse tools near you and request one in minutes" and a "Browse tools" CTA
5. WHEN a user has no active service bookings in their activity view THEN the system SHALL display an appropriate empty state with a "Browse services" or equivalent CTA
6. WHEN a user has no messages THEN the system SHALL display "No messages yet" with "Messages appear here when you book or accept a rental" and a "Browse tools" CTA
7. WHEN a user views an explore page or search results with no results THEN the system SHALL display "No results found" with "Try adjusting your search or browse all available items" and a "Browse all" CTA
8. Empty state implementations SHALL follow this priority order: dashboard widgets → payments → manage listings (rentals and services) → activity (rentals and services) → messages → explore results
9. All CTAs in empty states SHALL navigate to existing application routes
10. Empty state copy SHALL be encouraging and action-oriented; a standalone negative label (e.g., "No rentals") without supporting context is not acceptable

---

### Requirement 2: Rental & Service Booking Status Explainer

**User Story:** As a renter or owner, I want to understand what each status means and where I am in the process, so that I don't feel confused or anxious about what's happening with my rental or service booking.

#### Acceptance Criteria

1. The system SHALL display a visual status progress indicator on rental detail pages showing sequential states: Requested → Accepted → Active → Completed (with Cancelled and Disputed shown where applicable)
2. The system SHALL display an equivalent status progress indicator on service booking detail pages
3. The current step in the status progression SHALL be visually highlighted and distinguished from past and future steps
4. Past steps SHALL be visually indicated as completed; future steps SHALL be visually indicated as upcoming
5. WHEN a user taps or clicks the current status step THEN the system SHALL display a brief plain-language explanation of what that status means and what action (if any) is expected from the user
6. Status explanations SHALL be written in plain language (e.g., "The owner accepted your request. Coordinate pickup details and start the rental when you receive the item.")
7. WHEN a rental or booking is in a disputed state THEN the status indicator SHALL surface the dispute state clearly and include a link to the disputes detail page
8. WHEN a rental or booking is in a terminal state (completed or cancelled) THEN the system SHALL show an appropriate end-state indicator with no further action steps
9. The status explainer SHALL be visible without scrolling on the rental or booking detail page on mobile

---

### Requirement 3: Payment & Money Transparency

**User Story:** As a renter or owner, I want to clearly understand when I'll be charged or paid and how the payment process works, so that I feel confident and trust the platform.

#### Acceptance Criteria

1. The system SHALL display an inline payment callout on the booking confirmation page for renters explaining when they will be charged (e.g., "You'll be charged when the owner accepts your request")
2. The system SHALL display an inline payment callout on the booking confirmation page for owners explaining when they will receive payment (e.g., "Payment is released after the rental starts. Funds arrive in 1–2 business days via Stripe")
3. The system SHALL display a "?" help icon near pricing or payment information on booking confirmation and rental/booking detail pages; WHEN tapped or clicked THEN the system SHALL open a "How payments work" modal
4. The "How payments work" modal SHALL contain two clearly labeled sections: "When you're charged" (renter) and "How you get paid" (owner), each with 2–3 plain-language bullet points
5. The payments page SHALL include a "How payments work" explainer section (collapsible or static) summarizing the charge and payout flow for both roles
6. Payment transparency copy SHALL avoid financial jargon; all copy SHALL be written at a plain-language reading level
7. WHEN a user views payment information for the first time THEN the system SHALL show the payment explainer callout by default (not hidden or collapsed)
8. The "How payments work" modal SHALL be accessible from booking confirmation, rental/booking detail pages, and the payments page

---

### Requirement 4: Action Nudges & Overdue Alerts Extension

**User Story:** As a renter or owner, I want to receive timely in-app alerts and push notifications when a rental or service booking needs my attention, so that I don't miss key actions and avoid disputes.

#### Acceptance Criteria

1. The existing overdue alerts widget SHALL be extended to surface warnings for rentals and service bookings that are on or past key action dates: start date (not started), end date (not ended), and service completion date (not marked complete)
2. WHEN a rental's start date is today and the rental has not been started THEN the overdue widget SHALL display an alert: "Rental starts today — don't forget to start it when you receive the item" with a link to the rental detail page
3. WHEN a rental's start date has passed and the rental has not been started THEN the overdue widget SHALL display an alert indicating the rental should have started, with a link to the rental detail page
4. WHEN a rental's end date is today and the rental has not been ended THEN the overdue widget SHALL display an alert: "Rental ends today — don't forget to end the rental" with a link to the rental detail page
5. WHEN a rental's end date has passed and the rental has not been ended THEN the overdue widget SHALL display an alert indicating how many days overdue the return is
6. WHEN a service booking's completion date has passed and the service has not been marked complete THEN the overdue widget SHALL display a completion alert with a link to the booking detail page
7. Each alert in the overdue widget SHALL include a direct link to the relevant rental or service booking detail page
8. The system SHALL send a push notification on the day a rental is scheduled to start, sent to both the renter and the owner, with copy such as "Your rental with [name] starts today"
9. The system SHALL send a push notification when a rental is past its start date and has not been started
10. Push notifications for action nudges SHALL only be sent to users who have granted push notification permission (existing permission model applies)
11. Alert and notification copy SHALL be specific and actionable; generic copy without context is not acceptable

---

### Requirement 5: "How Hoador Works" Public Page & Modal

**User Story:** As a new or existing user, I want to quickly understand how Hoador works — how to find, rent, and earn — so that I feel confident using the platform and can refer back to it anytime.

#### Acceptance Criteria

1. The system SHALL provide a public "How Hoador Works" page accessible without authentication
2. The page SHALL contain a 3-step visual explainer for renters: (1) Find an item near you, (2) Request a booking, (3) Meet & use
3. The page SHALL contain a 3-step visual explainer for owners: (1) List an item, (2) Accept a request, (3) Get paid
4. The page SHALL be self-contained and SHALL NOT block or interrupt any user flow
5. The avatar/profile sidebar context menu SHALL include a "How Hoador Works" link
6. WHEN the "How Hoador Works" link is opened from within the authenticated app or dashboard THEN the system SHALL open the page in a new browser tab
7. WHEN the app is running as a PWA THEN the system SHALL open the page in a new browser window rather than navigating within the PWA shell
8. The system SHALL also provide a "How Hoador Works" modal, dismissable by the user, that can be triggered inline from empty states or relevant onboarding touchpoints
9. The modal SHALL present the same core content as the page in a condensed format with a clear close/dismiss action
10. The "How Hoador Works" page SHALL be linked from relevant empty states and from the avatar sidebar context menu
11. The page SHALL be fully responsive and accessible on mobile and desktop
12. The page SHALL NOT require a database query or authenticated session to render

---

### Requirement 6: Microcopy Sweep

**User Story:** As a user, I want the labels, buttons, and navigation items I see to be clear, specific, and written in plain language, so that I always understand what I'm looking at and what action I'm taking.

#### Acceptance Criteria

1. The system SHALL update navigation and UI labels to be action-oriented and descriptive across the following surfaces in priority order: Dashboard, Navigation, Explore, Rental listing detail, Service listing detail, Activity (rentals and services), Manage listings, Payments
2. Navigation labels SHALL be updated to reflect plain, user-centered language (e.g., "Explore" → "Find tools near you", "Create listing" → "List an item to rent", "Bookings" → "Your rentals & requests")
3. CTA button labels SHALL use specific, plain language (e.g., "Submit" → "Request booking", "Confirm" → "Confirm rental", "Mark complete" → "Mark as returned" or equivalent)
4. WHEN a label or button text is ambiguous or purely technical THEN the system SHALL replace it with specific plain-language copy that describes the action or content
5. All updated microcopy SHALL maintain a consistent tone: friendly, direct, and jargon-free
6. Microcopy changes SHALL NOT alter any routing, functionality, or data behavior — only visible text labels and descriptions
7. The system SHALL NOT use passive, generic, or purely negative framing as a standalone label (e.g., "No bookings" without supporting context is not acceptable)
8. WHERE visible copy is updated THEN corresponding accessibility attributes (aria-labels, title attributes, screen reader text) SHALL be updated to match

---

## Non-Functional Requirements

### Performance

1. Empty state components SHALL be display-only and SHALL NOT introduce additional data fetches beyond what the parent page already performs
2. The "How Hoador Works" page SHALL be a static or near-static page requiring no database queries

### Usability

1. All new UI elements SHALL follow existing Hoador design system conventions (colors, typography, spacing, component patterns)
2. All modals introduced in this spec SHALL be dismissable via Escape key, click-outside, and an explicit close button
3. All new and updated copy SHALL target a plain-language reading level (6th–8th grade)

### Accessibility

1. Status progress indicators SHALL be accessible to screen readers with appropriate ARIA roles and labels
2. All new interactive elements SHALL be keyboard navigable and focusable
3. Modals SHALL manage focus correctly (trap focus while open, restore focus on close)

---

## Assumptions

1. The overdue alerts widget exists and is wired to real rental data (per the dashboard spec)
2. Push notification infrastructure exists and is functional (per the pwa-push-notifications spec)
3. The avatar/profile sidebar context menu exists and is extensible with new links
4. The payments page exists (per the payments-page spec)
5. Service bookings follow a similar state machine to rentals and share compatible data access patterns
6. All microcopy changes are contained to UI text; no routing or API contract changes are required

---

## Constraints

1. Phase 1 requires no new database schema changes; all features build on existing data models and infrastructure
2. Microcopy changes are limited to visible text and accessibility attributes; no functional or routing changes
3. The "How Hoador Works" page is static content; no CMS or dynamic content pipeline is required for Phase 1
4. The overdue widget extension builds on the existing widget component and data access layer; no new DAL methods should be required beyond what the dashboard spec already specifies

---

## Edge Cases

1. WHEN a user has push notifications disabled THEN action nudge push notifications SHALL not be sent; the in-app overdue widget alerts SHALL still display regardless of notification permission
2. WHEN a rental or booking is in a disputed state THEN the status explainer SHALL display the dispute state and link to the disputes detail page rather than the standard active/complete progression
3. WHEN the "How Hoador Works" page is accessed while the user is logged in THEN the system SHALL still render the public page without requiring re-authentication or redirecting
4. WHEN a rental has both an overdue return AND a missing start action THEN the overdue widget SHALL show the most time-sensitive alert prominently
5. WHEN an empty state CTA navigates to a route that requires authentication and the user is not logged in THEN the system SHALL redirect to sign-in with a return URL

---

## Out of Scope (Phase 1)

1. Guided first-time flows requiring user schema or onboarding flags — deferred to Phase 2
2. Just-in-time contextual education tied to detecting first-time actions — deferred to Phase 2
3. Checklist UI for rental progress (e.g., "Your next rental: ✅ Booking confirmed ⬜ Coordinate pickup") — deferred to Phase 2
4. Automatic "How Hoador Works" modal on first login for new users — deferred to Phase 2
5. Conversational guidance / in-app help chat — deferred to future consideration
6. Smart tips engine using behavior tracking — the existing rule-based tips widget (dashboard spec) covers this adequately for Phase 1

---

## Phase 2 Preview

Phase 2 of UX Improvements will focus on **Guided First-Time Flows and Contextual Onboarding**. This phase requires introducing a `user_metadata` or `onboarding_flags` record to track whether a user has completed key milestones for the first time — such as making their first booking, starting their first rental, or publishing their first listing. With this foundation in place, Phase 2 will deliver: inline callouts on a user's first booking that highlight the message button, pickup details, and "Start rental" button with short contextual tooltips ("Confirm details with the owner here", "You'll start the rental when you meet"); just-in-time education surfaced at the right moment in the flow (e.g., a tip on booking confirmation that no shipping is required, a reminder on rental day to take a photo before returning); and a checklist-style progress UI on rental detail pages showing the user where they are in the lifecycle. Phase 2 will also revisit the "How Hoador Works" modal to trigger it automatically for new users on their first dashboard visit.
