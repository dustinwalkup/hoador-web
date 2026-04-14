# UX Improvements Phase 1 — Implementation Tasks

---

## Track 1: Empty State Coaching

- [ ] 1. Create `EmptyStateCoach` shared component
  - Create `src/components/empty-state-coach.tsx` with props: `icon`, `iconColor`, `iconBg`, `headline`, `description`, `cta?`, `secondaryCta?`, `className?`
  - Render: icon in soft colored circle, headline (`font-medium`), description (`text-sm text-muted-foreground`), optional CTA `Button` and secondary link
  - Component is purely presentational — no data fetching
  - _Requirements: 1.1, 1.9, 1.10_

- [ ] 2. Apply `EmptyStateCoach` to dashboard widgets
  - [ ] 2.1 `UpcomingScheduleWidget` — add "Nothing coming up" + "Browse rentals & services" CTA → `/explore`
    - Currently shows plain text; add CTA below existing message
    - _Requirements: 1.1_
  - [ ] 2.2 `RecentActivityFeed` — add "No recent activity" coaching + "Browse rentals & services" CTA → `/explore`
    - _Requirements: 1.1_
  - [ ] 2.3 `UnreadMessagesWidget` — replace `return null` with `EmptyStateCoach`: "No messages yet" + "Your conversations will appear here when you book or accept a rental or service" + "Browse services" CTA → `/dashboard/services`
    - _Requirements: 1.1, 1.6_
  - [ ] 2.4 `TopPerformingToolsWidget` — change from showing text-only empty state to `return null` (hide until there is rental activity)
    - _Requirements: 1.1_

- [ ] 3. Apply `EmptyStateCoach` to payments page
  - Locate empty state in `src/app/dashboard/payments/page.tsx` or payment components
  - Replace with: "No payments yet" + "List something to start earning" + "List an item" CTA → listing creation route
  - Apply to both owner earnings section (no payouts) and renter history section (no charges)
  - _Requirements: 1.2_

- [ ] 4. Apply `EmptyStateCoach` to manage listings pages
  - [ ] 4.1 Rental listings empty state: "Start earning from things you already own" + "Most listings take under 2 minutes" + "List an item" CTA
    - _Requirements: 1.3_
  - [ ] 4.2 Service listings empty state: "Offer your skills or services" + "List a service and start accepting bookings" + "List a service" CTA
    - _Requirements: 1.3_

- [ ] 5. Apply `EmptyStateCoach` to activity pages
  - [ ] 5.1 Rentals activity — borrower/renter view: "Nothing rented yet" + "Browse items available near you and request a booking" + "Browse" CTA
    - _Requirements: 1.4_
  - [ ] 5.2 Rentals activity — owner/lender view: "No rental requests yet" + "List something to start receiving requests" + "List an item" CTA
    - _Requirements: 1.4_
  - [ ] 5.3 Services activity — client view: "No service bookings yet" + "Browse services available in your area" + "Browse services" CTA
    - _Requirements: 1.5_
  - [ ] 5.4 Services activity — provider view: "No service requests yet" + "List a service to start receiving bookings" + "List a service" CTA
    - _Requirements: 1.5_

- [ ] 6. Apply `EmptyStateCoach` to messages (mailbox)
  - Empty state: "No messages yet" + "Messages appear here when you book or accept a rental or service" + "Browse" CTA → `/explore`
  - _Requirements: 1.6_

- [ ] 7. Apply `EmptyStateCoach` to explore / search results
  - No-results state: "Nothing found" + "Try adjusting your search or browse everything available" + "Browse all" CTA
  - _Requirements: 1.7_

---

## Track 2: Status Explainer

- [ ] 8. Create `formatAlertText` helper
  - Create `src/features/rentals/lib/format-alert-text.ts`
  - Signature: `formatAlertText(alertType, userRole, deliveryRequested, daysLate?) → string`
  - Implement all copy variants from design doc alert copy table (role × delivery × daysLate combinations)
  - Export as a pure function with no side effects — fully unit testable
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 9. Create `RentalStatusProgress` component
  - Create `src/features/rentals/components/detail-page/rental-status-progress.tsx` as a client component
  - Props must cover everything currently rendered by `rental-status-card.tsx` (sourced from `RentalStatusInfo` + detail fields):
    ```
    currentStatus: RentalStatus
    userRole: "renter" | "owner"
    rentalId: string
    deliveryRequested: boolean
    startDate: Date
    endDate: Date
    createdAt: Date
    approvedAt?: Date | null
    deniedAt?: Date | null
    denialReason?: string | null
    actualStartDate?: Date | null      // renamed from actualStartedAt to match DAL
    actualEndDate?: Date | null        // renamed from returnConfirmedAt to match DAL
    paymentStatus?: string | null
    paymentFailureReason?: string | null
    depositHoldStatus?: string | null
    pickupInstructions?: string | null
    returnInstructions?: string | null
    activeDispute?: DisputeWithRelations | null
    ```
  - **Stepper section** — render normal flow (Requested → Accepted → Active → Completed):
    - Past steps: check mark, muted color
    - Current step: primary color, highlighted, tappable
    - Future steps: outlined/muted
  - **Terminal state** (denied/cancelled): single status badge + plain-language explanation, no stepper
  - **Overdue**: normal stepper + amber warning banner: "This rental is past its return date"
  - **Dispute present**: normal stepper + red warning banner with `DisputeStatusBadge` and link to `/dashboard/disputes/[activeDispute.id]`
  - **Evidence deadline countdown** (port from existing card): when `activeDispute` has `evidenceDeadline` or `additionalEvidenceDeadline`, render yellow/red warning with days + hours remaining or "deadline expired" — logic lives in the same `getEvidenceDeadlineInfo` helper pattern
  - **Payment failed state**: when `paymentStatus === "failed"`, render orange banner showing `paymentFailureReason` and, for renters only, a "Update payment method" link → `/dashboard/payments`
  - **Deposit hold failed state**: when `depositHoldStatus === "failed"`, render amber banner with role-aware copy:
    - Renter: "The security deposit hold could not be placed. Update your payment method and retry." + "Update payment method" link + `RetryDepositButton` (existing component, no changes needed)
    - Owner: "The security deposit hold could not be placed. The rental is proceeding without deposit protection."
  - **Tappable current step popover** — opens `Popover` with:
    - Role-aware, delivery-aware plain-language explanation
    - `createdAt` timestamp (always shown as "Requested on …")
    - `approvedAt` timestamp if present
    - `depositHoldStatus === "held"` → "Security deposit hold placed" entry
    - `actualStartDate` timestamp if status is `active` or `completed`
    - `actualEndDate` timestamp if status is `completed`
    - `deniedAt` + `denialReason` if status is `denied`
    - `pickupInstructions` if status is `approved` and instructions are set
    - `returnInstructions` if status is `active` and instructions are set
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [ ] 10. Replace `rental-status-card.tsx` with `RentalStatusProgress`
  - Audit `rental-status-card.tsx` line-by-line against the `RentalStatusProgress` implementation to confirm every rendered state is covered:
    - [ ] Payment failed banner + "Update payment method" link
    - [ ] Deposit hold failed banner + `RetryDepositButton` (renter) / owner-only copy
    - [ ] Deposit hold held timeline entry
    - [ ] Evidence deadline countdown (days/hours, expired state)
    - [ ] Denial reason box
    - [ ] All timeline timestamps (createdAt, approvedAt, actualStartDate, actualEndDate, deniedAt)
  - Integrate `RentalStatusProgress` into the rental detail page in place of `RentalStatusCard`
  - Pass all required props from the existing `RentalStatusInfo` + detail data already fetched server-side
  - Delete `rental-status-card.tsx` only after the audit checklist above is fully verified
  - Verify no duplicate date/instruction display elsewhere on the detail page post-migration
  - _Requirements: 2.1, 2.3, 2.9_

- [ ] 11. Create `ServiceStatusProgress` component
  - Create `src/features/services/components/detail-page/service-status-progress.tsx` (or equivalent services detail path)
  - Same stepper pattern as `RentalStatusProgress` but maps service booking statuses: Requested → Accepted → Completed (terminal: Cancelled, Declined)
  - Props: `currentStatus: ServiceBookingStatus`, `userRole: "client" | "provider"`, `scheduledDate: Date`, `completedAt?: Date`
  - Popover content: role-aware explanation + scheduled date + completion timestamp if completed
  - Integrate into service booking detail page, replacing existing status display
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

---

## Track 3: Payment Transparency

- [x] 12. Create `PaymentTransparencyCallout` component
  - Create `src/features/payments/components/payment-transparency-callout.tsx`
  - Props: `role: "renter" | "owner"`, `variant?: "booking-confirmation" | "rental-detail"`
  - Renter copy: "When you're charged — You'll be charged when your request is accepted. No charge if declined."
  - Owner/Provider copy: "How you get paid — For rentals: payment is released after the rental starts. For services: payment is released when the service is marked complete. Funds arrive in 1–2 business days via Stripe."
  - Use `Alert` shadcn component with `Info` icon, soft blue tint background
  - _Requirements: 3.1, 3.2, 3.6, 3.7_

- [x] 13. Create `HowPaymentsWorkModal` component
  - Create `src/features/payments/components/how-payments-work-modal.tsx`
  - Trigger: `HelpCircle` icon button (from lucide-react), placed inline near price/total
  - Modal uses `Dialog` from shadcn/ui; keyboard dismissable (Escape), click-outside, explicit close button
  - Content: two sections — "For Renters & Clients" (3 bullets) and "For Owners & Providers" (4 bullets) per design doc
  - No props required — static content
  - _Requirements: 3.3, 3.4, 3.8_

- [x] 14. Add payment transparency to booking confirmation page
  - Locate booking confirmation page/component
  - Add `PaymentTransparencyCallout` with role-appropriate variant below the booking summary
  - Add `HowPaymentsWorkModal` trigger (`?` icon) next to the total/price line item
  - _Requirements: 3.1, 3.2, 3.3, 3.7_

- [x] 15. Add `HowPaymentsWorkModal` trigger to rental detail page
  - Add `HelpCircle` trigger next to the daily rate or total in `RentalDetailsCard`
  - _Requirements: 3.3, 3.8_

- [x] 16. Create `PaymentExplainerSection` and add to payments page
  - Create `src/features/payments/components/payment-explainer-section.tsx`
  - Props: `activeTab: "owner" | "renter"`
  - Use `Collapsible` from shadcn/ui; collapsed by default on mobile, expanded on desktop
  - Same content as `HowPaymentsWorkModal` formatted as a page section
  - Add to bottom of both owner and renter tab content in `src/app/dashboard/payments/page.tsx`
  - _Requirements: 3.5, 3.8_

---

## Track 4: Action Nudges & Overdue Alerts Extension

- [ ] 17. Add `getActionableAlerts` DAL method to `rentals.dal.ts`
  - Implement the `ActionableAlert` interface: `id`, `listingName`, `alertType`, `userRole`, `deliveryRequested`, `daysLate?`, `otherPartyName`, `linkTo`, `severity`
  - Query union of four alert categories:
    - `overdue_return`: `status IN ('approved','active') AND endDate < today`
    - `not_started`: `status = 'approved' AND startDate <= today AND endDate >= today`
    - `end_today`: `status = 'active' AND endDate = today`
    - `service_not_completed`: service bookings where `status = 'accepted' AND scheduledDate < today`
  - Determine `userRole` (owner vs. renter / provider vs. client) per rental using existing `userId` comparison logic in the DAL
  - Include `deliveryRequested` from the rental record
  - Compute `daysLate` as `Math.max(0, differenceInDays(today, relevantDate))`
  - Return alerts sorted by severity (error first) then by daysLate descending
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 18. Write unit tests for `getActionableAlerts`
  - Happy path: approved rental with startDate = today returns `not_started` alert for owner and renter with correct copy
  - Happy path: active rental with endDate = today returns `end_today` alert
  - Happy path: rental past endDate returns `overdue_return` alert with correct daysLate
  - Delivery-aware: `deliveryRequested = true` returns correct copy variant
  - Role-aware: owner and renter returned as separate alerts with distinct `userRole`
  - Exclusion: completed/cancelled/denied rentals not included
  - Empty: no alerts returned when no actionable items exist
  - _Requirements: 4.1–4.7_

- [ ] 19. Write unit tests for `formatAlertText`
  - Cover all role × delivery × daysLate combinations from the design doc alert copy table
  - _Requirements: 4.2–4.6_

- [ ] 20. Update `OverdueAlertsWidget` to use `getActionableAlerts`
  - Replace call to `getOverdueItemsForUser` with `getActionableAlerts` in the dashboard page data fetch
  - Update widget to call `formatAlertText(alert.alertType, alert.userRole, alert.deliveryRequested, alert.daysLate)` for display copy
  - Render `severity: "error"` alerts with red `AlertTriangle` icon (existing style)
  - Render `severity: "warning"` alerts with amber `Clock` icon
  - Keep `return null` when alerts array is empty
  - Verify `linkTo` navigates to correct rental/booking detail page
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 21. Create rental reminders cron API route
  - Create `src/app/api/cron/rental-reminders/route.ts`
  - Verify `Authorization: Bearer $CRON_SECRET` header (same pattern as all existing cron routes)
  - Query: rentals where `startDate = today AND status = 'approved'` → send `rental_reminder` push notification to both renter and owner via existing `sendNotification()`
  - Query: rentals where `startDate < today AND status = 'approved'` (missed start) → send `rental_reminder` push notification
  - Use role-aware + delivery-aware copy from `formatAlertText` for notification body
  - Continue to next rental if `sendNotification` fails for one; log error
  - Return `{ sent: N }` JSON response
  - _Requirements: 4.8, 4.9, 4.10_

- [ ] 22. Add rental reminders step to GitHub Actions cron workflow
  - Add step to the `daily` job in `.github/workflows/cron-jobs.yml`:
    ```yaml
    - name: Send rental reminders
      run: |
        curl --fail -s -X GET \
          -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
          ${{ vars.NEXT_PUBLIC_APP_URL }}/api/cron/rental-reminders
    ```
  - _Requirements: 4.8, 4.9_

---

## Track 5: "How Hoador Works" Page & Modal

- [ ] 23. Create public `/how-it-works` page
  - Create `src/app/how-it-works/page.tsx` as an RSC with no auth dependency
  - Confirm the page is excluded from auth middleware (check `middleware.ts` matcher config)
  - Add `generateMetadata()` with title "How Hoador Works" and descriptive meta description
  - Page layout: NOT wrapped in authenticated sidebar — use a minimal standalone layout or the public layout if one exists
  - Content sections per design doc:
    - Hero: "How Hoador Works" + tagline "Rent anything from neighbors. Offer what you own or do."
    - "For Renters & Clients" — 3-step visual cards (Find, Request, Meet & use)
    - "For Owners & Providers" — 3-step visual cards (List, Accept, Get paid)
    - Optional FAQ strip (3 questions linking to support)
    - Footer with link back to home and sign-up CTA
  - Page is fully responsive and accessible on mobile and desktop
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.11, 5.12_

- [ ] 24. Create `HowHoadorWorksModal` component
  - Create `src/components/how-hoador-works-modal.tsx` as a client component
  - Props: `trigger?: React.ReactNode`, `open?: boolean`, `onOpenChange?: (open: boolean) => void`
  - Uses `Dialog` from shadcn/ui; keyboard dismissable, focus trapped, Escape closes
  - Content: condensed 3+3 step layout (scrollable, stacked on mobile)
  - Include "See full guide →" link that opens `/how-it-works` in a new tab (`target="_blank"`)
  - _Requirements: 5.8, 5.9, 5.10_

- [ ] 25. Add "How Hoador Works" link to avatar sidebar dropdown
  - In `src/components/nav-user.tsx`, add a `DropdownMenuItem` with `<a href="/how-it-works" target="_blank" rel="noopener noreferrer">`
  - Use `HelpCircle` icon from lucide-react
  - Place above "Log out", below account/billing items
  - _Requirements: 5.5, 5.6, 5.7_

- [ ] 26. Link `HowHoadorWorksModal` from relevant empty states
  - On the dashboard, add a secondary "How does Hoador work?" link to the `UnreadMessagesWidget` empty state (or a general dashboard empty-state context) that opens `HowHoadorWorksModal`
  - Optionally add to the explore no-results empty state
  - _Requirements: 5.10_

---

## Track 6: Microcopy Sweep

- [x] 27. Update navigation labels in `src/constants/navbar.ts`
  - "Explore" → "Browse"
  - "Activity" → "Your rentals & bookings"
  - "Manage Listings" → "Your listings"
  - "Mailbox" → "Messages"
  - Group label "RENTALS" (Activity) → "Rentals"
  - Group label "SERVICES" (Activity) → "Services"
  - Group label "RENTALS" (Manage Listings) → "Rental listings"
  - Group label "SERVICES" (Manage Listings) → "Service listings"
  - _Requirements: 6.1, 6.4, 6.5_

- [x] 28. Update CTA and button labels across priority surfaces
  - [x] 28.1 Dashboard: "List a Tool" → "List something", "Browse Tools" → "Browse" in Quick Actions bar
    - _Requirements: 6.1, 6.2_
  - [x] 28.2 Explore/browse page: page heading "Explore" → "Browse rentals & services"
    - _Requirements: 6.1, 6.4_
  - [x] 28.3 Manage listings: page heading "My Listings" → "Your listings"; create CTA "Create listing" → "List an item", "Create service" → "List a service"
    - _Requirements: 6.2, 6.4_
  - [x] 28.4 Activity page: heading "Bookings" → "Your rentals & bookings"; verify sub-section headings are consistent
    - _Requirements: 6.1, 6.4_
  - [x] 28.5 Booking flow: primary CTA "Book" or "Submit" → "Request booking"
    - _Requirements: 6.2_
  - [x] 28.6 Payments page tabs: "Owner" → "Earnings & payouts", "Renter" → "Payment methods"
    - _Requirements: 6.2_
  - [x] 28.7 Rental listing detail page: review any generic labels (e.g., section headings, action labels) and update to plain language per design doc
    - _Requirements: 6.4_
  - [x] 28.8 Service listing detail page: same review and update as rental detail
    - _Requirements: 6.4_

- [x] 29. Update dashboard widget headings
  - "Upcoming Schedule" → "Coming up"
  - "Recent Activity" → "Recent activity"
  - "Top Performing Tools" → "Your top listings"
  - "Neighborhood Activity" → "Near you"
  - "Tips & Suggestions" → "Tips for you"
  - _Requirements: 6.1, 6.4_

- [x] 30. Audit and update ARIA labels and accessibility attributes to match changed visible copy
  - For each label changed in tasks 27–29, locate and update corresponding `aria-label`, `title`, or screen-reader-only text attributes
  - _Requirements: 6.8_
