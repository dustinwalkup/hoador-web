/**
 * Turning a **zoneless wall clock** into a real instant.
 *
 * `service_bookings.proposed_date` is a pg `date` and `proposed_time` a bare
 * `varchar` — "2026-09-02" and "18:00", with no offset between them. They
 * describe when a person will be standing in a garden, not a point on the
 * global timeline, and something has to supply the missing zone before they can
 * be compared to `now`.
 *
 * Until 2026-09-01 nothing did: `new Date("2026-09-02T18:00:00")` was parsed in
 * **the server's** zone, which is UTC on Vercel. A 6pm job in a UTC-5 market was
 * therefore treated as 1pm local — moving the 24-hour refund boundary five
 * hours earlier and putting renters into the 50% tier while they still had a
 * day to spare. Correct in UTC, so no test or CI run could ever show it.
 */

/**
 * The zone the marketplace's wall clocks are in.
 *
 * A single constant because the product is currently one metro (the `kc`
 * network, and the `user_preferences.timezone` default is this same value).
 *
 * **When Hoador opens a second metro this becomes wrong**, in the same
 * invisible way the UTC assumption was wrong. The replacement is a `timezone`
 * column on `communities` — the work happens at a *place*, so the community's
 * zone is the right answer, not the requester's and not the provider's, who may
 * both be travelling. Every caller here already has the booking's community in
 * scope, so that change is a lookup rather than a redesign.
 */
export const MARKET_TIME_ZONE = "America/Chicago";

const PARTS_FORMAT_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = PARTS_FORMAT_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      // `h23` rather than `hour12: false`: some engines render midnight as "24"
      // under the latter, which reads back as the next day.
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PARTS_FORMAT_CACHE.set(timeZone, formatter);
  }
  return formatter;
}

/** How far `timeZone` is from UTC at a given instant, in ms (DST included). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = partsFormatter(timeZone).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return asIfUtc - at.getTime();
}

/**
 * `YYYY-MM-DD` + `HH:MM[:SS]` in a named zone → the instant it refers to.
 *
 * Two passes, and the second one is not paranoia: the offset has to be sampled
 * *at the instant being computed*, and the first guess can land on the other
 * side of a DST transition from the answer. One pass would put every booking on
 * a spring-forward or fall-back day out by an hour — which is exactly the kind
 * of once-a-year, one-hour error that reaches production and is then argued
 * about rather than found.
 *
 * Returns `null` for a date or time it cannot read, so callers decide what an
 * unusable value means rather than silently receiving `now` (which is what the
 * old helper returned, quietly quoting the harshest refund tier).
 */
export function wallClockToInstant(
  date: string,
  time: string,
  timeZone: string = MARKET_TIME_ZONE,
): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!day) return null;

  const clock = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!clock) return null;

  const [, y, mo, d] = day;
  const [, h, mi, sec] = clock;
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(sec ?? "0");
  if (hour > 23 || minute > 59 || second > 59) return null;

  const naiveUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    hour,
    minute,
    second,
  );
  if (Number.isNaN(naiveUtc)) return null;

  const firstGuess = new Date(
    naiveUtc - zoneOffsetMs(new Date(naiveUtc), timeZone),
  );
  const settledOffset = zoneOffsetMs(firstGuess, timeZone);
  return new Date(naiveUtc - settledOffset);
}
