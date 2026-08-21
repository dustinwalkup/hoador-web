import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { rentalDAL, serviceBookingDAL } from "@/dal";
import {
  ACTIONABLE_BOOKING_STATUSES,
  ACTIONABLE_RENTAL_STATUSES,
  buildSchedule,
  type ScheduleEvent,
} from "@/features/schedule/lib/build-schedule";

/**
 * Widest span a single request may ask for. A schedule is browsed a month at a
 * time; anything beyond a year is a scrape, not a view.
 */
const MAX_RANGE_DAYS = 366;

/** `YYYY-MM-DD`, the only form this route accepts. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a `YYYY-MM-DD` query param into the day it names.
 *
 * Built from explicit local components rather than `new Date(str)`: the one-arg
 * string form parses a bare date as **UTC**, which on a server behind UTC lands
 * the boundary on the previous day. The whole point of this route is that days
 * do not drift, so it cannot start by drifting its own bounds.
 */
function parseDay(value: string | null): Date | null {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
    ? null
    : date;
}

/**
 * GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * The mobile client's single read for the Schedule tab (mobile Req 2.8): every
 * rental and service booking intersecting the range, in whatever role the user
 * holds, projected into one time-ordered list.
 *
 * Two things this route is careful about:
 *
 * 1. **Dates do not drift.** Rental timestamps are `timestamp without time zone`
 *    and service bookings are a `date` + a time *string* — none of it carries a
 *    zone. Bounds are built from local components and events are serialized by
 *    `toWallClock`, so a booking made for Aug 22 reads Aug 22 on every device in
 *    every timezone (mobile D19).
 *
 * 2. **Nothing sensitive ships.** The projection is a narrow allowlist. The fat
 *    dashboard rows carry counterparty email and Stripe identifiers; the DAL
 *    queries behind this route never select them, and a test asserts the
 *    serialized body contains none of them.
 *
 * Per-source isolation matches `/api/dashboard/summary`: rentals and bookings are
 * independent reads, and one failing degrades to its own empty list rather than
 * 500-ing a schedule that could still show the other half.
 */
async function getHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const params = request.nextUrl.searchParams;
    const fromRaw = params.get("from");
    const toRaw = params.get("to");
    const from = parseDay(fromRaw);
    const to = parseDay(toRaw);

    if (!from || !to || fromRaw === null || toRaw === null) {
      return NextResponse.json(
        { error: "Query parameters from and to are required as YYYY-MM-DD" },
        { status: 400 },
      );
    }
    if (to < from) {
      return NextResponse.json(
        { error: "Query parameter to must not precede from" },
        { status: 400 },
      );
    }

    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (spanDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Range must not exceed ${MAX_RANGE_DAYS} days` },
        { status: 400 },
      );
    }

    // Inclusive of the whole last day: a rental ending at 00:00 on `to` is still
    // on the schedule for `to`.
    const rangeEnd = new Date(to);
    rangeEnd.setHours(23, 59, 59, 999);

    /** One source failing must degrade to its own empty list, never 500 the rest. */
    const safe = <T>(
      work: Promise<T>,
      source: string,
      fallback: T,
    ): Promise<T> =>
      work.catch((error: unknown) => {
        console.error(`[schedule] ${source} source failed:`, error);
        return fallback;
      });

    const [rentals, bookings, actionableRentals, actionableBookings] =
      await Promise.all([
        safe(
          rentalDAL.getScheduleRentals(userId, from, rangeEnd),
          "rental",
          [],
        ),
        safe(
          serviceBookingDAL.getScheduleBookings(userId, fromRaw, toRaw),
          "service-booking",
          [],
        ),
        safe(
          rentalDAL.getActionableRentals(userId, ACTIONABLE_RENTAL_STATUSES),
          "actionable-rental",
          [],
        ),
        safe(
          serviceBookingDAL.getActionableBookings(
            userId,
            ACTIONABLE_BOOKING_STATUSES,
          ),
          "actionable-booking",
          [],
        ),
      ]);

    const events: ScheduleEvent[] = buildSchedule(rentals, bookings);

    // Attention items are NOT scoped to the range, and that is the point: a
    // pending request is urgent because of its 72-hour expiry, not because of
    // when the rental starts. One for a December booking has to surface while
    // the user is looking at August, or Req 5.6 fails at exactly the moment it
    // matters. `actionFor` decides membership — the query fetches a superset of
    // statuses, and a row needing the OTHER party's action drops out here.
    const needsAttention = buildSchedule(
      actionableRentals,
      actionableBookings,
    ).filter((event) => event.needsAction);

    return NextResponse.json({
      events,
      needsAttention,
      range: { from: fromRaw, to: toRaw },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/schedule");
