/**
 * The unified Schedule projection (mobile Req 2.8): rentals + service bookings,
 * in whatever role the user holds, as one time-ordered list.
 *
 * Pure — takes DAL rows, returns wire objects. All of the traps live here, so
 * all of them are unit-testable without a database.
 *
 * @see specs/mobile-app/1-requirements.md §2.8, §5.2–5.7
 * @see hoador-mobile/specs/mobile-app/tasks/epic-08-schedule.md (D-E8-1, D17, D19)
 */

import type { ScheduleRentalRow } from "@/dal/rentals.dal";
import type { ScheduleServiceBookingRow } from "@/dal/service-booking.dal";

export type ScheduleRole = "renter" | "owner" | "client" | "provider";

export interface ScheduleMoment {
  kind: "pickup" | "return";
  /** Wall-clock `YYYY-MM-DD`. */
  date: string;
  label: string;
}

export interface ScheduleEvent {
  id: string;
  kind: "rental" | "service";
  /**
   * What the client should open. For rentals this is the **rental request** id —
   * `/api/rentals/[id]` filters on `rentalRequests.id`, so this works whether or
   * not a `rentals` row exists yet (the two-table split, mobile F-S6).
   */
  detailRef: { type: "rental" | "service-booking"; id: string };
  title: string;
  /** Server-composed, rendered verbatim by the client (Req 5.2.5). */
  roleLabel: string;
  role: ScheduleRole;
  /** Wall clock, no zone. See `toWallClock`. */
  start: string;
  end: string | null;
  allDay: boolean;
  status: string;
  statusLabel: string;
  needsAction: boolean;
  actionLabel: string | null;
  /** A real instant (ISO, UTC) — unlike `start`/`end`. Only set while pending. */
  expiresAt: string | null;
  moments: ScheduleMoment[];
}

/**
 * The user-facing status vocabulary: `hoador-mobile/docs/design/
 * TERMINOLOGY-GUIDELINES.md` §4 and mobile Req 5.7.2 as amended 2026-09-25
 * (superseding **D-E8-1**'s single "Request" and the rental "Denied").
 *
 * These strings are duplicated in the mobile app's `src/ui/status-pill.tsx`,
 * because the client takes the *label* from here and the *icon and tone* from
 * there — so both must say the same word or a pill ships a checkmark next to
 * text that disagrees with it. `status-vocabulary.test.tsx` on the client and
 * `build-schedule.test.ts` here pin the same table from both ends.
 *
 * `pending` here is the **sender's** word. The recipient's is not a status at
 * all — see `statusLabelFor`.
 */
const RENTAL_STATUS_LABEL: Record<string, string> = {
  pending: "Request sent",
  approved: "Confirmed",
  active: "Active",
  overdue: "Overdue",
  completed: "Completed",
  cancelled: "Cancelled",
  // The enum says `denied`; the owner's action is Decline.
  denied: "Declined",
};

const SERVICE_STATUS_LABEL: Record<string, string> = {
  pending: "Request sent",
  accepted: "Confirmed",
  declined: "Declined",
  payment_failed: "Payment failed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * What the owner or provider sees on a request still waiting for *them*.
 *
 * An **attention label**, not a lifecycle status (guideline §4): it describes
 * the viewer's relationship to the request, which is why it is chosen here from
 * the viewer's role rather than added to the maps above. `status` on the wire
 * stays `pending` either way; only the words differ.
 */
export const AWAITING_RESPONSE_LABEL = "Awaiting your response";

function statusLabelFor(
  labels: Record<string, string>,
  status: string,
  role: ScheduleRole,
): string {
  const isRecipient = role === "owner" || role === "provider";
  if (status === "pending" && isRecipient) return AWAITING_RESPONSE_LABEL;
  return labels[status] ?? "Unknown";
}

/**
 * Statuses that can put an event in "Needs your attention".
 *
 * These drive a **range-independent** query (see the route): a pending request
 * for a rental six months out still needs an answer within 72 hours, so it must
 * surface while the user is looking at *this* month. Scoping attention to the
 * visible range would hide exactly the thing Req 5.6 exists to prevent missing.
 *
 * Kept here, beside `actionFor`, so the SQL filter and the projection's own idea
 * of "needs action" cannot drift apart. `actionFor` still has the final say —
 * these statuses are the superset the query fetches, and a row that turns out
 * not to need this user's action (a renter's pending request) is filtered out.
 *
 * **Not every attention class is a status.** *Review available* (Req 5.6.1 as
 * amended 2026-09-23) is a completed booking with no review from the viewer
 * inside its window — `completed` either way, so it cannot be listed here. It is
 * JOINED in instead (`getReviewableRentals` / `getReviewableBookings`, P-E13-1)
 * and flagged through `reviewPending`, which `actionFor` checks first. A future
 * class that depends on something other than status belongs beside those, not
 * in this list.
 */
export const ACTIONABLE_RENTAL_STATUSES = ["pending", "overdue"] as const;
export const ACTIONABLE_BOOKING_STATUSES = [
  "pending",
  "payment_failed",
] as const;

/**
 * ⚠️ **"Review available" is not a status, and that is why it is not in the two
 * lists above** (P-E13-1).
 *
 * Req 5.6.1 originally named four more attention classes. The 2026-08-21
 * amendment deferred them because `GET /api/schedule` derives attention from
 * booking *status*, and no status expresses "a review is outstanding" — the
 * booking is simply `completed`, exactly like one that has already been
 * reviewed. The note said the deferred classes would "extend
 * `ACTIONABLE_*_STATUSES`" when their epics landed; for this one that turned out
 * to be wrong. Whether a review is outstanding is a **join** against
 * `blind_reviews` plus a 7-day window measured from the completion timestamp
 * (`rentals.return_confirmed_at` / `service_bookings.completed_at`), which is
 * why the DAL answers it and the row carries the answer here as a flag.
 *
 * Marking it on the row rather than inventing a pseudo-status keeps the status
 * vocabulary (D-E8-1) honest: the event still says **Completed**, because it is.
 */
export const REVIEW_ACTION_LABEL = "Leave a review";

/**
 * Format a `Date` as a **wall-clock** string, using its local components.
 *
 * `toISOString()` is forbidden on schedule dates and this is why: the columns are
 * `timestamp without time zone`, so the driver parses `2026-08-22 00:00:00` into
 * a Date at *local* midnight. Reading local components returns the digits the DB
 * actually holds, on any server; `toISOString()` would shift them by the server's
 * offset and a rental booked for Aug 22 would go out as Aug 21.
 *
 * (`expiresAt` is different — a genuine instant — and is serialized as ISO.)
 */
export function toWallClock(date: Date, opts?: { dateOnly?: boolean }): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  if (opts?.dateOnly) return day;
  return `${day}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** Rental role line for an event card: "Renting to Sarah" / "Renting from Mike". */
function rentalRoleLabel(
  role: "renter" | "owner",
  counterparty: string,
): string {
  const name =
    counterparty.trim() || (role === "renter" ? "the owner" : "the renter");
  return role === "owner" ? `Renting to ${name}` : `Renting from ${name}`;
}

/** Service role line: "Providing to Emily" / "Receiving from James". */
function serviceRoleLabel(
  role: "client" | "provider",
  counterparty: string,
): string {
  const name =
    counterparty.trim() || (role === "client" ? "the provider" : "the client");
  return role === "provider"
    ? `Providing to ${name}`
    : `Receiving from ${name}`;
}

/**
 * Pickup/return moment copy, delivery-aware — mirroring `buildRentalLabel` in
 * the dashboard's 7-day helper so both surfaces say the same thing.
 */
function momentLabel(
  kind: "pickup" | "return",
  role: "renter" | "owner",
  counterparty: string,
  deliveryRequested: boolean,
): string {
  const name =
    counterparty.trim() || (role === "renter" ? "the owner" : "the renter");
  if (role === "renter") {
    if (kind === "pickup") {
      return deliveryRequested
        ? `Delivery from ${name}`
        : `Pickup from ${name}`;
    }
    return deliveryRequested ? `Pickup by ${name}` : `Return to ${name}`;
  }
  if (kind === "pickup") {
    return deliveryRequested ? `Deliver to ${name}` : `Pickup by ${name}`;
  }
  return deliveryRequested ? `Pickup from ${name}` : `Return from ${name}`;
}

/**
 * Whether this event is asking the current user to do something, and what.
 *
 * Deliberately asymmetric: a pending request needs an answer from the side that
 * *receives* it. The requester sees the countdown but is not "blocked" — they are
 * waiting, which is not a task (Req 5.6.1–5.6.2).
 */
function actionFor(
  status: string,
  role: ScheduleRole,
  reviewPending = false,
): { needsAction: boolean; actionLabel: string | null } {
  const isSupplySide = role === "owner" || role === "provider";

  // Checked first: it is the only attention class that applies to a COMPLETED
  // booking, and the `return {needsAction: false}` floor below would swallow it.
  // Symmetric by design — both parties owe a review, unlike a pending request
  // (Req 15.1.1: the opportunity is surfaced to *each* party).
  if (reviewPending) {
    return { needsAction: true, actionLabel: REVIEW_ACTION_LABEL };
  }

  if (status === "pending") {
    return isSupplySide
      ? { needsAction: true, actionLabel: "Respond to request" }
      : { needsAction: false, actionLabel: "Awaiting response" };
  }
  if (status === "payment_failed") {
    return isSupplySide
      ? { needsAction: true, actionLabel: "Payment failed — awaiting retry" }
      : { needsAction: true, actionLabel: "Update payment method" };
  }
  if (status === "overdue") {
    // Both sides act: the renter returns the item, the owner chases it.
    return isSupplySide
      ? { needsAction: true, actionLabel: "Return overdue" }
      : { needsAction: true, actionLabel: "Return this item" };
  }
  return { needsAction: false, actionLabel: null };
}

/** A pending request's deadline is the only countdown Schedule renders. */
function expiryFor(status: string, expiresAt: Date | null): string | null {
  if (status !== "pending" || !expiresAt) return null;
  return expiresAt.toISOString();
}

/**
 * A rental becomes ONE all-day span carrying its lifecycle moments (D17).
 *
 * Rentals have no time of day anywhere in the domain — `start_date`/`end_date`
 * are fed from a day picker — so a span is the honest shape for a calendar, and
 * the pickup/return moments are what an agenda actually acts on. Same-day rentals
 * collapse to a single moment, matching the dashboard helper's behaviour.
 */
export function rentalToEvent(row: ScheduleRentalRow): ScheduleEvent {
  const startDay = toWallClock(row.startDate, { dateOnly: true });
  const endDay = toWallClock(row.endDate, { dateOnly: true });
  const { needsAction, actionLabel } = actionFor(
    row.status,
    row.role,
    row.reviewPending,
  );

  const moments: ScheduleMoment[] = [
    {
      kind: "pickup" as const,
      date: startDay,
      label: momentLabel(
        "pickup",
        row.role,
        row.counterpartyName,
        row.deliveryRequested,
      ),
    },
    ...(startDay === endDay
      ? []
      : [
          {
            kind: "return" as const,
            date: endDay,
            label: momentLabel(
              "return",
              row.role,
              row.counterpartyName,
              row.deliveryRequested,
            ),
          },
        ]),
  ];

  return {
    id: `rental:${row.id}`,
    kind: "rental",
    detailRef: { type: "rental", id: row.id },
    title: row.listingName,
    roleLabel: rentalRoleLabel(row.role, row.counterpartyName),
    role: row.role,
    start: startDay,
    end: endDay,
    allDay: true,
    status: row.status,
    statusLabel: statusLabelFor(RENTAL_STATUS_LABEL, row.status, row.role),
    needsAction,
    actionLabel,
    expiresAt: expiryFor(row.status, row.expiresAt),
    moments,
  };
}

/**
 * A service booking becomes ONE timed event.
 *
 * `proposedDate` and `proposedTime` are already wall-clock strings from the DB
 * and are concatenated, never parsed — constructing a `Date` here is exactly the
 * mistake `toWallClock` exists to prevent. `hours` is nullable, so an end time is
 * emitted only when the duration is actually known (Req 2.8.4).
 */
export function serviceBookingToEvent(
  row: ScheduleServiceBookingRow,
): ScheduleEvent {
  const start = `${row.proposedDate}T${normalizeTime(row.proposedTime)}`;
  const { needsAction, actionLabel } = actionFor(
    row.status,
    row.role,
    row.reviewPending,
  );

  return {
    id: `service:${row.id}`,
    kind: "service",
    detailRef: { type: "service-booking", id: row.id },
    title: row.listingTitle,
    roleLabel: serviceRoleLabel(row.role, row.counterpartyName),
    role: row.role,
    start,
    end: addHours(row.proposedDate, row.proposedTime, row.hours),
    allDay: false,
    status: row.status,
    statusLabel: statusLabelFor(SERVICE_STATUS_LABEL, row.status, row.role),
    needsAction,
    actionLabel,
    expiresAt: expiryFor(row.status, row.expiresAt),
    moments: [],
  };
}

/** `"9:00"` and `"09:00"` both become `"09:00:00"`. */
function normalizeTime(time: string): string {
  const [h = "0", m = "0"] = time.trim().split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
}

/**
 * End time from a duration, in pure minute arithmetic — no `Date`, so no zone.
 * Returns null when the duration is unknown, and clamps a booking that would
 * spill past midnight to 23:59 rather than silently landing on the wrong day.
 */
function addHours(
  day: string,
  time: string,
  hours: string | null,
): string | null {
  if (hours === null) return null;
  const durationHours = Number(hours);
  if (!Number.isFinite(durationHours) || durationHours <= 0) return null;

  const [h = "0", m = "0"] = time.trim().split(":");
  const startMinutes = Number(h) * 60 + Number(m);
  if (!Number.isFinite(startMinutes)) return null;

  const endMinutes = Math.min(
    startMinutes + Math.round(durationHours * 60),
    23 * 60 + 59,
  );
  const p = (n: number) => String(n).padStart(2, "0");
  return `${day}T${p(Math.floor(endMinutes / 60))}:${p(endMinutes % 60)}:00`;
}

/**
 * Build the full projection, sorted by start. Rentals sort before services on the
 * same day: an all-day span is context for the day, a timed booking is an
 * appointment within it.
 */
export function buildSchedule(
  rentals: ScheduleRentalRow[],
  bookings: ScheduleServiceBookingRow[],
): ScheduleEvent[] {
  return [
    ...rentals.map(rentalToEvent),
    ...bookings.map(serviceBookingToEvent),
  ].sort((a, b) => {
    const dayCompare = a.start.slice(0, 10).localeCompare(b.start.slice(0, 10));
    if (dayCompare !== 0) return dayCompare;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.start.localeCompare(b.start);
  });
}
