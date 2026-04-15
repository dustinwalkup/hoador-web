# UX Improvements Phase 1 — Test Plan

## Requirements Traceability

| Requirement | Description                       | Test Coverage                                                                                                |
| ----------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Req 1       | Empty State Coaching              | Unit: `EmptyStateCoach`; Integration: widget/page empty states; E2E: key surfaces                            |
| Req 2       | Status Explainer                  | Unit: `RentalStatusProgress`, `ServiceStatusProgress`; Integration: rental detail page                       |
| Req 3       | Payment Transparency              | Unit: `PaymentTransparencyCallout`, `HowPaymentsWorkModal`; Integration: booking confirmation, payments page |
| Req 4       | Action Nudges & Overdue Extension | Unit: `getActionableAlerts`, `formatAlertText`; Integration: overdue widget, cron route                      |
| Req 5       | How Hoador Works Page & Modal     | Unit: modal render; E2E: public page access, new-tab behavior, nav link                                      |
| Req 6       | Microcopy Sweep                   | Integration: label assertions across 8 surfaces                                                              |

---

## Unit Tests

### `EmptyStateCoach` component (`src/components/empty-state-coach.tsx`)

- [ ] Renders headline, description, and icon
- [ ] Renders CTA button with correct label and `href` when `cta` prop is provided
- [ ] Renders secondary CTA link when `secondaryCta` prop is provided
- [ ] Does not render CTA button when `cta` prop is omitted
- [ ] Applies custom `className` to root element
- [ ] CTA uses correct `variant` when provided (default vs. outline)

### `RentalStatusProgress` component

- [ ] Renders 4-step stepper for `pending` status with step 0 highlighted
- [ ] Renders 4-step stepper for `approved` status with step 1 highlighted
- [ ] Renders 4-step stepper for `active` status with step 2 highlighted
- [ ] Renders completed state for `completed` status with all steps marked
- [ ] Renders terminal badge (no stepper) for `denied` status
- [ ] Renders terminal badge (no stepper) for `cancelled` status
- [ ] Renders amber warning banner for `overdue` status above stepper
- [ ] Renders red dispute banner with `DisputeStatusBadge` and "View Dispute" link when `activeDispute` is present
- [ ] Evidence deadline countdown renders correctly when `evidenceDeadline` is in the future (shows days + hours)
- [ ] Evidence deadline renders "expired" state when deadline is in the past
- [ ] Evidence deadline section is not rendered when `activeDispute` is null
- [ ] Payment failed banner renders for `paymentStatus === "failed"` with failure reason
- [ ] Payment failed banner shows "Update payment method" link for renter (`userRole === "renter"`)
- [ ] Payment failed banner does NOT show update link for owner
- [ ] Deposit hold failed banner renders for `depositHoldStatus === "failed"` — renter copy
- [ ] Deposit hold failed banner renders for `depositHoldStatus === "failed"` — owner copy (no RetryDepositButton)
- [ ] `RetryDepositButton` is rendered inside deposit hold failed banner for renter
- [ ] `RetryDepositButton` is NOT rendered for owner in deposit hold failed state
- [ ] Popover for current step shows `createdAt` timestamp
- [ ] Popover shows `approvedAt` when status is `approved` or later
- [ ] Popover shows "Security deposit hold placed" when `depositHoldStatus === "held"`
- [ ] Popover shows `actualStartDate` when status is `active` or `completed`
- [ ] Popover shows `actualEndDate` when status is `completed`
- [ ] Popover shows denial reason when status is `denied` and `denialReason` is set
- [ ] Popover shows `pickupInstructions` when status is `approved` and instructions are set
- [ ] Popover shows `returnInstructions` when status is `active` and instructions are set
- [ ] Popover explanation is role-aware: renter and owner receive different text for `approved` status
- [ ] Popover explanation is delivery-aware: `deliveryRequested = true` shows different copy for `approved` step (renter and owner)
- [ ] Component falls back to plain text badge for unrecognised status values

### `ServiceStatusProgress` component

- [ ] Renders 3-step stepper (Requested → Accepted → Completed) for `pending` status
- [ ] Renders `accepted` step highlighted for `accepted` status
- [ ] Renders completed state for `completed` status
- [ ] Renders terminal state for `cancelled` and `declined` statuses
- [ ] Popover shows role-aware explanation for provider vs. client
- [ ] Popover shows `scheduledDate` and `completedAt` when available

### `formatAlertText` helper

- [ ] `not_started` + owner + pickup + daysLate=0 → correct copy
- [ ] `not_started` + owner + delivery + daysLate=0 → correct copy
- [ ] `not_started` + renter + pickup + daysLate=0 → correct copy
- [ ] `not_started` + renter + delivery + daysLate=0 → correct copy
- [ ] `not_started` + owner + daysLate=3 → "should have started 3 day(s) ago"
- [ ] `not_started` + renter + daysLate=3 → "due to start 3 day(s) ago"
- [ ] `end_today` + owner + pickup → correct copy
- [ ] `end_today` + owner + delivery → correct copy
- [ ] `end_today` + renter + pickup → correct copy
- [ ] `end_today` + renter + delivery → correct copy
- [ ] `overdue_return` + owner + pickup + daysLate=2 → "2 day(s) overdue — end the rental once the item is back"
- [ ] `overdue_return` + owner + delivery + daysLate=2 → delivery-specific copy
- [ ] `overdue_return` + renter + pickup + daysLate=2 → "2 day(s) overdue — return the item"
- [ ] `overdue_return` + renter + delivery + daysLate=2 → delivery-specific copy
- [ ] `service_not_completed` + provider + daysLate=0 → correct copy
- [ ] `service_not_completed` + client + daysLate=1 → correct copy

### `getActionableAlerts` DAL method

- [ ] Returns `not_started` (severity: warning) for approved rental where `startDate = today`
- [ ] Returns `not_started` (severity: error) for approved rental where `startDate < today`
- [ ] Returns `end_today` (severity: warning) for active rental where `endDate = today`
- [ ] Returns `overdue_return` (severity: error) for rental where `endDate < today` and status is `approved` or `active`
- [ ] Returns `service_not_completed` for accepted service booking where `scheduledDate < today`
- [ ] Does NOT return alerts for `completed`, `cancelled`, or `denied` rentals
- [ ] Returns correct `userRole: "owner"` when userId matches listing owner
- [ ] Returns correct `userRole: "renter"` when userId matches renter
- [ ] Includes `deliveryRequested: true` from rental record
- [ ] Returns correct `daysLate` count for overdue alerts
- [ ] Returns alerts sorted: error severity before warning, then by daysLate descending
- [ ] Returns empty array when no actionable items exist

### `PaymentTransparencyCallout` component

- [ ] Renders renter copy ("When you're charged") for `role === "renter"`
- [ ] Renders owner/provider copy ("How you get paid") for `role === "owner"`
- [ ] Renders with `Alert` component (not a bare div)
- [ ] Both rental and service payout timing are mentioned in owner copy

### `HowPaymentsWorkModal` component

- [ ] Modal is closed by default
- [ ] Opens when trigger is clicked
- [ ] Closes on Escape key press
- [ ] Closes on explicit close button click
- [ ] Contains "For Renters & Clients" section
- [ ] Contains "For Owners & Providers" section
- [ ] Both sections have the correct number of bullet points per design doc

### `PaymentExplainerSection` component

- [ ] Renders collapsible section
- [ ] Shows renter-focused content when `activeTab === "renter"`
- [ ] Shows owner-focused content when `activeTab === "owner"`

### `HowHoadorWorksModal` component

- [ ] Renders trigger button by default when no `trigger` prop provided
- [ ] Renders custom trigger when `trigger` prop is provided
- [ ] Opens on trigger click
- [ ] Closes on Escape key
- [ ] Closes on close button click
- [ ] Contains "For Renters & Clients" 3-step section
- [ ] Contains "For Owners & Providers" 3-step section
- [ ] Contains "See full guide →" link with `target="_blank"`

### Rental reminders cron route (`/api/cron/rental-reminders`)

- [ ] Returns 401 when `Authorization` header is missing
- [ ] Returns 401 when `CRON_SECRET` does not match
- [ ] Returns 200 with `{ sent: N }` when authorised
- [ ] Calls `sendNotification` for renter and owner of each rental starting today (status `approved`, startDate = today)
- [ ] Calls `sendNotification` for missed-start rentals (status `approved`, startDate < today)
- [ ] Continues processing remaining rentals if `sendNotification` throws for one
- [ ] Uses `rental_reminder` notification type

---

## Integration Tests

### Empty state coaching

- [ ] `UpcomingScheduleWidget` renders `EmptyStateCoach` with "Browse rentals & services" CTA when no upcoming items
- [ ] `RecentActivityFeed` renders `EmptyStateCoach` with "Browse" CTA when no activity
- [ ] `UnreadMessagesWidget` renders `EmptyStateCoach` (not `null`) when no messages
- [ ] `TopPerformingToolsWidget` returns `null` when no rental data (does not render coaching state)
- [ ] Payments page renders `EmptyStateCoach` in owner earnings section when no payouts
- [ ] Payments page renders `EmptyStateCoach` in renter history section when no charges
- [ ] Manage listings (rentals) renders correct coaching empty state
- [ ] Manage listings (services) renders correct coaching empty state

### Rental detail page — status progress

- [ ] Rental detail page renders `RentalStatusProgress` (not `RentalStatusCard`) after migration
- [ ] `RentalStatusProgress` receives `depositHoldStatus` and `paymentStatus` props correctly from server fetch
- [ ] Deposit hold failed state visible on rental detail page for a rental with `depositHoldStatus = "failed"`
- [ ] Payment failed banner visible on rental detail page for a rental with `paymentStatus = "failed"`
- [ ] Dates from the old timeline (createdAt, approvedAt, actualStartDate) are visible in the popover

### Overdue widget — extended alerts

- [ ] Dashboard renders `not_started` alert in overdue widget for an approved rental starting today
- [ ] Dashboard renders `end_today` alert for an active rental ending today
- [ ] Dashboard renders `service_not_completed` alert for an accepted service booking past its scheduled date
- [ ] Alert copy is role-appropriate (owner sees "mark as started", renter sees "coordinate pickup")
- [ ] Alert copy is delivery-aware (`deliveryRequested = true` shows different copy)
- [ ] Widget still returns null when no actionable alerts

### Booking confirmation — payment transparency

- [ ] `PaymentTransparencyCallout` is rendered on booking confirmation page
- [ ] `HowPaymentsWorkModal` trigger (`?` icon) is visible next to the total

### Payments page — explainer section

- [ ] `PaymentExplainerSection` renders in both owner and renter tab content
- [ ] Section is accessible (can be expanded via keyboard on mobile)

### `/how-it-works` page — public access

- [ ] Page renders without authentication (no redirect to sign-in)
- [ ] Page contains both renter and owner 3-step sections
- [ ] `generateMetadata` exports a non-empty title and description

---

## E2E / Manual Tests

### Empty states

- [ ] Visit dashboard as a brand-new user with no activity — verify `UnreadMessagesWidget` shows coaching state (not blank)
- [ ] Visit manage listings with no listings — verify coaching empty state is visible with working CTA
- [ ] Visit activity page (rentals, borrower view) with no rentals — verify coaching empty state
- [ ] Visit explore with a search that returns no results — verify no-results coaching state

### Status explainer

- [ ] Visit a rental detail page in `pending` state — verify stepper shows step 0 highlighted
- [ ] Tap the current step — verify popover opens with role-appropriate explanation and dates
- [ ] Visit a rental detail page in `approved` state — verify pickup instructions appear in popover
- [ ] Visit a rental with `paymentStatus = "failed"` — verify payment failed banner is visible and "Update payment method" link works
- [ ] Visit a rental with `depositHoldStatus = "failed"` as renter — verify amber banner with `RetryDepositButton`
- [ ] Visit a rental with `depositHoldStatus = "failed"` as owner — verify amber banner without retry button
- [ ] Visit a rental with an active dispute — verify red dispute banner with working "View Dispute" link
- [ ] Visit a rental with an evidence deadline approaching — verify countdown banner shows days/hours

### Payment transparency

- [ ] Complete a booking as a renter — verify `PaymentTransparencyCallout` is visible on confirmation page
- [ ] Click the `?` icon on booking confirmation — verify `HowPaymentsWorkModal` opens with both sections
- [ ] Open payments page — verify explainer section is present in both tabs

### How Hoador Works

- [ ] Click "How Hoador Works" in avatar sidebar dropdown — verify page opens in a new tab (not in-app navigation)
- [ ] Verify `/how-it-works` is accessible without being logged in
- [ ] In PWA mode: click "How Hoador Works" link — verify new browser window opens (not PWA in-app navigation)
- [ ] Verify "See full guide →" link inside modal opens `/how-it-works` in a new tab

### Microcopy

- [ ] Sidebar navigation shows updated labels: "Browse", "Your rentals & bookings", "Your listings", "Messages"
- [ ] Dashboard Quick Actions shows "List something" and "Browse" (not "List a Tool" / "Browse Tools")
- [ ] Payments page tabs show "Earnings & payouts" and "Payment methods"
- [ ] Dashboard widget headings show updated copy: "Coming up", "Recent activity", "Your top listings", "Near you", "Tips for you"
- [ ] Explore/browse page heading reads "Browse rentals & services"
- [ ] Booking CTA reads "Request booking"

### Cron route

- [ ] Call `/api/cron/rental-reminders` with valid `CRON_SECRET` — returns `{ sent: N }` with N > 0 when rentals start today
- [ ] Call without auth header — returns 401

---

## Test Data Requirements

### Fixtures needed

- `mockApprovedRentalStartingToday` — status `approved`, startDate = today, deliveryRequested: false
- `mockApprovedRentalStartingTodayDelivery` — same but deliveryRequested: true
- `mockApprovedRentalMissedStart` — status `approved`, startDate = 2 days ago
- `mockActiveRentalEndingToday` — status `active`, endDate = today
- `mockOverdueRental` — status `active`, endDate = 3 days ago
- `mockRentalPaymentFailed` — status `pending`, paymentStatus = "failed", paymentFailureReason = "Insufficient funds"
- `mockRentalDepositFailed` — status `approved`, depositHoldStatus = "failed"
- `mockRentalDepositHeld` — status `approved`, depositHoldStatus = "held"
- `mockRentalWithDispute` — active dispute with evidenceDeadline set
- `mockServiceBookingNotCompleted` — status `accepted`, scheduledDate = yesterday
- `mockNewUser` — user with no rentals, listings, messages, or payments

### Mock strategies

- `getActionableAlerts` — mock at the DAL layer for widget integration tests
- `sendNotification` — mock for cron route unit tests; verify call arguments
- Active disputes — use existing `DisputeWithRelations` fixture pattern

---

## Coverage Goals

| Area                                    | Target                                                       |
| --------------------------------------- | ------------------------------------------------------------ |
| `formatAlertText` helper                | 100% (all copy variants covered)                             |
| `getActionableAlerts` DAL method        | 95%+ (all alert types and role/delivery branches)            |
| `RentalStatusProgress`                  | 90%+ (all status values, both roles, deposit/payment states) |
| `EmptyStateCoach`                       | 85%+                                                         |
| Cron route                              | 90%+ (auth check, notification dispatch, error handling)     |
| Other new components (modals, callouts) | 80%+                                                         |

---

## Test Execution

```bash
# Unit + integration
bun test:run --grep "ux-improvements|EmptyStateCoach|RentalStatusProgress|ServiceStatusProgress|formatAlertText|getActionableAlerts|PaymentTransparency|HowPayments|HowHoador|rental-reminders"

# Watch mode during development
bun test:watch

# Coverage report
bun test:coverage
```

---

## Special Considerations

### Deposit and payment failure states

These states are critical trust/safety flows. Test both renter and owner perspectives explicitly. Verify `RetryDepositButton` is only rendered for renters and that its absence for owners is intentional and tested.

### Delivery-aware copy

The `formatAlertText` helper must be tested for every role × delivery combination — not just happy paths. A renter receiving delivery copy when they expect pickup copy (or vice versa) would be actively confusing.

### Accessibility

- All new modals: verify focus trap with a keyboard-only test pass
- Status stepper: verify screen reader can read current step label without requiring the popover to be open
- New nav labels: verify `aria-label` attributes updated alongside visible text

### Cron route security

The `CRON_SECRET` check must be tested for both missing and incorrect header values. Do not rely solely on the happy path test.
