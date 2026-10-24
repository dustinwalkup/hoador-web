import { wallClockToInstant } from "@/lib/wall-clock-zone";

/**
 * When a pending rental request stops being answerable.
 *
 * `expires_at` is the 72-hour window, and on its own it outlived requests that
 * could no longer be accepted: approve is refused once the start day is behind
 * the market's today (`isPastDay`, BIZ-10), so a request for tomorrow kept a
 * countdown of almost three days and then expired long after anyone could act
 * on it (Flow 6). The response deadline is the earlier of the two, set at
 * creation and applied again on every read, so a row created before this rule
 * reads (and expires) the same way.
 */

/**
 * The last moment a request can be approved: Central midnight after its start
 * day, the instant `isPastDay` turns true. The day is read from local
 * components, the same reading as `toWallClock` (not imported: the schedule
 * builder uses this module, and importing back would be a cycle). `null` for
 * an unreadable day.
 */
export function startDayEndsAt(startDate: Date): Date | null {
  const next = new Date(
    Date.UTC(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + 1,
    ),
  );
  if (Number.isNaN(next.getTime())) return null;
  return wallClockToInstant(next.toISOString().slice(0, 10), "00:00");
}

/** The response deadline: the 72-hour expiry, or the end of the start day if sooner. */
export function rentalRequestDeadline(expiresAt: Date, startDate: Date): Date {
  const lastAcceptable = startDayEndsAt(startDate);
  return lastAcceptable && lastAcceptable < expiresAt
    ? lastAcceptable
    : expiresAt;
}
