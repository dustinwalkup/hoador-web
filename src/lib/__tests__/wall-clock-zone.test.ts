import { describe, it, expect } from "vitest";

import {
  MARKET_TIME_ZONE,
  marketDayKey,
  storedDayKey,
  wallClockToInstant,
} from "../wall-clock-zone";

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

/**
 * HOA-124. The day a person in the market is living in, whatever the server's
 * clock says. Vercel runs in UTC, so from 7pm Central (6pm in winter) the
 * server's own "today" was already tomorrow.
 */
describe("marketDayKey", () => {
  it("is still the evening's day in Central after UTC has rolled over", () => {
    // 01:00 UTC on Oct 27 is 8pm on Oct 26 in Chicago (CDT).
    expect(marketDayKey(new Date("2026-10-27T01:00:00Z"))).toBe("2026-10-26");
  });

  it("rolls over at Central midnight, not UTC midnight", () => {
    expect(marketDayKey(new Date("2026-10-27T04:59:59Z"))).toBe("2026-10-26");
    expect(marketDayKey(new Date("2026-10-27T05:00:00Z"))).toBe("2026-10-27");
  });

  it("uses the winter offset after DST ends", () => {
    // CST is UTC-6: 05:30 UTC on Nov 10 is still 11:30pm on Nov 9.
    expect(marketDayKey(new Date("2026-11-10T05:30:00Z"))).toBe("2026-11-09");
    expect(marketDayKey(new Date("2026-11-10T06:00:00Z"))).toBe("2026-11-10");
  });

  it("honours an explicit zone", () => {
    expect(marketDayKey(new Date("2026-10-27T01:00:00Z"), "UTC")).toBe(
      "2026-10-27",
    );
  });
});

/**
 * HOA-124. A stored booked day reaches a client as the instant the driver
 * parsed the zoneless column to; its UTC date is the day, in any zone.
 */
describe("storedDayKey", () => {
  it("reads a mobile-stored day (00:00) and a web-stored one (Central midnight) alike", () => {
    expect(storedDayKey(new Date("2026-10-27T00:00:00Z"))).toBe("2026-10-27");
    expect(storedDayKey(new Date("2026-10-27T05:00:00Z"))).toBe("2026-10-27");
    expect(storedDayKey("2026-11-10T06:00:00.000Z")).toBe("2026-11-10");
  });

  it("is empty for an unreadable value", () => {
    expect(storedDayKey("not a date")).toBe("");
  });
});
