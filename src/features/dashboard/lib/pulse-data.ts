/**
 * Server-side data aggregation for DashboardPulse.
 * Fetches all counts needed for the pulse collapsed/expanded views.
 */

import { rentalDAL, listingDAL, serviceListingDAL, disputeDAL } from "@/dal";
import type { DashboardPulseData } from "@/features/dashboard/types";
import {
  getBorrowedListingsCached,
  getLendingRequestsByStatusCached,
  getActionableAlertsCached,
  findServiceBookingsByRequesterCached,
  findServiceBookingsByProviderCached,
} from "./cached-fetchers";

/**
 * Aggregate all pulse data for the given user in parallel.
 * Each sub-fetch is individually wrapped so a single failure
 * doesn't take down the whole pulse widget.
 */
export async function getDashboardPulseData(
  userId: string,
): Promise<DashboardPulseData> {
  const safe = <T>(fn: () => Promise<T>, fallback: T): Promise<T> =>
    fn().catch((err) => {
      console.error("[DashboardPulse] fetch failed:", err);
      return fallback;
    });

  const [
    // As owner: incoming rental requests waiting for MY approval
    pendingLendingRequests,
    // As provider: incoming service bookings waiting for MY confirmation
    serviceBookingsAsProvider,
    // As requester: my outgoing service bookings (for active/upcoming counts)
    serviceBookingsAsRequester,
    // As renter: items I'm currently borrowing + upcoming
    borrowedData,
    // As owner: approved rentals coming up that I need to prepare
    lendingApproved,
    // As owner: items I'm actively lending out
    lendingActiveCount,
    inventoryUsage,
    serviceListings,
    disputes,
    actionableAlerts,
  ] = await Promise.all([
    // Owner role: requests sent TO me that I need to approve/decline
    safe(() => getLendingRequestsByStatusCached("pending", userId), []),
    // Provider role: bookings where I'm the provider and need to accept/decline
    safe(() => findServiceBookingsByProviderCached(userId), []),
    // Requester role: my outgoing bookings (for active/upcoming, not action-needed)
    safe(() => findServiceBookingsByRequesterCached(userId), []),
    // Renter role: items I'm borrowing (current + upcoming)
    safe(() => getBorrowedListingsCached(userId), {
      currentRentals: [],
      upcomingRentals: [],
    }),
    // Owner role: approved rentals I need to prepare for
    safe(() => getLendingRequestsByStatusCached("approved", userId), []),
    // Owner role: items I'm actively lending
    safe(() => rentalDAL.countSharedListings(userId), 0),
    safe(() => listingDAL.getInventoryUsage(userId), {
      activeCount: 0,
      totalCount: 0,
      usagePercent: 0,
    }),
    safe(() => serviceListingDAL.findByProvider(userId), []),
    safe(() => disputeDAL.getUserDisputes(userId, { limit: 100 }), {
      data: [],
      pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
    safe(() => getActionableAlertsCached(userId), []),
  ]);

  // ---------------------------------------------------------------------------
  // Action Needed — only items that require THIS user's action
  // ---------------------------------------------------------------------------

  // Owner: incoming rental requests I need to approve/decline
  const pendingRequests = pendingLendingRequests.length;

  // Both roles: overdue items — derived from actionableAlerts (alertType
  // "overdue_return") instead of a separate getOverdueItemsForUser call,
  // which queries the same rows.
  const overdueReturns = actionableAlerts.filter(
    (a) => a.alertType === "overdue_return",
  ).length;

  // Both roles: stale service bookings that need completion follow-up
  const overdueServices = actionableAlerts.filter(
    (a) => a.alertType === "service_not_completed",
  ).length;

  // Provider: service bookings I need to accept/decline
  const unconfirmedServices = serviceBookingsAsProvider.filter(
    (b) => b.status === "pending",
  ).length;

  const activeDisputes = disputes.data.filter(
    (d) => d.status !== "closed",
  ).length;

  // ---------------------------------------------------------------------------
  // Active — items currently in progress for this user (both roles)
  // ---------------------------------------------------------------------------

  // Renter: items I'm currently borrowing
  const borrowing = borrowedData.currentRentals.length;
  // Owner: items I'm actively lending out
  const lending = lendingActiveCount;

  // ---------------------------------------------------------------------------
  // Upcoming — scheduled items for this user (both roles), constrained to a
  // 7-day window so these counts stay consistent with `getUpcomingSchedule`,
  // which renders the "Coming up" calendar over the same window.
  // ---------------------------------------------------------------------------

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endWindow = new Date(today);
  endWindow.setDate(endWindow.getDate() + 7);
  endWindow.setHours(23, 59, 59, 999);

  const inWindow = (raw: Date | string): boolean => {
    const d = raw instanceof Date ? new Date(raw) : new Date(String(raw));
    d.setHours(0, 0, 0, 0);
    return d >= today && d <= endWindow;
  };

  // Renter: approved rentals I'll be picking up soon
  // Owner: approved rentals I need to prepare for
  const upcomingRentals =
    borrowedData.upcomingRentals.filter((r) => inWindow(r.startDate)).length +
    lendingApproved.filter((r) => inWindow(r.startDate)).length;

  // Both roles: accepted services with a proposed date inside the window.
  // Service bookings store `proposedDate` as a date-only string; parse with an
  // explicit midnight to avoid timezone drift shifting the day.
  const allAcceptedServices = [
    ...serviceBookingsAsProvider.filter((b) => b.status === "accepted"),
    ...serviceBookingsAsRequester.filter((b) => b.status === "accepted"),
  ];
  const upcomingServices = allAcceptedServices.filter((b) => {
    const proposed = new Date(
      `${String(b.proposedDate).slice(0, 10)}T00:00:00`,
    );
    return inWindow(proposed);
  }).length;

  // Pickups/returns due today (from actionable alerts — already user-scoped)
  const pickupsToday = actionableAlerts.filter(
    (a) => a.alertType === "end_today",
  ).length;

  // ---------------------------------------------------------------------------
  // Listed — items this user owns/provides
  // ---------------------------------------------------------------------------

  const activeToolListings = inventoryUsage.activeCount;
  const activeServiceListings = serviceListings.filter(
    (sl) => sl.status === "active",
  ).length;

  return {
    action: {
      pendingRequests,
      overdueReturns,
      overdueServices,
      unconfirmedServices,
    },
    active: {
      borrowing,
      lending,
      disputes: activeDisputes,
    },
    upcoming: {
      rentals: upcomingRentals,
      services: upcomingServices,
      pickupsToday: pickupsToday > 0 ? pickupsToday : undefined,
    },
    listed: {
      tools: activeToolListings,
      services: activeServiceListings,
    },
  };
}
