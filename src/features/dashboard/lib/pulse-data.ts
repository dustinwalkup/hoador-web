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
  findServiceBookingsByProviderCached,
} from "./cached-fetchers";
import { getUpcomingSchedule } from "./schedule";

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
    // As renter: items I'm currently borrowing + upcoming
    borrowedData,
    // As owner: items I'm actively lending out
    lendingActiveCount,
    inventoryUsage,
    serviceListings,
    // Owner role: rental listings the admin sent back for revisions
    rejectedRentalListings,
    disputes,
    actionableAlerts,
    // Upcoming schedule entries (all roles) — uses cached fetchers internally
    upcomingSchedule,
  ] = await Promise.all([
    // Owner role: requests sent TO me that I need to approve/decline
    safe(() => getLendingRequestsByStatusCached("pending", userId), []),
    // Provider role: bookings where I'm the provider and need to accept/decline
    safe(() => findServiceBookingsByProviderCached(userId), []),
    // Renter role: items I'm borrowing (current + upcoming)
    safe(() => getBorrowedListingsCached(userId), {
      currentRentals: [],
      upcomingRentals: [],
    }),
    // Owner role: items I'm actively lending
    safe(() => rentalDAL.countSharedListings(userId), 0),
    safe(() => listingDAL.getInventoryUsage(userId), {
      activeCount: 0,
      totalCount: 0,
      usagePercent: 0,
    }),
    safe(() => serviceListingDAL.findByProvider(userId), []),
    safe(
      () => listingDAL.getUserListingsByApprovalStatus("rejected", userId),
      [],
    ),
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
    // Reuse the same schedule logic the Coming Up widget uses; underlying
    // cached fetchers deduplicate any overlapping DB calls.
    safe(() => getUpcomingSchedule(userId), []),
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

  // Owner/Provider: listings the admin sent back for revisions
  const rentalListingRevisions = rejectedRentalListings.length;
  const serviceListingRevisions = serviceListings.filter(
    (sl) => sl.status === "denied",
  ).length;

  // ---------------------------------------------------------------------------
  // Active — items currently in progress for this user (both roles)
  // ---------------------------------------------------------------------------

  // Renter: items I'm currently borrowing
  const borrowing = borrowedData.currentRentals.length;
  // Owner: items I'm actively lending out
  const lending = lendingActiveCount;

  // ---------------------------------------------------------------------------
  // Upcoming — derived from the same schedule the Coming Up widget renders,
  // so counts are guaranteed to match.
  // ---------------------------------------------------------------------------

  const upcomingRentals = upcomingSchedule.filter(
    (e) => e.type === "pickup" || e.type === "return",
  ).length;
  const upcomingServices = upcomingSchedule.filter(
    (e) => e.type === "service",
  ).length;

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
      rentalListingRevisions,
      serviceListingRevisions,
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
