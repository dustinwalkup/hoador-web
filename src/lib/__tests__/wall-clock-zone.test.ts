import { describe, it, expect } from "vitest";

import { MARKET_TIME_ZONE, wallClockToInstant } from "../wall-clock-zone";

/**
 * Mobile P-E9-2 / finding F4. These assertions are written in UTC on purpose:
 * the bug being fixed was invisible precisely because everything agreed in UTC,
 * so the test has to state what the UTC instant should be for a wall clock that
 * is NOT in UTC.
 */
describe("wallClockToInstant", () => {
  it("reads a summer wall clock as CDT (UTC-5), not as UTC", () => {
    // 6pm on Sep 2 in Chicago is 23:00 UTC. The old code produced 18:00 UTC —
    // five hours early, which moved the 24-hour refund boundary with it.
    const instant = wallClockToInstant("2026-09-02", "18:00");

    expect(instant?.toISOString()).toBe("2026-09-02T23:00:00.000Z");
  });

  it("reads a winter wall clock as CST (UTC-6)", () => {
    const instant = wallClockToInstant("2026-01-15", "18:00");

    expect(instant?.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("uses the offset in force AT the instant, not at the naive guess", () => {
    // The two-pass correction. US DST ends at 02:00 local on 2026-11-01, so a
    // 01:30 wall clock that day sits right at the seam a single pass gets
    // wrong. Whatever the answer is, it must round-trip.
    const instant = wallClockToInstant("2026-11-01", "01:30");

    expect(instant).not.toBeNull();
    const backInZone = new Intl.DateTimeFormat("en-US", {
      timeZone: MARKET_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(instant!);
    expect(backInZone).toContain("11/01/2026");
    expect(backInZone).toContain("01:30");
  });

  it("round-trips every hour of a spring-forward day it can represent", () => {
    // 02:00–02:59 on 2026-03-08 does not exist in Chicago; every other hour
    // must come back as itself.
    for (let hour = 0; hour < 24; hour++) {
      if (hour === 2) continue;
      const time = `${String(hour).padStart(2, "0")}:15`;
      const instant = wallClockToInstant("2026-03-08", time);
      expect(instant).not.toBeNull();

      const rendered = new Intl.DateTimeFormat("en-US", {
        timeZone: MARKET_TIME_ZONE,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
      }).format(instant!);
      expect(rendered).toBe(time);
    }
  });

  it("accepts the HH:MM:SS form the varchar column also allows", () => {
    expect(wallClockToInstant("2026-09-02", "18:00:00")?.toISOString()).toBe(
      "2026-09-02T23:00:00.000Z",
    );
  });

  it("returns null for an unreadable value rather than silently meaning now", () => {
    // The old helper returned `new Date()` on a parse failure, which quotes the
    // harshest refund tier for a booking whose time simply could not be read.
    expect(wallClockToInstant("2026-09-02", "afternoon")).toBeNull();
    expect(wallClockToInstant("2026-09-02", "25:99")).toBeNull();
    expect(wallClockToInstant("not-a-date", "18:00")).toBeNull();
    expect(wallClockToInstant("2026-09-02", "")).toBeNull();
  });

  it("honours an explicit zone, so a second metro is a parameter not a rewrite", () => {
    expect(
      wallClockToInstant("2026-09-02", "18:00", "UTC")?.toISOString(),
    ).toBe("2026-09-02T18:00:00.000Z");
    expect(
      wallClockToInstant(
        "2026-09-02",
        "18:00",
        "America/New_York",
      )?.toISOString(),
    ).toBe("2026-09-02T22:00:00.000Z");
  });
});
