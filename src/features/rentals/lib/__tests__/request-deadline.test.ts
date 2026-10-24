import { describe, it, expect } from "vitest";

import { rentalRequestDeadline, startDayEndsAt } from "../request-deadline";

/**
 * Flow 6: a request's response deadline was its 72-hour expiry, even when the
 * request stopped being acceptable before then. Approve is refused once the
 * start day is behind the market's today (`isPastDay`), so the last moment a
 * rental request can be accepted is the end of its start day in Central, and
 * the deadline is the earlier of that and the 72 hours.
 */

/** Local midnight, as the driver hands back a `timestamp without time zone`. */
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

describe("startDayEndsAt", () => {
  it("is Central midnight after the start day", () => {
    expect(startDayEndsAt(day("2026-10-25"))?.toISOString()).toBe(
      "2026-10-26T05:00:00.000Z",
    );
  });

  it("uses the offset of the day it lands on across DST", () => {
    // DST ends on Nov 1: midnight starting Nov 2 is CST.
    expect(startDayEndsAt(day("2026-11-01"))?.toISOString()).toBe(
      "2026-11-02T06:00:00.000Z",
    );
  });
});

describe("rentalRequestDeadline", () => {
  const expiresAt = new Date("2026-10-27T20:00:00Z"); // 72h after Oct 24, 3pm CDT

  it("is the end of the start day when that comes first", () => {
    expect(
      rentalRequestDeadline(expiresAt, day("2026-10-25")).toISOString(),
    ).toBe("2026-10-26T05:00:00.000Z");
  });

  it("is the 72-hour expiry when the start day is further out", () => {
    expect(rentalRequestDeadline(expiresAt, day("2026-10-30"))).toEqual(
      expiresAt,
    );
  });
});
