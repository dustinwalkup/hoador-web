# User Dashboard Implementation Tasks

## Overview

This document breaks down the User Dashboard feature ([2-design.md](specs/dashboard/2-design.md)) into discrete, actionable tasks. Tasks are ordered by dependencies: types and DAL first, then helpers, then widgets, then page integration, then cleanup and tests. Each task is testable and sized for a single session. Only coding tasks are included.

## Task List

### 1. Dashboard types and constants

- [ ] 1.1 Add dashboard feature types
  - Create `src/features/dashboard/types.ts` (or `src/app/dashboard/types.ts`)
  - Define `DashboardSummary`, `OverdueItem`, `PendingRequestItem`, `ActivityFeedItem`, `ScheduleEntry`, `TopPerformingListing`, `DashboardTip` per design
  - Export types for use by page and widgets
  - _Requirements: 2-design Data Models_

- [ ] 1.2 Add request detail URL helper for lending requests
  - Add function or constant that builds the lending request detail URL given a rental request id (e.g. `/dashboard/rentals/lending/request/[id]` or equivalent existing route)
  - Use in PendingRequestsWidget and OverdueAlertsWidget for links
  - _Requirements: 3, 4_

### 2. Data access layer extensions

- [ ] 2.1 Implement RentalDAL.getOverdueItemsForUser
  - Add `getOverdueItemsForUser(userId: string)` to `src/dal/rentals.dal.ts`
  - Return items where user is borrower (endDate < today, status approved/active) or owner (lent out, return overdue)
  - Each item: id (rental/request), listingName, statusText (e.g. "X days late"), otherPartyName, linkTo URL
  - Use existing rental_requests (and rentals if needed) schema; avoid N+1
  - _Requirements: 3_

- [ ] 2.2 Implement PaymentDAL.getUserEarningsForMonth
  - Add `getUserEarningsForMonth(userId: string, start: Date, end: Date)` to `src/dal/payment.dal.ts`
  - Sum payments where payeeId = userId and payment date in [start, end] and status = succeeded
  - Return number (cents or decimal per existing convention)
  - _Requirements: 2_

- [ ] 2.3 Implement ListingDAL.getTopPerformingListings
  - Add `getTopPerformingListings(userId: string, limit: number)` to `src/dal/listing.dal.ts`
  - Query user's listings; order by rental count (from rental_requests) or average rating (reviews) desc; limit N
  - Return array with listingId, name, metricText (e.g. "5 rentals" or "4.8 stars")
  - _Requirements: 11_

- [ ] 2.4 Implement ListingDAL.getRecentListingsNearUser
  - Add `getRecentListingsNearUser(userId: string, limit: number)` to `src/dal/listing.dal.ts`
  - If user/listings have location data: return recent listings near user
  - Else: return platform-wide recent listings (or empty array and document; widget can hide)
  - Return minimal fields: id, name, linkTo (listing or explore URL)
  - _Requirements: 12_

### 3. Dashboard helpers (services or page-level)

- [ ] 3.1 Implement getUpcomingSchedule helper
  - Create helper (e.g. in `src/features/dashboard/lib/schedule.ts` or in page file) that accepts userId
  - Use RentalDAL.getBorrowedListings (current + upcoming) and getLendingRequestsByStatus("approved"/"active") for owner
  - Build list of events (return due, pickup due) for next 7 days; sort by date
  - Return `ScheduleEntry[]` with date, description, linkTo, type
  - _Requirements: 10_

- [ ] 3.2 Implement getDashboardActivityFeed helper
  - Create helper that accepts userId and limit (e.g. 10)
  - Composite: recent rental requests (as renter/owner), completed rentals, new/updated listings, reviews received (from RentalDAL, ListingDAL, ReviewDAL as needed)
  - Sort by date desc; take limit; return `ActivityFeedItem[]` with title, description, timestamp, relativeTime, linkTo
  - _Requirements: 9_

- [ ] 3.3 Implement getDashboardTips helper
  - Create helper that accepts userId
  - Rule-based: e.g. "Add photos" if any listing has no images, "Complete profile" if missing fields, "Set competitive price" for low-rent listings
  - Return 1–3 `DashboardTip[]` with text and optional linkTo
  - Use UserDAL/ListingDAL as needed; no external APIs
  - _Requirements: 13_

### 4. Analytics data for Mini-Analytics (Req 8)

- [ ] 4.1 Add rentals-per-period and inventory-usage data
  - Either extend RentalDAL/ListingDAL or add small helpers: (a) rentals per week (or month) for user as renter/owner; (b) inventory usage = active listings count / total user listings count
  - Ensure data is real (no fake chart data); support empty state when insufficient data
  - _Requirements: 8_

- [ ] 4.2 Add earnings trend data for Mini-Analytics
  - Use PaymentDAL.getUserEarningsForMonth for last 3–6 months (or add getUserEarningsByMonthRange) to drive earnings trend chart
  - _Requirements: 8_

### 5. Widget components (presentational; receive data via props)

- [ ] 5.1 QuickActionsBar component
  - Create component (RSC or client) with links: List a Tool (e.g. /dashboard/garage or /dashboard/listings), Browse Tools (explore), View Messages (mailbox); optional View Rentals, Profile
  - Use existing routes; accessible, clear labels
  - _Requirements: 6_

- [ ] 5.2 DashboardSummaryCards component
  - Create component accepting props: activeRentalsCount, toolsLentCount, pendingRequestsCount, earningsThisMonth
  - Render four cards; format numbers and currency; show loading/error state if passed
  - _Requirements: 2_

- [ ] 5.3 OverdueAlertsWidget component
  - Create component accepting `items: OverdueItem[]`; hide or empty state when length 0
  - Each row: listing name, status text, other party, link to rental/request detail
  - _Requirements: 3_

- [ ] 5.4 PendingRequestsWidget component
  - Create component accepting items (slice of pending requests) and totalCount; link each row to request detail URL only (no Accept/Decline buttons)
  - Display listing name, requester name, status text (e.g. "X days left to respond"); "View All" if totalCount > display limit
  - _Requirements: 4_

- [ ] 5.5 UnreadMessagesWidget component
  - Create component accepting unreadCount and recentConversations (from MessagesDAL)
  - Show count and preview of 2–3 conversations; link to mailbox or conversation
  - Empty state when no unread; optionally still show recent conversations
  - _Requirements: 7_

- [ ] 5.6 MiniAnalyticsSection component
  - Create component accepting analytics data (rentals per week, earnings trend, inventory usage %)
  - Render simple charts/numbers; show "Not enough data" when applicable
  - _Requirements: 8_

- [ ] 5.7 RecentActivityFeed component (dashboard version)
  - Create component accepting `items: ActivityFeedItem[]`; empty state when none
  - Each item: title, description, relativeTime, optional link
  - _Requirements: 9_

- [ ] 5.8 UpcomingScheduleWidget component
  - Create component accepting `entries: ScheduleEntry[]`; empty state when none
  - Each entry: date, description, optional link (rental detail, messaging)
  - _Requirements: 10_

- [ ] 5.9 TopPerformingToolsWidget component
  - Create component accepting `listings: TopPerformingListing[]`; hide or empty state when none
  - List 3–5 items with name, metricText, link to listing/garage
  - _Requirements: 11_

- [ ] 5.10 NeighborhoodActivityWidget component
  - Create component accepting recent nearby (or platform-wide) listings; empty state when none
  - List 3–5 with name, optional distance/area, link to listing/explore
  - _Requirements: 12_

- [ ] 5.11 TipsSuggestionsWidget component
  - Create component accepting `tips: DashboardTip[]`; hide or generic message when none
  - Show 1–3 tips with optional link
  - _Requirements: 13_

- [ ] 5.12 ActiveDisputesWidget component
  - Create component accepting active disputes list (and count); hide or "No active disputes" when none
  - Link to dispute detail or disputes list
  - _Requirements: 14_

### 6. PendingReviewWidget integration

- [ ] 6.1 Support server-injected count for PendingReviewWidget (optional)
  - Refactor `PendingReviewWidget` to accept optional props `count` and `listings` from server; when provided, use them instead of usePendingListingsCount to avoid double fetch
  - If not refactored, keep existing client hook (design allows either)
  - _Requirements: 5_

### 7. Dashboard page integration

- [ ] 7.1 Implement dashboard page RSC with parallel data fetch
  - In `src/app/dashboard/page.tsx`: getCurrentUser (redirect if unauthenticated)
  - Single Promise.all with: countBorrowedListings, countSharedListings, getLendingRequestsByStatus("pending"), getOverdueItemsForUser, getUserEarningsForMonth, getUserListingsByApprovalStatus("pending_review"), getUnreadMessageCount, getUserConversations (slice 3), getUpcomingSchedule, getTopPerformingListings, getRecentListingsNearUser, getDashboardActivityFeed, getDashboardTips, getUserDisputes (non-closed, limit 5)
  - Wrap each logical group in try/catch; on failure pass empty/zero or error flag to that widget so rest of page renders
  - _Requirements: 1, NFR Performance, NFR Reliability_

- [ ] 7.2 Compose dashboard layout and wire all widgets
  - Render PageHeader with greeting (user.firstName ?? "User"), description
  - Layout order: QuickActionsBar; alerts row (PendingReviewWidget, OverdueAlertsWidget); PendingRequestsWidget when pending.length > 0; DashboardSummaryCards; UnreadMessagesWidget; two-column Activity Feed + Upcoming Schedule; MiniAnalytics; TopPerformingTools, NeighborhoodActivity, Tips, ActiveDisputes
  - Pass fetched data into each widget; conditionally hide widgets when no data per requirements
  - _Requirements: 1_

- [ ] 7.3 Remove Reward Points and hardcoded dashboard content
  - Remove Reward Points card/section from dashboard entirely
  - Stop importing and using `DASHBOARD_PAGE` (alerts.items, pendingRequests.items) from `src/constants/dashboard.ts` for any dashboard UI
  - Either delete `src/constants/dashboard.ts` or remove only the alert/pending request arrays and use constants only for static copy (e.g. header description) if still needed
  - _Requirements: 1, 2 (no Reward Points)_

### 8. Testing

- [ ] 8.1 Unit tests for new DAL methods
  - Tests for RentalDAL.getOverdueItemsForUser, PaymentDAL.getUserEarningsForMonth, ListingDAL.getTopPerformingListings, ListingDAL.getRecentListingsNearUser with mocked DB
  - _Requirements: NFR, Design Testing Strategy_

- [ ] 8.2 Unit tests for dashboard helpers
  - Tests for getUpcomingSchedule, getDashboardActivityFeed, getDashboardTips with mocked DALs
  - _Requirements: Design Testing Strategy_

- [ ] 8.3 Integration test for dashboard page
  - With mocked getCurrentUser and DALs, assert dashboard RSC calls correct DALs in parallel with correct userId, and that no hardcoded alert/pending request data is passed to widgets
  - Assert PendingRequestsWidget receives request detail URLs and no Accept/Decline actions in props
  - _Requirements: 4, Design Testing Strategy_
