# UX Improvements Phase 1 — Design Document

## Overview

This design maps each Phase 1 requirement to concrete architectural decisions, components, and data changes within the existing Hoador codebase. The guiding constraint is **no new schema**; every feature must build on existing DAL methods, notification infrastructure, and component patterns.

The work falls into six tracks:

| Track                | Requirements | New Components                                                                  | DAL Changes                                  |
| -------------------- | ------------ | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Empty State Coaching | Req 1        | `EmptyStateCoach`                                                               | None                                         |
| Status Explainer     | Req 2        | `RentalStatusProgress`, `ServiceStatusProgress`                                 | None                                         |
| Payment Transparency | Req 3        | `PaymentTransparencyCallout`, `HowPaymentsWorkModal`, `PaymentExplainerSection` | None                                         |
| Action Nudges        | Req 4        | Overdue widget extension                                                        | `getActionableAlerts` DAL method, cron route |
| How Hoador Works     | Req 5        | `HowHoadorWorksModal`, `/how-it-works` page                                     | None                                         |
| Microcopy            | Req 6        | None                                                                            | None                                         |

All components use **shadcn/ui** primitives (Card, Dialog, Badge, Tooltip, Popover), **lucide-react** icons, and **TailwindCSS** with the project's existing color token system.

---

## Architecture

The project follows a **React Server Component (RSC)** architecture with client components used only for interactivity. This design respects that boundary throughout:

- **Server components**: Dashboard page, rental detail page, payments page, the new `/how-it-works` page
- **Client components**: Status progress explainer (needs click/tap), payment transparency modal, How Hoador Works modal, overdue widget (already client-rendered)
- **No new API routes** required except a single cron endpoint for push notification reminders (Req 4)

### File Structure

New files introduced by this spec:

```
src/
  components/
    empty-state-coach.tsx            # Reusable empty state component (Req 1)
    how-hoador-works-modal.tsx       # Modal version of how-it-works (Req 5)
  features/
    rentals/
      components/
        detail-page/
          rental-status-progress.tsx # Status stepper for rentals (Req 2)
    payments/
      components/
        payment-transparency-callout.tsx  # Inline booking callout (Req 3)
        how-payments-work-modal.tsx       # ? icon modal (Req 3)
        payment-explainer-section.tsx     # Payments page section (Req 3)
    dashboard/
      components/
        overdue-alerts-widget.tsx    # Extended (Req 4) — existing file modified
  app/
    how-it-works/
      page.tsx                       # Public marketing/help page (Req 5)
    api/
      cron/
        rental-reminders/
          route.ts                   # Cron endpoint for push nudges (Req 4)
```

Modified files:

```
src/
  constants/
    navbar.ts                        # Microcopy label updates (Req 6)
  components/
    nav-user.tsx                     # Add How Hoador Works link (Req 5)
  dal/
    rentals.dal.ts                   # Add getActionableAlerts method (Req 4)
  features/
    rentals/
      components/
        detail-page/
          rental-status-card.tsx     # Integrate status progress (Req 2)
    dashboard/
      components/
        [multiple widgets]           # Empty state coaching copy (Req 1)
  app/
    dashboard/
      (rentals)/rental/[id]/page.tsx # Integrate status progress (Req 2)
    dashboard/payments/page.tsx      # Add payment explainer section (Req 3)
```

---

## Components and Interfaces

### Requirement 1 — Empty State Coaching

#### `EmptyStateCoach`

A reusable component that replaces generic empty states across the app. It accepts a configuration object and renders a consistent coaching pattern.

```typescript
// src/components/empty-state-coach.tsx
interface EmptyStateCoachProps {
  icon: LucideIcon;
  iconColor?: string; // e.g. "text-emerald-400"
  iconBg?: string; // e.g. "bg-emerald-500/10"
  headline: string; // e.g. "Rent your first item"
  description: string; // e.g. "Browse tools near you..."
  cta?: {
    label: string;
    href: string;
    variant?: "default" | "outline";
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  className?: string;
}
```

**Visual pattern** (consistent with existing widget empty states):

```
[Icon in soft colored circle]
[Headline — font-medium, text-foreground]
[Description — text-sm, text-muted-foreground]
[CTA Button]
```

**Adoption per surface** (in priority order):

| Surface                             | Current behavior                | New behavior                                                                                                     |
| ----------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Dashboard: UpcomingScheduleWidget   | Shows "Nothing scheduled" text  | Add CTA: "Browse rentals & services" → `/explore`                                                                |
| Dashboard: RecentActivityFeed       | Shows "No recent activity" text | Add CTA: "Browse rentals & services" → `/explore`                                                                |
| Dashboard: UnreadMessagesWidget     | `return null` (hides entirely)  | Show EmptyStateCoach with "No messages yet" + "Your conversations will appear here" + "Browse" CTA               |
| Dashboard: OverdueAlertsWidget      | `return null` (hides entirely)  | Keep hidden (overdue = no news is good news)                                                                     |
| Dashboard: PendingRequestsWidget    | `return null`                   | Keep hidden (action-required widget, no coaching needed when empty)                                              |
| Dashboard: TopPerformingToolsWidget | Shows text only                 | Keep hidden (`return null`) until there is rental activity to report — no coaching empty state here              |
| Payments page                       | Unknown / generic               | EmptyStateCoach: "No payments yet" + "List something to start earning" + "List an item" CTA                      |
| Manage listings (rentals)           | Unknown / generic               | EmptyStateCoach: "Start earning from things you already own" + "Most listings take under 2 minutes"              |
| Manage listings (services)          | Unknown / generic               | EmptyStateCoach: "Offer your skills or services" + "List a service and start accepting bookings"                 |
| Activity (rentals, borrower)        | Unknown / generic               | EmptyStateCoach: "Nothing rented yet" + "Browse items available near you and request a booking"                  |
| Activity (rentals, owner)           | Unknown / generic               | EmptyStateCoach: "No rental requests yet" + "List something to start receiving requests"                         |
| Activity (services, client)         | Unknown / generic               | EmptyStateCoach: "No service bookings yet" + "Browse services available in your area"                            |
| Activity (services, provider)       | Unknown / generic               | EmptyStateCoach: "No service requests yet" + "List a service to start receiving bookings"                        |
| Messages (mailbox)                  | Unknown / generic               | EmptyStateCoach: "No messages yet" + "Messages appear here when you book or accept a rental or service"          |
| Explore (no results)                | Unknown / generic               | EmptyStateCoach: "Nothing found" + "Try adjusting your search or browse everything available" + "Browse all" CTA |

> Note: TopPerformingTools joins Overdue and PendingRequests as a widget that stays hidden when empty — its value is showing real performance data, not coaching. UnreadMessages is the exception: coaching is appropriate since users may not know messages exist.

---

### Requirement 2 — Rental & Service Booking Status Explainer

#### `RentalStatusProgress`

A new client component added to the rental detail page, positioned above or integrated into the existing `RentalStatusCard`.

```typescript
// src/features/rentals/components/detail-page/rental-status-progress.tsx
interface RentalStatusProgressProps {
  currentStatus: RentalStatus; // from _enums.ts
  disputeId?: string; // if present, show dispute state
  userRole: "renter" | "owner";
}
```

**State machine for display:**

| DB Status   | Step label | Step index | Terminal?                        |
| ----------- | ---------- | ---------- | -------------------------------- |
| `pending`   | Requested  | 0          | No                               |
| `approved`  | Accepted   | 1          | No                               |
| `active`    | Active     | 2          | No                               |
| `completed` | Completed  | 3          | Yes ✓                            |
| `denied`    | Declined   | —          | Yes ✗                            |
| `cancelled` | Cancelled  | —          | Yes ✗                            |
| `overdue`   | Overdue    | —          | Warning (shown on top of active) |

**Normal flow stepper** (pending → approved → active → completed):

```
[●]──────[●]──────[○]──────[○]
Requested  Accepted  Active  Completed
(current step highlighted with primary color, past steps with check marks)
```

**Terminal state** (denied/cancelled): replace stepper with a single status badge + plain language explanation.

**Overdue**: render normal stepper but inject an amber warning banner above: "This rental is past its return date."

**Dispute present**: render normal stepper but inject a red warning banner with link to dispute: "An active dispute is open for this rental → View dispute"

**Step explanation popover** (on tap/click of current step):

- Triggered via `Popover` or `Tooltip` from shadcn/ui
- Content is role-aware (different copy for renter vs. owner)

| Status    | Renter explanation                                                                                       | Owner explanation                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| pending   | "Your request has been sent. The owner will review it and respond soon."                                 | "You have a new rental request. Review it and accept or decline."                                                |
| approved  | "The owner accepted your request. Coordinate pickup and be ready to receive the item on the start date." | "You accepted this request. Coordinate handoff with the renter. Mark it as started when you hand over the item." |
| active    | "Your rental is in progress. The owner will end the rental when you return the item."                    | "This rental is active. Click End Rental when the item has been returned."                                       |
| completed | "This rental is complete. Consider leaving a review."                                                    | "This rental is complete. Consider leaving a review."                                                            |

**Integration point:** `RentalStatusProgress` replaces `rental-status-card.tsx` entirely. It takes over responsibility for all status-related display, including the timestamps and key dates currently shown in that card. Those details (start date, end date, actual start/end timestamps if available) are surfaced in the step popover for the current step rather than shown as a separate card.

**Popover content includes (for current step):**

- Role-aware plain-language explanation
- Relevant dates: start date, end date (always shown)
- If `active`: actual start timestamp ("Started [date/time]")
- If `completed`: start timestamp + return confirmed timestamp
- Pickup/return instructions if set by owner (shown under `approved` step)

#### `ServiceStatusProgress`

Identical pattern to `RentalStatusProgress` but maps service booking statuses:

| DB Status                | Step label | Step index |
| ------------------------ | ---------- | ---------- |
| `pending`                | Requested  | 0          |
| `accepted`               | Accepted   | 1          |
| `completed`              | Completed  | 2          |
| `cancelled` / `declined` | Terminal   | —          |

Integration point: service booking detail page (equivalent of rental detail for services).

---

### Requirement 3 — Payment & Money Transparency

#### `PaymentTransparencyCallout`

An inline callout rendered on the booking confirmation page. Role-aware: shows renter copy or owner copy based on the current user's role in the booking.

```typescript
// src/features/payments/components/payment-transparency-callout.tsx
interface PaymentTransparencyCalloutProps {
  role: "renter" | "owner";
  variant?: "booking-confirmation" | "rental-detail";
}
```

**Renter/Client copy:**

> 💳 **When you're charged**
> You'll be charged when your request is accepted. No charge if declined.

**Owner/Provider copy:**

> 💰 **How you get paid**
> For rentals: payment is released after the rental starts.
> For services: payment is released when the service is marked complete.
> Funds arrive in 1–2 business days via Stripe.

Visual: uses the existing `Alert` shadcn component with an info icon, soft background (blue-50/blue-500 tint), no hard border.

#### `HowPaymentsWorkModal`

Triggered by a `?` icon (using `HelpCircle` from lucide-react) placed inline near the price/total on booking confirmation and rental detail pages.

```typescript
// src/features/payments/components/how-payments-work-modal.tsx
// No props — content is static
```

**Modal content structure:**

```
How payments work
─────────────────
For Renters & Clients — When you're charged
  • You're charged when your request is accepted
  • If declined, no charge is made
  • Refunds follow our cancellation policy

For Owners & Providers — How you get paid
  • For rentals: payment is released after the rental starts
  • For services: payment is released when the service is marked complete
  • Funds arrive in 1–2 business days via Stripe
  • Stripe Connect is required to receive payouts

[Close]
```

Uses `Dialog` from shadcn/ui. Accessible: keyboard dismissable, focus trapped, escape key closes.

**Trigger placement:**

- Booking confirmation page: next to the total line item
- Rental detail page (`RentalDetailsCard`): next to the daily rate or total
- Payments page: as a "Learn more" link next to the explainer section heading

#### `PaymentExplainerSection`

A static accordion/collapsible section added to the bottom of the payments page (both owner and renter tabs).

```typescript
// src/features/payments/components/payment-explainer-section.tsx
interface PaymentExplainerSectionProps {
  activeTab: "owner" | "renter";
}
```

Uses `Collapsible` from shadcn/ui. Collapsed by default on mobile, expanded by default on desktop. Contains the same content as `HowPaymentsWorkModal` but formatted as a section with a heading rather than a modal.

---

### Requirement 4 — Action Nudges & Overdue Alerts Extension

#### DAL Extension: `getActionableAlerts`

A new method added to `rentals.dal.ts` (or a companion method alongside the existing `getOverdueItemsForUser`) that returns all items requiring user attention, including both existing overdue returns and the new nudge categories.

```typescript
// src/dal/rentals.dal.ts (new method)

type AlertType =
  | "overdue_return" // past end date, not ended
  | "not_started" // start date today or past, not started (status: approved)
  | "end_today" // end date is today, not yet ended (status: active)
  | "service_not_completed"; // service date past, not marked complete

interface ActionableAlert {
  id: string;
  listingName: string;
  alertType: AlertType;
  userRole: "owner" | "renter" | "provider" | "client";
  deliveryRequested: boolean; // drives delivery-aware copy
  daysLate?: number; // for overdue_return and not_started past-due
  otherPartyName: string;
  linkTo: string;
  severity: "warning" | "error"; // drives icon/color in widget
}

// Copy generation is handled by a separate helper, not baked into the DAL:
// formatAlertText(alertType, userRole, deliveryRequested, daysLate?) → string

async function getActionableAlerts(userId: string): Promise<ActionableAlert[]>;
```

**Query logic:**

```
UNION of:
1. overdue_return:
   WHERE status IN ('approved', 'active')
   AND endDate < TODAY
   → existing behavior, mapped to new type

2. not_started:
   WHERE status = 'approved'
   AND startDate <= TODAY
   AND endDate >= TODAY   (still in window, just not started)
   → "Rental starts today" or "Rental should have started X days ago"

3. end_today:
   WHERE status = 'active'
   AND endDate = TODAY
   → "Rental ends today — don't forget to end it"

4. service_not_completed (service bookings DAL):
   WHERE status = 'accepted'
   AND scheduledDate < TODAY
   → "Service was scheduled for X — mark it complete"
```

**Alert copy rules (role-aware + delivery-aware):**

The owner is the one who clicks "Start Rental" and "End Rental" (confirmed from `rental-actions.tsx`). The renter is passive for those actions but still benefits from a heads-up. Alerts are sent to both parties but with different copy depending on role **and** whether `deliveryRequested = true`.

| alertType             | Sent to  | deliveryRequested | daysLate = 0                                                                 | daysLate > 0                                                                  |
| --------------------- | -------- | ----------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| not_started           | Owner    | false (pickup)    | "Rental starts today — mark it as started when the renter picks up the item" | "This rental should have started {N} day(s) ago"                              |
| not_started           | Owner    | true (delivery)   | "Rental starts today — mark it as started when you deliver the item"         | "This rental should have started {N} day(s) ago"                              |
| not_started           | Renter   | false (pickup)    | "Your rental starts today — coordinate pickup with the owner"                | "Your rental was due to start {N} day(s) ago"                                 |
| not_started           | Renter   | true (delivery)   | "Your rental starts today — the owner will deliver the item to you"          | "Your rental was due to start {N} day(s) ago"                                 |
| end_today             | Owner    | false (pickup)    | "Rental ends today — click End Rental when the item is returned"             | (covered by overdue_return)                                                   |
| end_today             | Owner    | true (delivery)   | "Rental ends today — click End Rental when you pick up the item"             | (covered by overdue_return)                                                   |
| end_today             | Renter   | false (pickup)    | "Your rental ends today — return the item to the owner"                      | (covered by overdue_return)                                                   |
| end_today             | Renter   | true (delivery)   | "Your rental ends today — the owner will come to collect the item"           | (covered by overdue_return)                                                   |
| overdue_return        | Owner    | false (pickup)    | —                                                                            | "Return is {N} day(s) overdue — end the rental once the item is back"         |
| overdue_return        | Owner    | true (delivery)   | —                                                                            | "Return is {N} day(s) overdue — end the rental once you collect the item"     |
| overdue_return        | Renter   | false (pickup)    | —                                                                            | "Your return is {N} day(s) overdue — return the item to the owner"            |
| overdue_return        | Renter   | true (delivery)   | —                                                                            | "Your return is {N} day(s) overdue — contact the owner to arrange collection" |
| service_not_completed | Provider | n/a               | "Service was today — mark it complete when finished"                         | "Service from {N} day(s) ago hasn't been marked complete"                     |
| service_not_completed | Client   | n/a               | "Your service was today — contact your provider if there's an issue"         | "Your service from {N} day(s) ago hasn't been completed"                      |

The `getActionableAlerts` method receives a `userId` and determines the user's role and `deliveryRequested` value per rental to return the correct copy. The `ActionableAlert` interface does not expose raw copy strings directly — the alert type, role, and delivery flag are passed to a `formatAlertText(alertType, role, deliveryRequested, daysLate)` helper so copy stays testable and centralized.

#### `OverdueAlertsWidget` Extension

The existing widget at `src/features/dashboard/components/overdue-alerts-widget.tsx` is updated to:

1. Call `getActionableAlerts(userId)` instead of `getOverdueItemsForUser(userId)`
2. Render alerts with severity-aware icons:
   - `severity: "error"` → red `AlertTriangle` (existing overdue style)
   - `severity: "warning"` → amber `Clock` icon
3. Keep the same card structure and `return null` when no alerts

**Severity mapping:**

| alertType                  | severity        |
| -------------------------- | --------------- |
| overdue_return             | error (red)     |
| not_started (daysLate > 0) | error (red)     |
| not_started (daysLate = 0) | warning (amber) |
| end_today                  | warning (amber) |
| service_not_completed      | warning (amber) |

#### Push Notification Cron Route

A new Next.js API route that sends push reminders for rentals starting today. Designed to be called by a Vercel Cron Job.

```typescript
// src/app/api/cron/rental-reminders/route.ts

// Called daily (e.g., 8:00 AM via vercel.json cron config)
// Secured with CRON_SECRET env var header check

export async function GET(request: Request) {
  // 1. Verify CRON_SECRET
  // 2. Query: all rentals where startDate = today AND status = 'approved'
  // 3. For each: sendNotification({ type: 'rental_reminder', ... }) to both renter and owner
  // 4. Query: all rentals where startDate < today AND status = 'approved' (missed start)
  // 5. For each: sendNotification({ type: 'rental_reminder', ... })
  // 6. Return { sent: N }
}
```

**Uses existing `sendNotification()` utility** with `type: "rental_reminder"` (already in the notification type enum, mapped to "reminders" category). No new notification types required.

**GitHub Actions cron configuration** (following the existing pattern in `.github/workflows/cron-jobs.yml`):

Add a new step to the `daily` job in `cron-jobs.yml`:

```yaml
- name: Send rental reminders
  run: |
    curl --fail -s -X GET \
      -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
      ${{ vars.NEXT_PUBLIC_APP_URL }}/api/cron/rental-reminders
```

The daily job already runs at `0 2 * * *` (2:00 AM UTC). This timing is intentional for reminders — users will see the notification when they wake up. The route is secured with the existing `CRON_SECRET` header check pattern used across all cron routes.

> Note: The existing fire-and-forget push architecture and user preference checks in `sendNotification()` handle permission gating automatically. No changes to the notification system are required.

---

### Requirement 5 — "How Hoador Works" Page & Modal

#### Public Page: `/how-it-works`

A new Next.js page at `src/app/how-it-works/page.tsx`. No auth required. No database queries. Static content rendered as an RSC.

**Page structure:**

```
<header>
  Hoador logo (links to /)
  [Optional: Sign in / Sign up CTAs for logged-out visitors]
</header>

<main>
  <section: hero>
    "How Hoador Works"
    [Short tagline: "Rent anything from neighbors. Offer what you own or do."]

  <section: For Renters & Clients>
    3-step visual cards:
    1. Find something near you     [Search icon]
       Browse items and services listed by people in your community
    2. Request a booking           [Calendar icon]
       Pick your dates or schedule and send a request — no commitment until accepted
    3. Meet & use                  [Users icon]
       Meet up to receive the item or have the service completed

  <section: For Owners & Providers>
    3-step visual cards:
    1. List what you have           [Tag icon]
       List an item to rent or a service you offer — takes under 2 minutes
    2. Accept a request             [CheckCircle icon]
       Review requests and accept the ones that work for you
    3. Get paid                     [DollarSign icon]
       Payment is released when the rental starts or service is completed.
       Funds arrive via Stripe in 1–2 business days.

  <section: FAQ strip (optional)>
    "Is Hoador free to join?" / "How does payment work?" / "What if something goes wrong?"
    → Each links to a support email or help resource

  <footer>
    Link back to Hoador / sign up CTA
</main>
```

**Route considerations:**

- `src/app/how-it-works/page.tsx` — no auth middleware, no session dependency
- `generateMetadata()` exports title and description for SEO
- Page uses existing design system tokens but is NOT wrapped in the authenticated sidebar layout

#### `HowHoadorWorksModal`

A dismissable modal version of the same content, condensed for inline use.

```typescript
// src/components/how-hoador-works-modal.tsx
interface HowHoadorWorksModalProps {
  trigger?: React.ReactNode; // optional custom trigger; defaults to a Button
  open?: boolean; // controlled mode (for empty-state-triggered opens)
  onOpenChange?: (open: boolean) => void;
}
```

Uses `Dialog` from shadcn/ui. Content is the same 3+3 steps but in a scrollable two-column layout (or stacked on mobile). Includes a "See full guide →" link that opens `/how-it-works` in a new tab.

#### Avatar Sidebar Link

Add a new item to the `NavUser` dropdown in `src/components/nav-user.tsx`:

```tsx
<DropdownMenuItem asChild>
  <a href="/how-it-works" target="_blank" rel="noopener noreferrer">
    <HelpCircle className="mr-2 h-4 w-4" />
    How Hoador Works
  </a>
</DropdownMenuItem>
```

Placed above the "Log out" item, below any account/billing items. The `target="_blank"` handles both browser and PWA open-in-new-tab requirements natively.

---

### Requirement 6 — Microcopy Sweep

Microcopy changes are isolated to constants and component copy. No logic changes.

#### Navigation (`src/constants/navbar.ts`)

| Location        | Current label                 | Updated label           |
| --------------- | ----------------------------- | ----------------------- |
| Nav item        | Explore                       | Browse                  |
| Nav item        | Activity                      | Your rentals & bookings |
| Nav item        | Manage Listings               | Your listings           |
| Nav item        | Mailbox                       | Messages                |
| Nav group label | RENTALS (in Activity)         | Rentals                 |
| Nav group label | SERVICES (in Activity)        | Services                |
| Nav group label | RENTALS (in Manage Listings)  | Rental listings         |
| Nav group label | SERVICES (in Manage Listings) | Service listings        |

> Note: "Browse" is short enough for the collapsed sidebar and covers both rentals and services without being tool-specific.

#### CTA & Button Labels

| Surface                      | Current                               | Updated                     |
| ---------------------------- | ------------------------------------- | --------------------------- |
| Create listing CTA           | "Create listing"                      | "List an item"              |
| Create service listing CTA   | "Create service"                      | "List a service"            |
| Booking CTA                  | "Book" / "Submit"                     | "Request booking"           |
| Rental start action          | "Start rental" (keep — this is clear) | No change                   |
| Rental end action            | "End rental" (keep)                   | No change                   |
| Explore / browse page header | "Explore"                             | "Browse rentals & services" |
| Manage listings page         | "My Listings"                         | "Your listings"             |
| Activity page                | "Bookings"                            | "Your rentals & bookings"   |
| Dashboard: Quick Actions     | "List a Tool"                         | "List something"            |
| Dashboard: Quick Actions     | "Browse Tools"                        | "Browse"                    |
| Dashboard: Quick Actions     | "Browse Services" (if present)        | "Browse services"           |
| Payments page tab            | "Owner"                               | "Earnings & payouts"        |
| Payments page tab            | "Renter"                              | "Payment methods"           |

#### Dashboard Widget Headings

| Widget                | Current heading         | Updated heading     |
| --------------------- | ----------------------- | ------------------- |
| Upcoming Schedule     | "Upcoming Schedule"     | "Coming up"         |
| Recent Activity       | "Recent Activity"       | "Recent activity"   |
| Top Performing Tools  | "Top Performing Tools"  | "Your top listings" |
| Neighborhood Activity | "Neighborhood Activity" | "Near you"          |
| Tips & Suggestions    | "Tips & Suggestions"    | "Tips for you"      |

---

## Data Models

### No schema changes required for Phase 1.

The `getActionableAlerts` DAL method queries existing columns:

- `rentals.status` (existing enum)
- `rentals.startDate` (existing column)
- `rentals.endDate` (existing column)
- `serviceBookings.status` (existing enum)
- `serviceBookings.scheduledDate` (existing column — confirm column name in tasks phase)

The push notification cron uses existing `sendNotification()` and existing `rental_reminder` type.

---

## Error Handling

| Component              | Error scenario                    | Behavior                                                       |
| ---------------------- | --------------------------------- | -------------------------------------------------------------- |
| `EmptyStateCoach`      | Display-only, no data fetching    | No error state needed                                          |
| `RentalStatusProgress` | Unknown/unexpected status value   | Fall back to a plain text status badge (existing behavior)     |
| `HowPaymentsWorkModal` | Static content                    | No error state needed                                          |
| `getActionableAlerts`  | DB query fails                    | Return empty array; widget hides gracefully (existing pattern) |
| Cron route             | sendNotification fails for a user | Log error, continue to next user; return partial success count |
| `/how-it-works` page   | Static, no DB                     | No error state needed                                          |
| `HowHoadorWorksModal`  | Static content                    | No error state needed                                          |

The dashboard's existing **safe-wrap pattern** (parallel Promise.all with per-widget fallbacks) means `getActionableAlerts` failures will not break the dashboard page.

---

## Testing Strategy

### Unit Tests

- `getActionableAlerts` DAL method:
  - Returns `not_started` alerts for approved rentals where startDate ≤ today
  - Returns `end_today` alerts for active rentals where endDate = today
  - Returns `overdue_return` alerts for rentals past endDate
  - Returns empty array when no actionable items exist
  - Does not return alerts for completed/cancelled/denied rentals

- `RentalStatusProgress` component:
  - Renders correct step count and current step for each status
  - Highlights the correct current step
  - Shows terminal state UI for denied/cancelled
  - Shows overdue banner when status is overdue
  - Shows dispute banner when disputeId is present
  - Popover shows role-appropriate explanation text

- `EmptyStateCoach` component:
  - Renders headline, description, and CTA
  - CTA navigates to correct href
  - Renders without CTA when none provided

- `HowPaymentsWorkModal`:
  - Opens when trigger is clicked
  - Closes on Escape key
  - Contains both renter and owner sections

### Integration Tests

- Overdue widget renders new `not_started` and `end_today` alerts correctly with correct copy and severity styling
- Booking confirmation page renders `PaymentTransparencyCallout` for both renter and owner roles
- `/how-it-works` page renders without authentication (no redirect)
- Cron route: given mocked rentals starting today, calls `sendNotification` for renter and owner

### E2E / Manual Tests

- Status progress indicator is visible on rental detail page and tapping the current step shows explanation
- `HowHoadorWorksModal` opens from an empty state coaching CTA
- "How Hoador Works" link in avatar dropdown opens a new tab
- Payments page shows the explainer section
- Navigation labels match updated microcopy across all 8 surfaces

---

## Design Decisions & Rationale

**Why extend `getActionableAlerts` instead of multiple DAL calls?**
The dashboard fetches data for many widgets in parallel. A single method that returns all alert types reduces round-trips and keeps the widget's data contract clean. The widget doesn't need to know the business rules — it just renders whatever alerts the DAL returns.

**Why use `rental_reminder` (existing notification type) instead of a new type?**
Adding new notification types requires schema changes and notification-type-map updates. The `rental_reminder` type already exists, maps to the "reminders" category (which users can toggle), and is semantically correct. The copy in the push payload differentiates start-day vs. missed-start nudges without needing separate types.

**Why is `/how-it-works` a separate public route rather than a modal-only experience?**
Public pages are shareable, indexable by search engines, and can be linked from support emails or external marketing. The modal provides the same content inline for authenticated users but doesn't replace the permanent URL.

**Why not add `target="_blank"` to the nav link via the navbar constants?**
The existing `NavLink` type in `navbar.ts` doesn't support `target`. The `NavUser` dropdown is a custom Radix `DropdownMenu` that renders raw anchor tags, making it straightforward to add `target="_blank"` directly there without modifying the nav constants schema.

**Why keep OverdueAlertsWidget hidden when empty (vs. coaching empty state)?**
The overdue widget's absence is inherently positive — it means nothing is wrong. Showing a coaching empty state here would train users to expect something there and feel anxious when it appears. Widgets that hide when empty are action-required widgets; coaching empty states belong on browsing/discovery surfaces.
