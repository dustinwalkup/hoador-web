# User Dashboard Test Plan

## Overview

This test plan defines how to verify the User Dashboard feature against [specs/dashboard/1-requirements.md](specs/dashboard/1-requirements.md). It maps test cases to requirements, specifies unit, integration, E2E, and manual testing, and covers the design in [specs/dashboard/2-design.md](specs/dashboard/2-design.md).

## Requirements Traceability

Each requirement has explicit test coverage below.

### Requirement 1: Dashboard Page Layout and Navigation

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 1

**Test Coverage**:

- Integration: Dashboard page is served at `/dashboard` for authenticated users only.
- Integration: Unauthenticated request to `/dashboard` redirects to sign-in or auth flow.
- Integration: Page header displays a personalized greeting using the user's first name (or fallback "User" when missing).
- Integration: Section order matches design (header, alerts row, summary cards, quick actions, widgets).
- Integration: No Reward Points section or copy is present anywhere on the page.
- Integration: Layout is responsive (grid/layout behaves correctly at different viewport sizes).
- Unit/Integration: All links/buttons use existing application routes (garage, explore, mailbox, rentals, profile).
- E2E: Authenticated user can open `/dashboard` and see header and at least summary cards and quick actions.

### Requirement 2: Summary Statistics Cards

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 2

**Test Coverage**:

- Unit: RentalDAL.countBorrowedListings and countSharedListings return correct counts for test user.
- Unit: PaymentDAL.getUserEarningsForMonth returns correct sum for a given month and user.
- Integration: Dashboard RSC passes correct counts and earnings into summary cards (no hardcoded values).
- Integration: Four cards are present: Active Rentals, Tools Lent, Pending Requests, This Month Earnings.
- Integration: Counts are displayed as whole numbers; earnings as currency.
- Integration: When a DAL call for summary data fails, that widget shows error/fallback and the rest of the page still renders.
- Unit: Summary cards component renders correct values and loading/error states when passed via props.

### Requirement 3: Overdue Alerts Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 3

**Test Coverage**:

- Unit: RentalDAL.getOverdueItemsForUser returns overdue items as borrower and as owner; items include listing name, status text, other party, and link.
- Integration: Overdue widget is hidden or shows empty state when getOverdueItemsForUser returns empty.
- Integration: When overdue items exist, widget shows count and list; each item links to the correct rental/request detail URL.
- Integration: Overdue data comes from DAL only (no hardcoded alert items).
- Unit: OverdueAlertsWidget renders items and links from props; does not render when items array is empty (or shows empty state per spec).

### Requirement 4: Pending Requests and Approvals Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 4

**Test Coverage**:

- Unit: RentalDAL.getLendingRequestsByStatus("pending", userId) returns pending requests with listing name, renter name, id.
- Integration: Pending Requests widget is hidden or shows empty state when there are no pending requests.
- Integration: When pending requests exist, each entry shows listing name, requester name, status text and a link to the request detail page only (no Accept or Decline buttons in the widget).
- Integration: "View All Requests" (or equivalent) appears when pending count exceeds display limit and links to lending/requests.
- Integration: Request detail URL helper produces correct route for a given rental request id.
- E2E: Clicking a pending request navigates to the request detail page (where user can approve/decline).

### Requirement 5: Pending Review Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 5

**Test Coverage**:

- Unit/Integration: Pending review count or list comes from ListingDAL.getUserListingsByApprovalStatus("pending_review", userId) or existing PendingReviewWidget data source.
- Integration: Widget is hidden or shows empty state when user has no listings pending review.
- Integration: Link to garage (or listings) with pending_review filter works (e.g. `/dashboard/garage?tab=pending_review`).
- E2E: User with pending review listings sees widget and can navigate to garage/listings.

### Requirement 6: Quick Actions Bar

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 6

**Test Coverage**:

- Unit: QuickActionsBar renders at least: List a Tool (or Add Listing), Browse Tools (Explore), View Messages (Mailbox).
- Integration: Each quick action link points to the correct route (e.g. garage/listings, explore, mailbox).
- Integration: Quick Actions bar is visible to all authenticated users and placed prominently (e.g. below header).
- Accessibility: Links are focusable and have discernible text (or ARIA labels).
- E2E: Clicking each quick action navigates to the expected page.

### Requirement 7: Unread Messages Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 7

**Test Coverage**:

- Unit: MessagesDAL.getUnreadMessageCount(userId) and getUserConversations(userId, false) return correct data.
- Integration: Unread count and recent conversations (e.g. 2–3) are passed from RSC to widget; no hardcoded message data.
- Integration: Widget shows count when > 0; shows recent conversation preview; links to mailbox or conversation.
- Integration: When no unread messages, widget shows zero or "No new messages" or still shows recent conversations per spec.
- Unit: UnreadMessagesWidget renders from props; handles empty conversations.

### Requirement 8: Mini-Analytics Section

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 8

**Test Coverage**:

- Unit: Analytics data (rentals per week, earnings trend, inventory usage) is derived from DAL/queries; no fake chart data.
- Unit: When insufficient data, analytics returns empty or zero so UI can show "Not enough data".
- Integration: Mini-Analytics section receives real aggregation data from dashboard RSC.
- Integration: Section is responsive; charts/numbers render without hardcoded values.
- Unit: MiniAnalyticsSection component shows empty state when data is missing or insufficient.

### Requirement 9: Recent Activity Feed

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 9

**Test Coverage**:

- Unit: getDashboardActivityFeed(userId, limit) returns composite activity (rentals, requests, listings, reviews) sorted by date desc; no hardcoded list.
- Integration: Activity feed receives data from RSC and displays title, description, relativeTime, and optional link.
- Integration: When no activity, feed shows empty state.
- Unit: RecentActivityFeed component renders items from props; empty state when items length 0.

### Requirement 10: Upcoming Schedule Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 10

**Test Coverage**:

- Unit: getUpcomingSchedule(userId) returns events for next 7 days (return due, pickup due) from borrowed + lending data; no hardcoded dates.
- Integration: UpcomingScheduleWidget receives entries from RSC; each has date, description, optional link.
- Integration: When no upcoming events, widget shows empty state or "Nothing scheduled".
- Unit: UpcomingScheduleWidget renders entries from props; empty state when entries length 0.

### Requirement 11: Top Performing Tools Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 11

**Test Coverage**:

- Unit: ListingDAL.getTopPerformingListings(userId, limit) returns user's listings ordered by rental count or rating; limit respected.
- Integration: Widget receives data from RSC; displays listing name and metric (e.g. "N rentals", "X.X stars"); links to listing/garage.
- Integration: Widget hidden or empty state when user has no listings or no rental/rating data.
- Unit: TopPerformingToolsWidget renders from props; empty state when no listings.

### Requirement 12: Neighborhood Activity Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 12

**Test Coverage**:

- Unit: ListingDAL.getRecentListingsNearUser(userId, limit) returns recent listings (near user or platform-wide); or empty when no location and documented behavior.
- Integration: Widget receives data from RSC; displays limited list with name, optional distance/area, link.
- Integration: Empty state when no recent nearby (or platform) listings.
- Unit: NeighborhoodActivityWidget renders from props; empty state when no listings.

### Requirement 13: Tips and Suggestions Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 13

**Test Coverage**:

- Unit: getDashboardTips(userId) returns 1–3 rule-based tips from user/listing data (e.g. add photos, complete profile); no AI/external calls.
- Integration: Widget receives tips from RSC; displays text and optional link; hidden or generic message when no tips.
- Unit: TipsSuggestionsWidget renders from props; handles empty tips.

### Requirement 14: Active Disputes Summary Widget

**Requirement Reference**: `specs/dashboard/1-requirements.md` – Requirement 14

**Test Coverage**:

- Unit: DisputeDAL.getUserDisputes(userId, { status: non-closed }) returns user's active disputes (or equivalent filter).
- Integration: Widget receives disputes from RSC; shows count and list with status and link to detail/list.
- Integration: Widget hidden or "No active disputes" when user has no active disputes.
- Integration: If disputes feature is not implemented, widget is hidden or shows stub empty state (per edge case).
- Unit: ActiveDisputesWidget renders from props; empty state when no disputes.

### Non-Functional Requirements

**Performance**:

- Integration: Dashboard RSC uses a single Promise.all (or equivalent) for DAL calls; no unnecessary sequential round-trips.
- Integration: No N+1 pattern in dashboard data loading (e.g. one query per widget type, not per item).
- E2E or manual: Dashboard page load completes within 3 seconds on a typical connection for an authenticated user (or document deviation).

**Reliability**:

- Integration: When one DAL call in the parallel batch fails, that widget gets empty/error state and the rest of the dashboard still renders.
- Integration: When user.firstName is null/undefined, header uses fallback (e.g. "User").
- Integration: When DAL returns empty arrays/zero, widgets show empty state or hide without throwing.

**Security**:

- Integration: Dashboard page and DAL calls are gated by authentication; unauthenticated access redirects.
- Integration: All dashboard DAL calls are scoped by current user id (no cross-user data).
- Integration: No raw internal IDs or sensitive data exposed in UI beyond what is needed for links/labels.

**Usability**:

- Integration: Dashboard layout is responsive (e.g. grid breakpoints).
- Manual or E2E: Loading and empty states are clear; links and buttons navigate correctly.
- Accessibility: Quick actions and key links are keyboard navigable and have accessible names.

## Test Types and Strategy

### Unit Tests

**Purpose**: Test DAL methods, dashboard helpers, and presentational widgets in isolation with mocks.

**When to Use**:

- New or extended DAL methods: getOverdueItemsForUser, getUserEarningsForMonth, getTopPerformingListings, getRecentListingsNearUser.
- Helpers: getUpcomingSchedule, getDashboardActivityFeed, getDashboardTips (with mocked DALs).
- Widget components: render with various props (full data, empty, error); assert correct links and no Accept/Decline in PendingRequestsWidget.

**Framework**: Vitest. React Testing Library for component tests.

**Coverage Goals**: 80%+ for new DAL methods and dashboard helpers; 75%+ for widget components.

**Mock Strategy**:

- Mock DAL instances or modules so helpers and page receive controlled data.
- Use in-memory or test DB for DAL tests where the project already does so.

**Key Unit Tests**:

1. RentalDAL.getOverdueItemsForUser: with overdue as borrower, as owner, none; correct linkTo and statusText.
2. PaymentDAL.getUserEarningsForMonth: with payments in range, none, wrong user.
3. ListingDAL.getTopPerformingListings: with listings and rental counts/ratings; limit enforced.
4. ListingDAL.getRecentListingsNearUser: with location data, without (platform-wide or empty).
5. getUpcomingSchedule: mixed borrowed/lending data; next 7 days only; sorted.
6. getDashboardActivityFeed: composite sources; limit; sorted by date desc.
7. getDashboardTips: rules (e.g. no photos, incomplete profile); returns 0–3 tips.
8. DashboardSummaryCards: renders four cards with correct values; loading/error props.
9. PendingRequestsWidget: renders links only; no Accept/Decline buttons; "View All" when count > display limit.
10. OverdueAlertsWidget: renders items with links; empty state when no items.

### Integration Tests

**Purpose**: Test dashboard RSC and its interaction with DALs and auth.

**When to Use**:

- Dashboard page data fetching: correct DALs called with correct userId in parallel.
- No hardcoded DASHBOARD_PAGE alerts or pending request items passed to widgets.
- Auth: redirect when unauthenticated; header uses user.firstName or fallback.
- Per-widget failure: one DAL failure does not prevent the rest of the page from rendering.

**Framework**: Vitest with Next.js test utilities (or project-standard server component testing).

**Coverage Goals**: Critical paths for dashboard RSC and auth.

**Key Integration Tests**:

1. Dashboard RSC: with mocked getCurrentUser and DALs, assert all expected DAL methods are invoked in parallel with the same userId.
2. Dashboard RSC: assert no props derived from DASHBOARD_PAGE.alerts or DASHBOARD_PAGE.pendingRequests.items.
3. Dashboard RSC: when one DAL rejects, assert that widget receives empty/error and other widgets still get data (or their mocks still resolve).
4. Unauthenticated request to dashboard: assert redirect to sign-in (or equivalent).
5. Request detail URL helper: given rental request id, returns correct path (e.g. /dashboard/rentals/lending/request/[id]).

### End-to-End Tests

**Purpose**: Verify critical user flows in a real browser.

**When to Use**:

- Authenticated user opens `/dashboard`; summary cards and quick actions visible; no Reward Points.
- Quick action links navigate to garage, explore, mailbox (and optionally rentals, profile).
- Pending request row click navigates to request detail page (no Accept/Decline on dashboard).
- Optional: dashboard load time within 3 seconds.

**Framework**: Playwright or existing E2E framework in the project.

**Key E2E Scenarios**:

1. **Authenticated dashboard load**: Log in, go to `/dashboard`; see header, quick actions, summary cards; no Reward Points; at least one widget with real or empty data.
2. **Quick actions**: Click List a Tool, Browse Tools, View Messages; confirm navigation to correct routes.
3. **Pending requests**: As owner with pending request, open dashboard; click pending request; confirm navigation to request detail page.
4. **Unauthenticated**: Open `/dashboard` without session; confirm redirect to sign-in.

### Manual Testing Scenarios

**Purpose**: Cover edge cases and UX that are costly or brittle to automate.

**Scenarios**:

1. **New user**: No listings, rentals, messages, disputes; confirm empty states and quick actions; summary cards show zero.
2. **Renter-only**: No tools lent, no pending requests as owner; confirm Tools Lent and Pending Requests cards are zero or widgets hidden/empty.
3. **Owner-only**: No active rentals as borrower; confirm Active Rentals card zero or empty.
4. **Missing first name**: User with null/undefined firstName; confirm greeting uses fallback ("User" or similar).
5. **Responsive**: Dashboard at mobile, tablet, desktop widths; layout and links usable.
6. **Accessibility**: Keyboard-only navigation for quick actions and key links; screen reader announces key sections.
7. **Neighborhood widget**: With and without user/listings location data; confirm behavior matches design (e.g. platform-wide recent or hidden).
8. **Disputes/messaging unavailable**: If feature not implemented, confirm corresponding widget is hidden or shows stub empty state.

## Test Data Requirements

- **Users**: Authenticated user with userId; user with no listings/rentals/messages/disputes; user with only renter activity; user with only owner activity; user with null firstName.
- **Rentals**: Approved/active rental_requests with endDate in the past (overdue) and in the future (upcoming); pending lending requests for owner.
- **Listings**: User listings with pending_review; listings with rental count or reviews for top performing; recent listings for neighborhood.
- **Payments**: Payments with payeeId = userId and paidAt in current month for earnings.
- **Conversations/Messages**: User with unread messages; user with conversations for preview.
- **Disputes**: User with open disputes (if disputes feature exists).

## Test Environment

- **Auth**: Use test session or mock getCurrentUser returning a test user.
- **Database**: Use test DB or mocks; seed only what is needed for each test; avoid cross-test pollution.
- **No external APIs**: Dashboard does not call third-party APIs; no special env vars for dashboard logic.

## Success Criteria

Before considering the feature complete:

1. All unit tests for new DAL methods and dashboard helpers pass.
2. Unit tests for widget components pass (props, empty state, links; no Accept/Decline in Pending Requests widget).
3. Integration tests for dashboard RSC pass (parallel DAL usage, no hardcoded alerts/pending items, per-widget failure isolation, auth redirect).
4. E2E tests for authenticated load, quick actions, and pending request link pass.
5. Manual scenarios for new user, renter-only, owner-only, missing firstName, responsive, and accessibility are verified.
6. Reward Points section is absent; all dashboard data is from DAL (no fake data).
7. Dashboard load meets performance target (e.g. < 3s) or deviation is documented.

## Known Limitations

- E2E may be flaky if auth or DB setup varies; use stable test user and cleanup.
- Analytics charts may require visual or snapshot checks if not covered by data-only unit tests.
- Neighborhood widget behavior depends on location data availability; tests should cover both code paths (with/without location).
