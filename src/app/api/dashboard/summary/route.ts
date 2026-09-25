import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import {
  getDashboardPulseData,
  getUpcomingSchedule,
  getActionableAlertsCached,
  getDashboardActivityFeed,
  getBorrowedListingsCached,
  getLendingRequestsByStatusCached,
  findServiceBookingsByRequesterCached,
  findServiceBookingsByProviderCached,
} from "@/features/dashboard/lib";
import { serviceListingDAL } from "@/dal";
import { getLendingRequestDetailUrl } from "@/features/dashboard/lib/urls";
import { formatAlertText } from "@/features/rentals/lib/format-alert-text";
import type { DashboardPulseData } from "@/features/dashboard/types";
import { toWallClock } from "@/features/schedule/lib/build-schedule";

const ACTIVITY_LIMIT = 10;
const PENDING_PREVIEW_LIMIT = 5;

/**
 * The recipient's attention label on a pending request, rental or booking alike
 * (TERMINOLOGY-GUIDELINES §4 — an attention label, not a lifecycle status).
 */
const RENTAL_PENDING_STATUS_TEXT = "Awaiting your response";
const SERVICE_PENDING_STATUS_TEXT = "Awaiting your response";

const PULSE_FALLBACK: DashboardPulseData = {
  action: {
    pendingRequests: 0,
    overdueReturns: 0,
    overdueServices: 0,
    unconfirmedServices: 0,
    rentalListingRevisions: 0,
    serviceListingRevisions: 0,
  },
  active: { borrowing: 0, lending: 0, disputes: 0 },
  upcoming: { rentals: 0, services: 0 },
  listed: { tools: 0, services: 0 },
  needs: { open: 0 },
};

/**
 * Per-source failure isolation, matching the RSC widgets' `safe()` helper: the
 * dashboard is a composite of independent reads, and one failing source must
 * degrade to its own fallback rather than 500 the whole screen (Req 5.1.2).
 */
function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((error) => {
    console.error("[dashboard/summary] source failed:", error);
    return fallback;
  });
}

/**
 * GET /api/dashboard/summary
 *
 * The mobile client's single read for the home dashboard (mobile spec Req 5.1,
 * prerequisite P-E6-2). The web dashboard is a set of RSC widgets that call these
 * helpers directly, so none of this data had an HTTP surface — this route is a
 * thin, additive wrapper over the *same* helpers. It computes nothing the web
 * doesn't already compute: counts, alert copy and pending-request shaping all
 * stay server-side so the client can render them verbatim.
 *
 * The alert sentence is formatted here (`formatAlertText`) rather than mirrored
 * in the app: duplicating that copy in a second client is how the two drift.
 */
async function getHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    // Every source that two or more sections read is started ONCE here and
    // handed down as an in-flight promise. The helpers' `cache()` wrappers
    // only dedupe inside an RSC render, not in a route handler, so without
    // this each section re-ran the same queries: provider bookings 5x per
    // request, requester bookings and borrowed listings 3x (PERF-01). Each
    // promise is `safe()`-wrapped, so it never rejects into a consumer.
    const borrowed = safe(() => getBorrowedListingsCached(userId), {
      currentRentals: [],
      upcomingRentals: [],
    });
    const lendingPendingP = safe(
      () => getLendingRequestsByStatusCached("pending", userId),
      [],
    );
    const lendingApproved = safe(
      () => getLendingRequestsByStatusCached("approved", userId),
      [],
    );
    const lendingActive = safe(
      () => getLendingRequestsByStatusCached("active", userId),
      [],
    );
    const alertsP = safe(() => getActionableAlertsCached(userId), []);
    const asClient = safe(
      () => findServiceBookingsByRequesterCached(userId),
      [],
    );
    const asProvider = safe(
      () => findServiceBookingsByProviderCached(userId),
      [],
    );
    const serviceListings = safe(
      () => serviceListingDAL.findByProvider(userId),
      [],
    );
    const upcomingScheduleP = safe(
      () =>
        getUpcomingSchedule(userId, {
          borrowed,
          lendingApproved,
          lendingActive,
          asClient,
          asProvider,
        }),
      [],
    );

    const [
      pulse,
      upcomingSchedule,
      alerts,
      activity,
      lendingPending,
      providerBookings,
    ] = await Promise.all([
      safe(
        () =>
          getDashboardPulseData(userId, {
            pendingLendingRequests: lendingPendingP,
            serviceBookingsAsProvider: asProvider,
            borrowed,
            serviceListings,
            actionableAlerts: alertsP,
            upcomingSchedule: upcomingScheduleP,
          }),
        PULSE_FALLBACK,
      ),
      upcomingScheduleP,
      alertsP,
      safe(
        () =>
          getDashboardActivityFeed(userId, ACTIVITY_LIMIT, {
            serviceBookingsAsRequester: asClient,
            serviceBookingsAsProvider: asProvider,
            serviceListingsOwned: serviceListings,
          }),
        [],
      ),
      lendingPendingP,
      asProvider,
    ]);

    const pendingServiceBookings = providerBookings.filter(
      (booking) => booking.status === "pending",
    );

    return NextResponse.json({
      pulse,
      pendingRequests: {
        // Narrow projections — the DAL rows carry counterparty email and the
        // full booking record, neither of which the dashboard needs or should
        // ship to a client.
        rentals: lendingPending
          .slice(0, PENDING_PREVIEW_LIMIT)
          .map((request) => ({
            id: request.id,
            listingName: request.listingName,
            requesterName: request.renterName,
            statusText: RENTAL_PENDING_STATUS_TEXT,
            detailUrl: getLendingRequestDetailUrl(request.id),
          })),
        rentalTotal: lendingPending.length,
        services: pendingServiceBookings
          .slice(0, PENDING_PREVIEW_LIMIT)
          .map((booking) => ({
            id: booking.id,
            listingName: booking.listingTitle,
            requesterName:
              `${booking.counterparty.firstName ?? ""} ${booking.counterparty.lastName ?? ""}`.trim(),
            statusText: SERVICE_PENDING_STATUS_TEXT,
            detailUrl: `/dashboard/services/bookings/${booking.id}`,
          })),
        serviceTotal: pendingServiceBookings.length,
      },
      alerts: alerts.map((alert) => ({
        ...alert,
        message: formatAlertText(
          alert.alertType,
          alert.userRole,
          alert.deliveryRequested,
          alert.daysLate,
        ),
      })),
      // ⚠️ Serialized as a WALL-CLOCK day, not an instant.
      //
      // `getUpcomingSchedule` sets each date to local midnight and returns a
      // `Date`. The web dashboard consumes that object directly and reads its
      // local components, so it is correct there. But `Response.json` calls
      // `toJSON()` → `toISOString()`, turning local midnight into a UTC instant
      // — and a mobile client behind UTC parses it back to the PREVIOUS day.
      // Measured: a rental dated Aug 22 rendered "Aug 21" at UTC-5, which is
      // this product's own market. Correct in UTC, so CI never saw it.
      //
      // Emitting `YYYY-MM-DD` from local components removes the round-trip
      // entirely and matches how `/api/schedule` serializes its dates.
      upcomingSchedule: upcomingSchedule.map((entry) => ({
        ...entry,
        date: toWallClock(entry.date, { dateOnly: true }),
      })),
      activity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/dashboard/summary");
