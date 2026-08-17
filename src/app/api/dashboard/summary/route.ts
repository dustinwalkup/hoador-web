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
  getLendingRequestsByStatusCached,
  findServiceBookingsByProviderCached,
} from "@/features/dashboard/lib";
import { getLendingRequestDetailUrl } from "@/features/dashboard/lib/urls";
import { formatAlertText } from "@/features/rentals/lib/format-alert-text";
import type { DashboardPulseData } from "@/features/dashboard/types";

const ACTIVITY_LIMIT = 10;
const PENDING_PREVIEW_LIMIT = 5;

/** Mirrors the widget copy in `src/features/dashboard/_widgets/pending-requests.widget.tsx`. */
const RENTAL_PENDING_STATUS_TEXT = "Awaiting your response";
const SERVICE_PENDING_STATUS_TEXT = "Awaiting your confirmation";

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
 * dashboard is a composite of six independent reads, and one failing source must
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

    const [
      pulse,
      upcomingSchedule,
      alerts,
      activity,
      lendingPending,
      providerBookings,
    ] = await Promise.all([
      safe(() => getDashboardPulseData(userId), PULSE_FALLBACK),
      safe(() => getUpcomingSchedule(userId), []),
      safe(() => getActionableAlertsCached(userId), []),
      safe(() => getDashboardActivityFeed(userId, ACTIVITY_LIMIT), []),
      safe(() => getLendingRequestsByStatusCached("pending", userId), []),
      safe(() => findServiceBookingsByProviderCached(userId), []),
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
      upcomingSchedule,
      activity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/dashboard/summary");
