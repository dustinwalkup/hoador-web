# User Dashboard - Requirements Document

## Introduction

The User Dashboard is the main landing page for authenticated users at `/dashboard`. It provides an at-a-glance view of rentals, listings, pending actions, earnings, and activity. The dashboard is currently implemented with hardcoded and fake data; this feature replaces all mock content with real data from the application's data access layer (DAL) and adds new widgets to improve discoverability and usefulness.

The scope includes: (1) wiring all existing dashboard sections to real data via RentalDAL, ListingDAL, PaymentDAL, and related DALs; (2) removing the Reward Points section (not a planned feature); (3) adding six new sections—Quick Actions Bar, Unread Messages Widget, Top Performing Tools, Neighborhood Activity, Tips & Suggestions, and Active Disputes Summary. The dashboard remains a React Server Component with data fetched server-side; no external APIs are introduced. All hardcoded constants in `src/constants/dashboard.ts` will be removed in favor of dynamic data.

## Requirements

### Requirement 1: Dashboard Page Layout and Navigation

**User Story:** As an authenticated user, I want a single dashboard page that shows my key information and actions, so that I can quickly see what needs attention and navigate to the right place.

#### Acceptance Criteria

1. The system SHALL provide a dashboard page at `/dashboard` accessible only to authenticated users
2. WHEN an unauthenticated user navigates to `/dashboard` THEN the system SHALL redirect to sign-in or appropriate auth flow
3. WHEN the dashboard loads THEN the system SHALL display a page header with a personalized greeting using the user's first name
4. The dashboard SHALL display the following sections in a logical order: header, alerts/action items, summary statistics, quick actions, widgets (alerts, pending requests, pending review, unread messages, analytics, activity feed, upcoming schedule, top tools, neighborhood activity, tips, disputes)
5. The system SHALL use a responsive layout that works on mobile, tablet, and desktop
6. WHERE a section has no data THEN the system SHALL display an appropriate empty state or hide the section as specified per requirement
7. The dashboard SHALL maintain consistent styling with the rest of the Hoador application
8. All links and buttons on the dashboard SHALL navigate to existing application routes (e.g., garage, explore, mailbox, rentals, profile)
9. The system SHALL NOT display a Reward Points section or any reward-points-related content

### Requirement 2: Summary Statistics Cards

**User Story:** As a user, I want to see key counts and earnings at a glance, so that I know how many active rentals I have, how many tools I'm lending, pending request count, and my earnings for the month.

#### Acceptance Criteria

1. The system SHALL display summary statistic cards for: Active Rentals, Tools Lent, Pending Requests, and This Month Earnings
2. The Active Rentals card SHALL display the count of rentals the user is currently borrowing, derived from the data access layer (e.g., RentalDAL.countBorrowedListings or equivalent)
3. The Tools Lent card SHALL display the count of tools the user currently has lent out, derived from the data access layer (e.g., RentalDAL.countSharedListings or equivalent)
4. The Pending Requests card SHALL display the count of rental requests awaiting the user's response as owner, derived from the data access layer (e.g., pending lending requests count)
5. The This Month Earnings card SHALL display the user's earnings for the current calendar month as owner, derived from the data access layer (e.g., PaymentDAL.getUserEarnings with month filter)
6. WHEN summary data is loading THEN the system SHALL show a loading state; WHEN data is unavailable due to error THEN the system SHALL show an error or fallback state without breaking the page
7. Summary cards SHALL display numeric values in a clear, readable format (e.g., whole numbers for counts, currency format for earnings)
8. WHERE applicable, summary cards MAY display a short contextual line (e.g., "1 due tomorrow", "2 urgent") using real data when such data is available from the DAL
9. The system SHALL NOT display a Reward Points card or any reward-points metric

### Requirement 3: Overdue Alerts Widget

**User Story:** As a user, I want to see overdue items that need my attention (late returns as borrower or lender), so that I can take action and avoid disputes or confusion.

#### Acceptance Criteria

1. The system SHALL display an Overdue Alerts widget (card) when the user has overdue items
2. Overdue items SHALL be determined from the data access layer: rentals where the return date has passed and the rental is still active (user as borrower or as owner expecting return)
3. Each overdue alert SHALL display: listing/tool name, status (e.g., "X days late"), the other party (renter or owner name as appropriate), and an actionable control (e.g., "Resolve" or link to rental)
4. WHEN the user has no overdue items THEN the system SHALL hide the Overdue Alerts widget or show an empty state indicating no overdue items
5. WHEN the user has overdue items THEN the widget SHALL show a count (e.g., "N items") and list at least the first few items with option to view all if applicable
6. Actions in the overdue alerts widget SHALL link to the correct rental or rental request detail page
7. Overdue determination SHALL use rental end date (and current date) from the database; the system SHALL not use hardcoded alert data

### Requirement 4: Pending Requests and Approvals Widget

**User Story:** As a tool owner, I want to see rental requests waiting for my response, so that I can open them and approve or decline in a timely manner.

#### Acceptance Criteria

1. The system SHALL display a Pending Requests widget when the user has pending lending requests (rental requests where the current user is the listing owner and status is pending)
2. Pending requests SHALL be fetched from the data access layer (e.g., RentalDAL.getLendingRequestsByStatus("pending", userId))
3. Each pending request entry SHALL display: listing/tool name, requester name (or identifier), status text (e.g., "X days left to respond"), and a link to the request detail page
4. WHEN the user clicks a pending request entry THEN the system SHALL navigate to the rental request detail page where the user may approve or decline; the widget SHALL NOT provide inline Accept and Decline actions
5. WHEN the user has no pending requests THEN the system SHALL hide the widget or show an empty state
6. WHEN the user has more than a display limit (e.g., 2) THEN the widget SHALL show a "View All Requests" (or equivalent) link that navigates to the lending/requests section of the dashboard or rentals area
7. The system SHALL display the count of pending requests in the widget header (e.g., "N requests")

### Requirement 5: Pending Review Widget

**User Story:** As a user, I want to see when I have listings pending review (e.g., after submission for publication), so that I know when my listings are in a review state.

#### Acceptance Criteria

1. The system SHALL display a Pending Review widget when the user has listings in a pending-review state
2. Pending review listings SHALL be determined from the data access layer (e.g., ListingDAL.getUserListings with status filter for pending_review or equivalent)
3. The widget SHALL display the count of listings pending review and MAY list them or link to the garage/listings view filtered by that status
4. WHEN the user has no listings pending review THEN the widget SHALL be hidden or show an empty state
5. The widget SHALL use the same data source and behavior as the existing PendingReviewWidget implementation where one exists; the requirements SHALL be satisfied by real data only
6. WHEN a user clicks through to view pending review items THEN the system SHALL navigate to the appropriate listings or garage page where the user can see those listings

### Requirement 6: Quick Actions Bar

**User Story:** As a user, I want prominent shortcuts for common tasks (list a tool, browse tools, view messages), so that I can start an action without hunting through navigation.

#### Acceptance Criteria

1. The system SHALL display a Quick Actions bar (or row of action buttons/links) on the dashboard
2. Quick actions SHALL include at least: List a Tool (or Add Listing), Browse Tools (or Explore), and View Messages (Mailbox)
3. Each quick action SHALL navigate to the correct application route (e.g., dashboard/listings or garage for listing; explore for browse; mailbox for messages)
4. Quick actions SHALL be visible to all authenticated users regardless of role (renter, owner, or both)
5. The system MAY include additional quick actions (e.g., View Rentals, Profile) as long as they link to existing routes
6. Quick actions SHALL be presented in a clear, tappable/clickable format (e.g., buttons or card-style links) and SHALL be accessible (keyboard and screen reader)
7. The Quick Actions bar SHALL be placed in a prominent position on the dashboard (e.g., near the top below the header or after key alerts)

### Requirement 7: Unread Messages Widget

**User Story:** As a user, I want to see when I have unread messages and a preview of recent conversations, so that I can respond to renters or owners quickly.

#### Acceptance Criteria

1. The system SHALL display an Unread Messages widget on the dashboard
2. Unread message count and conversation preview data SHALL be sourced from the application's conversation/messaging data (e.g., ConversationDAL or equivalent) for the current user
3. The widget SHALL display the total count of unread messages (or conversations with unread messages) when greater than zero
4. The widget SHALL display a short preview of recent conversations (e.g., last 2–3) with sender and last message or timestamp
5. WHEN the user has no unread messages THEN the widget MAY still be shown with zero count and recent conversations, or a simple "No new messages" state
6. Clicking the widget or a conversation SHALL navigate to the mailbox or the specific conversation
7. The system SHALL not use hardcoded or fake message data; all counts and previews SHALL come from the data access layer

### Requirement 8: Mini-Analytics Section

**User Story:** As a user, I want to see a simple overview of my rental activity and earnings trends, so that I can understand how my listings or rentals are performing.

#### Acceptance Criteria

1. The system SHALL display a Mini-Analytics section (e.g., "Activity Overview") with at least one of: rentals-over-time (e.g., per week), earnings trend, or inventory-usage metric
2. Data for charts and metrics SHALL be derived from the data access layer (RentalDAL, PaymentDAL, ListingDAL) using aggregations over time or counts; the system SHALL not use hardcoded chart data
3. WHERE the system displays "Rentals per Week" (or similar) THEN the values SHALL reflect actual rental activity for the user (as renter or owner, as appropriate) for the displayed period
4. WHERE the system displays an earnings trend THEN the values SHALL reflect actual earnings data from payments (e.g., PaymentDAL.getUserEarnings or equivalent with time range)
5. WHERE the system displays "Inventory Usage" (e.g., percentage of tools active) THEN it SHALL be computed from the user's listings and their active vs inactive/archived status
6. WHEN insufficient data exists for a chart THEN the system SHALL show an empty state or "Not enough data" rather than fake values
7. The section SHALL be responsive and readable on mobile and desktop
8. The system MAY add or remove specific chart types in a later design phase as long as all displayed data is real

### Requirement 9: Recent Activity Feed

**User Story:** As a user, I want to see a feed of recent activity (rentals, requests, reviews, listings, messages), so that I stay informed without opening each section.

#### Acceptance Criteria

1. The system SHALL display a Recent Activity feed on the dashboard
2. Activity items SHALL be derived from real data: recent rentals (as renter or owner), rental requests (e.g., new, approved, declined), reviews received, new or updated listings, and optionally message activity, as supported by the DAL
3. Each activity item SHALL display: a short title, optional description, timestamp (e.g., "2 hours ago", "Yesterday"), and MAY include an actionable link
4. Activities SHALL be ordered by recency (most recent first) and limited to a reasonable number (e.g., 5–10 items)
5. WHEN no activity exists THEN the system SHALL display an empty state (e.g., "No recent activity")
6. The system SHALL not use a hardcoded list of fake activities; the feed SHALL be built from a composite query or multiple DAL calls that return real events
7. Clicking an activity item MAY navigate to the related rental, listing, review, or conversation as appropriate

### Requirement 10: Upcoming Schedule Widget

**User Story:** As a user, I want to see my upcoming rental dates (returns, pickups) for the next several days, so that I can plan and send reminders if needed.

#### Acceptance Criteria

1. The system SHALL display an Upcoming Schedule widget with upcoming rental-related events (e.g., return due, pickup due) for the next 7 days (or configurable window)
2. Schedule data SHALL be fetched from the data access layer: as borrower (e.g., RentalDAL.getBorrowedListings or equivalent for current/upcoming) and as owner (e.g., approved rentals with upcoming start/end dates)
3. Each schedule entry SHALL display: date, short description (e.g., "Return Pressure Washer to John D.", "Emily K. returns Drill Set"), and MAY include actions (e.g., Directions, Request Extension, Send Reminder) that link to existing rental-detail or messaging flows
4. WHEN the user has no upcoming events in the window THEN the widget SHALL show an empty state or "Nothing scheduled"
5. A "View Full Calendar" (or equivalent) link MAY link to a rentals calendar view or list view if such a page exists
6. The system SHALL not use hardcoded dates or fake schedule items; all entries SHALL come from real rental/rental-request data

### Requirement 11: Top Performing Tools Widget

**User Story:** As a tool owner, I want to see which of my listed tools are performing best (most rented or highest rated), so that I can learn what works and promote similar listings.

#### Acceptance Criteria

1. The system SHALL display a Top Performing Tools widget on the dashboard when the user has listings that have rental or rating data
2. "Top performing" SHALL be defined by one or more of: most rentals (count), highest average rating, or recent rental frequency; the definition SHALL be implementable using the existing DAL (listings, rentals, reviews)
3. The widget SHALL list a small number of top tools (e.g., 3–5) with at least: listing name, and the metric used (e.g., "N rentals", "X.X stars")
4. WHEN the user has no listings or no rental/rating data THEN the widget SHALL be hidden or show an empty state (e.g., "List tools to see performance")
5. Clicking a tool SHALL navigate to the listing detail or garage listing management view
6. Data SHALL be sourced from the data access layer; the system SHALL not use hardcoded or fake top-tool lists

### Requirement 12: Neighborhood Activity Widget

**User Story:** As a user, I want to see recently listed tools near my location, so that I can discover what's new in my area.

#### Acceptance Criteria

1. The system SHALL display a Neighborhood Activity widget showing recently listed tools near the user
2. "Recently listed" and "near" SHALL be defined using the application's listing and location data (e.g., listing creation/update date and geographic data in the listings or user profile)
3. The widget SHALL display a limited list (e.g., 3–5) of recent nearby listings with at least: listing name, optional distance or area, and link to listing detail or explore
4. WHERE the application does not store user or listing location THEN the widget MAY be hidden or show a generic "Recent listings" (e.g., platform-wide recent) until location support exists; behavior SHALL be documented
5. Data SHALL be sourced from the data access layer (ListingDAL or search with location/recency); the system SHALL not use hardcoded neighborhood items
6. WHEN there are no recent nearby listings THEN the widget SHALL show an empty state

### Requirement 13: Tips and Suggestions Widget

**User Story:** As a user, I want to see contextual tips to improve my listings, pricing, or activity, so that I can get more rentals and use the platform effectively.

#### Acceptance Criteria

1. The system SHALL display a Tips and Suggestions widget on the dashboard
2. Tips SHALL be rule-based (e.g., "Add photos to listings with no photos", "Complete your profile", "Set competitive pricing for X") and SHALL be generated from real user and listing data (e.g., profile completeness, listing count, photo count, pricing)
3. Tips SHALL be relevant to the current user state (e.g., new user vs active lister) and SHALL not be random or hardcoded static text unrelated to data
4. The widget MAY show 1–3 tips at a time; clicking a tip MAY link to the relevant page (e.g., profile, garage, listing edit)
5. WHEN no applicable tips exist THEN the widget MAY be hidden or show a generic positive message
6. For MVP, the system SHALL not require AI or external services; tips SHALL be derived from simple rules and existing DAL data

### Requirement 14: Active Disputes Summary Widget

**User Story:** As a user, I want to see when I have open disputes (as renter or provider), so that I can track their status and respond to evidence or resolution.

#### Acceptance Criteria

1. The system SHALL display an Active Disputes Summary widget when the user has one or more disputes in a non-closed state (e.g., OPEN, UNDER_REVIEW, EVIDENCE_REQUESTED)
2. Dispute data SHALL be sourced from the application's dispute data access layer (e.g., DisputeDAL or equivalent) filtered by current user as renter or provider
3. The widget SHALL display the count of active disputes and MAY list them with: dispute ID or rental reference, status, and link to dispute detail
4. WHEN the user has no active disputes THEN the widget SHALL be hidden or show "No active disputes"
5. Clicking the widget or a dispute SHALL navigate to the dispute detail or disputes list page
6. The system SHALL not use hardcoded dispute data; all data SHALL come from the DAL

## Non-Functional Requirements

### Performance

1. The dashboard page SHALL load within 3 seconds on a typical connection for authenticated users
2. Data for all widgets SHALL be fetched server-side; the system SHOULD minimize sequential round-trips (e.g., parallel DAL calls or batched queries) where possible
3. WHERE a widget's data is expensive to compute THEN the system MAY defer or cache it within the constraints of the architecture; the dashboard SHALL still show loading or empty states rather than blocking the whole page
4. The system SHALL avoid N+1 queries when loading dashboard data; aggregation and list queries SHALL be scoped to what each widget needs

### Reliability

1. WHEN a single widget's data fetch fails THEN the system SHALL not break the entire dashboard; that widget SHALL show an error or empty state and other widgets SHALL still render
2. The dashboard SHALL handle missing or null user profile data (e.g., first name) with a fallback (e.g., "User" or "there")
3. WHERE the DAL returns empty results THEN each widget SHALL behave as specified (hide or show empty state) without throwing

### Security

1. The dashboard SHALL only be accessible to authenticated users; all data SHALL be scoped to the current user (no cross-user data)
2. All data displayed on the dashboard SHALL be fetched via server-side DAL methods that enforce ownership and authorization
3. The system SHALL not expose internal IDs or sensitive data in the UI beyond what is necessary for links and labels

### Usability

1. The dashboard SHALL be responsive and usable on mobile and desktop
2. Loading states SHALL be shown where data is not yet available; empty states SHALL be clear and actionable where applicable
3. Labels and copy SHALL be consistent with the rest of the application (e.g., existing dashboard constants may be replaced but terminology SHALL remain consistent)
4. Interactive elements (buttons, links) SHALL have clear affordances and SHALL navigate or submit as expected

## Assumptions

1. The existing DAL methods (RentalDAL, ListingDAL, PaymentDAL, ConversationDAL, DisputeDAL, etc.) support the queries needed for each widget; where a method does not exist, the design phase will specify new DAL methods or wrappers.
2. Authentication and session (e.g., getCurrentUser()) are available and used to scope all dashboard data to the current user.
3. The dashboard is implemented as a React Server Component with server-side data fetching; client components are used only where interactivity is required.
4. No external third-party APIs (e.g., weather) are required for this feature; neighborhood activity uses existing location data if available.
5. Disputes feature and DisputeDAL exist and expose at least listing/count of active disputes by user.
6. Messaging/conversation feature and ConversationDAL (or equivalent) exist and expose unread counts and recent conversations.
7. Reward Points are out of scope and will not be implemented; the current Reward Points UI will be removed.

## Constraints

1. All dashboard data SHALL be sourced from the existing application database and DAL; no new external APIs for this feature.
2. The dashboard SHALL follow the application's architecture: server-side data fetching in RSC, React Query for mutations, existing routing structure.
3. Hardcoded dashboard content in `src/constants/dashboard.ts` (alerts, pending requests, etc.) SHALL be removed or replaced by dynamic data as part of this feature's implementation (design/tasks will specify the removal).
4. Widget order and layout may be refined in design; the requirements document does not prescribe exact pixel layout, only presence and behavior of each section.

## Edge Cases

1. **New user with no data**: User has no listings, no rentals, no messages, no disputes. Dashboard SHALL show empty states and quick actions; summary cards SHALL show zero or "—" as appropriate.
2. **User with only renter activity**: Tools Lent and Pending Requests (as owner) SHALL show zero or empty; Active Rentals and borrower-side widgets SHALL show data.
3. **User with only owner activity**: Active Rentals (as borrower) SHALL show zero; Tools Lent, Pending Requests, Top Performing Tools SHALL show data where applicable.
4. **Missing profile first name**: Greeting SHALL use a fallback (e.g., "Welcome back, User!" or "Welcome back!").
5. **DAL returns error for one widget**: That widget SHALL show error or empty state; other widgets SHALL still load.
6. **No location data for neighborhood**: Widget SHALL be hidden or show platform-wide recent listings as documented in Requirement 12.
7. **Disputes or messaging not yet implemented**: Corresponding widgets SHALL be hidden or show a stub empty state until the underlying feature is available; requirements SHALL be satisfied when those features exist.

## Out of Scope (Future Enhancements)

1. **Reward Points**: Any reward or loyalty points system and its dashboard display.
2. **Weather widget**: Local weather for outdoor tools; deferred.
3. **Customizable dashboard**: User-configurable widget order, visibility, or layout.
4. **Real-time updates**: Live refresh (e.g., WebSocket) for dashboard data; initial implementation is request/load-based.
5. **Export or share dashboard**: PDF export or sharing of dashboard summary.
6. **AI-generated tips**: Tips beyond rule-based suggestions (e.g., ML-based recommendations).
7. **Third-party integrations**: Any new external APIs (e.g., calendar sync, weather) for the dashboard.

## Success Criteria

1. The dashboard at `/dashboard` displays only real data for all sections; no hardcoded alerts, pending requests, summary numbers, activity items, or schedule entries.
2. Summary cards show correct Active Rentals, Tools Lent, Pending Requests, and This Month Earnings from the DAL.
3. Overdue Alerts and Pending Requests widgets show real items and working Accept/Decline (or equivalent) actions where applicable.
4. Pending Review, Unread Messages, Top Performing Tools, Neighborhood Activity (or documented fallback), Tips & Suggestions, and Active Disputes widgets are present and backed by real data when the underlying features exist.
5. Quick Actions bar is visible and navigates to List a Tool, Browse Tools, and View Messages (and any other agreed actions).
6. Recent Activity feed and Upcoming Schedule are populated from real rental and activity data.
7. Mini-Analytics section uses real aggregations from RentalDAL/PaymentDAL/ListingDAL (or equivalent); no fake chart data.
8. Reward Points section is removed from the dashboard.
9. Dashboard remains responsive, accessible, and does not break when individual widgets fail or have no data.
10. All links and buttons on the dashboard lead to correct, existing application routes.
