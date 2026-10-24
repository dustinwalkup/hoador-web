import { describe, it, expect } from "vitest";

import {
  findConflict,
  isFutureDay,
  isPastDay,
  startOfMarketToday,
  toBookedRanges,
  type BlockedRange,
} from "../availability";

/** Local midnight, as the driver hands back a `timestamp without time zone`. */
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const range = (from: string, to: string, reason?: string): BlockedRange => ({
  startDate: day(from),
  endDate: day(to),
  ...(reason ? { reason } : {}),
});

describe("toBookedRanges", () => {
  it("serializes zoneless days, not instants", () => {
    expect(toBookedRanges([range("2026-09-01", "2026-09-03")])).toEqual([
      { from: "2026-09-01", to: "2026-09-03" },
    ]);
  });

  // R-8.7, one row over: an instant at UTC midnight greys out the wrong day on
  // every device behind UTC.
  it("emits no timezone designator at all", () => {
    const [first] = toBookedRanges([range("2026-09-01", "2026-09-03")]);
    expect(first.from).not.toMatch(/[TZ]/);
    expect(first.to).not.toMatch(/[TZ]/);
  });

  it("carries a manual block's reason and omits it otherwise", () => {
    const [booking, block] = toBookedRanges([
      range("2026-09-10", "2026-09-11", "Maintenance"),
      range("2026-09-01", "2026-09-03"),
    ]);
    expect(booking).toEqual({ from: "2026-09-01", to: "2026-09-03" });
    expect(block.reason).toBe("Maintenance");
  });

  it("sorts chronologically — the two sources arrive interleaved", () => {
    const sorted = toBookedRanges([
      range("2026-09-10", "2026-09-11"),
      range("2026-09-01", "2026-09-03"),
      range("2026-09-05", "2026-09-06"),
    ]);
    expect(sorted.map((r) => r.from)).toEqual([
      "2026-09-01",
      "2026-09-05",
      "2026-09-10",
    ]);
  });
});

describe("findConflict", () => {
  const booked = [range("2026-09-10", "2026-09-14")];

  it.each([
    ["fully inside", "2026-09-11", "2026-09-13"],
    ["fully containing", "2026-09-08", "2026-09-16"],
    ["overlapping the start", "2026-09-08", "2026-09-11"],
    ["overlapping the end", "2026-09-13", "2026-09-16"],
    ["exactly equal", "2026-09-10", "2026-09-14"],
  ])("detects a request %s", (_label, from, to) => {
    expect(findConflict(booked, day(from), day(to))).not.toBeNull();
  });

  // The item is out on its return day too. Half-open would look plausible and
  // hand two renters the same drill.
  it.each([
    ["starting on the day the other ends", "2026-09-14", "2026-09-16"],
    ["ending on the day the other starts", "2026-09-08", "2026-09-10"],
  ])("treats a request %s as a clash", (_label, from, to) => {
    expect(findConflict(booked, day(from), day(to))).not.toBeNull();
  });

  it.each([
    ["entirely before", "2026-09-07", "2026-09-09"],
    ["entirely after", "2026-09-15", "2026-09-17"],
  ])("allows a request %s", (_label, from, to) => {
    expect(findConflict(booked, day(from), day(to))).toBeNull();
  });

  it("allows anything when nothing is booked", () => {
    expect(findConflict([], day("2026-09-10"), day("2026-09-14"))).toBeNull();
  });

  it("returns the offending window so the caller can explain itself", () => {
    const conflict = findConflict(
      [range("2026-09-10", "2026-09-14", "Maintenance")],
      day("2026-09-12"),
      day("2026-09-13"),
    );
    expect(conflict).toEqual({
      from: "2026-09-10",
      to: "2026-09-14",
      reason: "Maintenance",
    });
  });

  it("reports the EARLIEST clash when several overlap", () => {
    const conflict = findConflict(
      [range("2026-09-20", "2026-09-22"), range("2026-09-10", "2026-09-14")],
      day("2026-09-01"),
      day("2026-09-30"),
    );
    expect(conflict?.from).toBe("2026-09-10");
  });
});

describe("isPastDay", () => {
  // Sep 15, 2:30pm in Chicago. An instant, because "today" is the market's.
  const now = new Date("2026-09-15T19:30:00Z");

  // The bug this exists to prevent: a booking for TODAY carries a midnight
  // start, which is behind `now` by the time anyone taps anything. Comparing
  // instants would reject every same-day rental — after lunch, and only then.
  it("does not treat today as past, whatever the time of day", () => {
    expect(isPastDay(day("2026-09-15"), now)).toBe(false);
  });

  it("treats yesterday as past", () => {
    expect(isPastDay(day("2026-09-14"), now)).toBe(true);
  });

  it("does not treat tomorrow as past", () => {
    expect(isPastDay(day("2026-09-16"), now)).toBe(false);
  });
});

/**
 * HOA-124: "today" is the market's calendar day, not the server's. Vercel runs
 * in UTC, so from 7pm Central the server's today was already tomorrow: approve
 * and quote refused a same-day rental that evening, and start let an owner
 * begin tomorrow's rental the night before.
 *
 * `now` is pinned as a UTC instant on purpose, so these hold whatever zone the
 * test process runs in.
 */
describe("the market's today (HOA-124)", () => {
  // 8pm on Oct 26 in Chicago, and already Oct 27 in UTC.
  const evening = new Date("2026-10-27T01:00:00Z");
  // Midnight starting Oct 27 in Chicago.
  const midnight = new Date("2026-10-27T05:00:00Z");

  it("does not treat a rental starting today as past at 8pm Central", () => {
    expect(isPastDay(day("2026-10-26"), evening)).toBe(false);
  });

  it("treats it as past once Central midnight has passed", () => {
    expect(isPastDay(day("2026-10-26"), midnight)).toBe(true);
  });

  it("still treats tomorrow's rental as in the future at 8pm Central", () => {
    expect(isFutureDay(day("2026-10-27"), evening)).toBe(true);
  });

  it("makes tomorrow's rental today at Central midnight", () => {
    expect(isFutureDay(day("2026-10-27"), midnight)).toBe(false);
    expect(isPastDay(day("2026-10-27"), midnight)).toBe(false);
  });

  it("gives the market's today in the shape a stored booked day has", () => {
    expect(startOfMarketToday(evening).getTime()).toBe(
      day("2026-10-26").getTime(),
    );
    expect(startOfMarketToday(midnight).getTime()).toBe(
      day("2026-10-27").getTime(),
    );
  });
});
