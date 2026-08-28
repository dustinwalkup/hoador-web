import { toWallClock } from "@/features/schedule/lib/build-schedule";

/**
 * Listing availability: the one definition of "these days are taken".
 *
 * Both sides of the booking flow read from here, and that is the point. Before
 * this module the *only* thing stopping a double-booking was the web date
 * picker: `RentalService.createRentalRequest` validates the listing, the
 * own-listing rule and the min/max period, and then inserts — it never looks at
 * `getBookedDatesForListing`, and there is no DB constraint behind it either.
 * A client that simply didn't render the picker could book over an existing
 * rental (mobile prerequisite P-E8A-2b).
 *
 * So the shown ranges and the enforced conflict now come from one place. If they
 * ever disagree, the disagreement is the bug — a picker that greys out a day the
 * server accepts, or accepts a day the server rejects, is worse than either rule
 * on its own.
 *
 * @see hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md
 *      (D-E8A-2, P-E8A-2 / P-E8A-2b)
 */

/** A blocked window as `getBookedDatesForListing` returns it. */
export interface BlockedRange {
  startDate: Date;
  endDate: Date;
  reason?: string;
}

/** A blocked window on the wire — zoneless days, never instants. */
export interface BookedRange {
  from: string;
  to: string;
  reason?: string;
}

/**
 * Serialize blocked windows as **wall-clock `YYYY-MM-DD`**.
 *
 * `start_date`/`end_date` are `timestamp without time zone` columns fed from a
 * day picker. `toISOString()` on them hands a client an instant at UTC midnight,
 * which every device behind UTC parses back to the previous day — the R-8.7 bug,
 * already found twice (mobile P-E8A-4). A date picker greying out the wrong day
 * is the same class of error, one row over.
 */
export function toBookedRanges(ranges: BlockedRange[]): BookedRange[] {
  return ranges
    .map((range) => ({
      from: toWallClock(range.startDate, { dateOnly: true }),
      to: toWallClock(range.endDate, { dateOnly: true }),
      ...(range.reason ? { reason: range.reason } : {}),
    }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

/**
 * The first blocked window overlapping `[startDate, endDate]`, or `null`.
 *
 * **Inclusive at both ends**, matching how a rental occupies a calendar
 * everywhere else in the codebase (`daysOccupiedBy`, and the schedule query's
 * `startDate <= to AND endDate >= from`): the item is out on its return day too,
 * so a new rental starting the day another ends is a clash. Getting this
 * half-open would look plausible and hand two renters the same drill.
 *
 * Compared on **day keys as strings**, never on `Date` instants — `YYYY-MM-DD`
 * sorts lexicographically in date order, and it keeps a timezone out of the
 * comparison entirely (design D19).
 */
export function findConflict(
  ranges: BlockedRange[],
  startDate: Date,
  endDate: Date,
): BookedRange | null {
  const start = toWallClock(startDate, { dateOnly: true });
  const end = toWallClock(endDate, { dateOnly: true });

  for (const range of toBookedRanges(ranges)) {
    if (range.from <= end && range.to >= start) return range;
  }
  return null;
}

/**
 * Whether a day is in the past, compared as a **day** and not as an instant.
 *
 * A booking for *today* carries a `startDate` at midnight, which is already
 * behind `now` by the time anyone taps anything. Comparing instants would reject
 * every same-day rental — a bug that only shows up after lunch.
 */
export function isPastDay(date: Date, now: Date = new Date()): boolean {
  return (
    toWallClock(date, { dateOnly: true }) < toWallClock(now, { dateOnly: true })
  );
}
