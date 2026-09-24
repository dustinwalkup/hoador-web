/**
 * Server-side data aggregation for DashboardPulse.
 * Fetches all counts needed for the pulse collapsed/expanded views.
 */

import {
  rentalDAL,
  listingDAL,
  serviceListingDAL,
  disputeDAL,
  neighborhoodNeedsDAL,
  communityDAL,
} from "@/dal";
import type {
  DashboardPulseData,
  ScheduleEntry,
} from "@/features/dashboard/types";
import {
  getBorrowedListingsCached,
  getLendingRequestsByStatusCached,
  getActionableAlertsCached,
  findServiceBookingsByProviderCached,
} from "./cached-fetchers";
import { getUpcomingSchedule } from "./schedule";

type MaybePromise<T> = T | Promise<T>;

/**
 * Sources the dashboard summary route also reads for its own keys. Passed in
 * (as values or in-flight promises), they're used instead of a second query;
 * `cache()` can't dedupe them in a route handler. The caller owns failure
 * handling for what it passes: a passed promise must not reject.
 */
export interface DashboardPulseSources {
  pendingLendingRequests: MaybePromise<
    Awaited<ReturnType<typeof getLendingRequestsByStatusCached>>
  >;
  serviceBookingsAsProvider: MaybePromise<
    Awaited<ReturnType<typeof findServiceBookingsByProviderCached>>
  >;
  borrowed: MaybePromise<Awaited<ReturnType<typeof getBorrowedListingsCached>>>;
  serviceListings: MaybePromise<
    Awaited<ReturnType<typeof serviceListingDAL.findByProvider>>
  >;
  actionableAlerts: MaybePromise<
    Awaited<ReturnType<typeof getActionableAlertsCached>>
  >;
  upcomingSchedule: MaybePromise<ScheduleEntry[]>;
}

/**
 * Aggregate all pulse data for the given user in parallel.
 * Each sub-fetch is individually wrapped so a single failure
 * doesn't take down the whole pulse widget.
 *
 * @param prefetched - Shared sources the caller already fetched; omitted, they're fetched here
 */
export async function getDashboardPulseData(
  userId: string,
  prefetched?: DashboardPulseSources,
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
    // Upcoming schedule entries (all roles)
    upcomingSchedule,
  ] = await Promise.all([
    // Owner role: requests sent TO me that I need to approve/decline
    prefetched?.pendingLendingRequests ??
      safe(() => getLendingRequestsByStatusCached("pending", userId), []),
    // Provider role: bookings where I'm the provider and need to accept/decline
    prefetched?.serviceBookingsAsProvider ??
      safe(() => findServiceBookingsByProviderCached(userId), []),
    // Renter role: items I'm borrowing (current + upcoming)
    prefetched?.borrowed ??
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
    prefetched?.serviceListings ??
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
    prefetched?.actionableAlerts ??
      safe(() => getActionableAlertsCached(userId), []),
    // Reuse the same schedule logic the Coming Up widget uses. In an RSC
    // render the cached fetchers dedupe its overlapping DB calls; the summary
    // route passes the schedule in instead.
    prefetched?.upcomingSchedule ?? safe(() => getUpcomingSchedule(userId), []),
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

  // ---------------------------------------------------------------------------
  // Needs — open neighborhood needs visible to this user
  // ---------------------------------------------------------------------------

  const visibleCommunityIds = await safe(
    () => communityDAL.getVisibleCommunityIds(userId),
    [],
  );
  const openNeeds = await safe(
    () => neighborhoodNeedsDAL.countOpenVisibleNeeds(visibleCommunityIds),
    0,
  );

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
    needs: {
      open: openNeeds,
    },
  };
}
