/**
 * Dashboard feature types for the User Dashboard at /dashboard.
 * Used by the dashboard RSC page and presentational widgets.
 * @see specs/dashboard/2-design.md Data Models
 */

/** Summary counts and earnings for the dashboard summary cards. */
export interface DashboardSummary {
  activeRentalsCount: number;
  toolsLentCount: number;
  pendingRequestsCount: number;
  /** Cents or decimal; format in UI. */
  earningsThisMonth: number;
}

/** Single overdue item (as borrower or lender) for OverdueAlertsWidget. */
export interface OverdueItem {
  /** Rental or rental request id. */
  id: string;
  listingName: string;
  /** e.g. "3 days late". */
  statusText: string;
  otherPartyName: string;
  /** Rental or request detail URL. */
  linkTo: string;
}

/** Pending lending request row for PendingRequestsWidget. */
export interface PendingRequestItem {
  id: string;
  listingName: string;
  requesterName: string;
  /** e.g. "X days left to respond". */
  statusText: string;
  requestDetailUrl: string;
}

/** Single activity feed entry for RecentActivityFeed. */
export interface ActivityFeedItem {
  id: string;
  title: string;
  description?: string;
  timestamp: Date;
  /** e.g. "2 hours ago". */
  relativeTime: string;
  linkTo?: string;
  icon?: string;
}

/** User role for an upcoming schedule row (rentals vs services). */
export type ScheduleEntryRole = "renter" | "owner" | "client" | "provider";

/** Upcoming schedule entry for UpcomingScheduleWidget. */
export interface ScheduleEntry {
  /** Stable key (rental id + event kind + role, or service booking id). */
  id: string;
  date: Date;
  description: string;
  /** Tool name (rental) or service listing title; shown under the main line. */
  subtitle?: string;
  linkTo?: string;
  type: "return" | "pickup" | "service";
  role: ScheduleEntryRole;
  /** True when the owner delivers the item instead of renter picking up. */
  deliveryRequested?: boolean;
  /** True when delivery includes owner-provided setup (only when deliveryRequested). */
  setupRequested?: boolean;
}

/** Top performing listing for TopPerformingToolsWidget. */
export interface TopPerformingListing {
  listingId: string;
  name: string;
  /** e.g. "5 rentals" or "4.8 stars". */
  metricText: string;
}

/** Rule-based tip for TipsSuggestionsWidget. */
export interface DashboardTip {
  text: string;
  linkTo?: string;
}

/** Rentals per month for MiniAnalyticsSection. */
export interface RentalsPerMonthItem {
  year: number;
  month: number;
  monthLabel: string;
  renterCount: number;
  ownerCount: number;
}

/** Earnings per month for MiniAnalyticsSection. */
export interface EarningsPerMonthItem {
  year: number;
  month: number;
  monthLabel: string;
  amount: number;
}

/** Inventory usage for MiniAnalyticsSection. */
export interface InventoryUsage {
  activeCount: number;
  totalCount: number;
  usagePercent: number;
}

/** Analytics payload for MiniAnalyticsSection. */
export interface DashboardAnalytics {
  rentalsPerMonth: RentalsPerMonthItem[];
  earningsByMonth: EarningsPerMonthItem[];
  inventoryUsage: InventoryUsage;
}

/** Recent listing for NeighborhoodActivityWidget. */
export interface NeighborhoodListing {
  id: string;
  name: string;
  linkTo: string;
}
