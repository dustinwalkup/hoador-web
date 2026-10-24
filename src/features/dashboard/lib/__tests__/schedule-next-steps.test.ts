import { describe, it, expect, vi, afterEach } from "vitest";

import { formatUrgencyLabel, getUrgency } from "../schedule-next-steps";

/**
 * HOA-124: the "Today" / "Tomorrow" chip runs in the browser, and an entry's
 * date reaches it as the instant the server built for a booked day (UTC
 * midnight on Vercel). Read in the browser's zone, a Central viewer saw Oct 27
 * as Oct 26 and the chip said "Today" a day early. The entry's day is the
 * stored day, and "today" is the market's (Central) day, as on the server.
 */
describe("getUrgency / formatUrgencyLabel", () => {
  // The server's Oct 27 entry, as the browser receives it.
  const oct27 = new Date("2026-10-27T00:00:00Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (now: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
  };

  it("says Tomorrow at 8pm Central on Oct 26", () => {
    at("2026-10-27T01:00:00Z");

    expect(getUrgency(oct27)).toBe("tomorrow");
    expect(formatUrgencyLabel(getUrgency(oct27), oct27)).toBe("Tomorrow");
  });

  it("says Today from Central midnight", () => {
    at("2026-10-27T05:00:00Z");

    expect(getUrgency(oct27)).toBe("today");
  });

  it("counts days to a later entry on the same calendar", () => {
    at("2026-10-24T17:00:00Z");

    expect(getUrgency(oct27)).toBe("upcoming");
    expect(formatUrgencyLabel("upcoming", oct27)).toBe("In 3 days");
  });

  it("accepts an explicit today, read as the market's day", () => {
    expect(getUrgency(oct27, new Date("2026-10-27T01:00:00Z"))).toBe(
      "tomorrow",
    );
  });
});
