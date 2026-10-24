import { describe, it, expect } from "vitest";

import {
  hoursUntilPickup,
  pickupInstant,
  refundTierExpiresAt,
  refundTierFor,
  type CancellationEligibility,
} from "../cancellation-eligibility";
import { calculateRenterCancellationRefund } from "@/features/rentals/services/refund-calculations";

/**
 * HOA-124: the refund boundary is 24 hours before the START OF THE PICKUP DAY in
 * the market zone, not 24 hours before whatever instant the stored day happens
 * to parse to.
 *
 * `start_date` is a booked day. Mobile stores it at 00:00 (UTC midnight, which
 * is 7pm the evening before in Chicago); the web picker stores Central midnight
 * (05:00 or 06:00). Both are the same day, so both must give the same boundary.
 * On staging an Oct 27 pickup quoted "applies until Oct 25 at 7:00 PM", five
 * hours earlier than the day boundary the renter was promised.
 *
 * `now` is pinned as a UTC instant so the assertions hold in any process zone.
 */

/** Local midnight, as the driver hands back a `timestamp without time zone`. */
const day = (iso: string, hours = 0) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, hours);
};

const renter: CancellationEligibility = {
  canCancel: true,
  cancelledBy: "renter",
  path: "approved",
};

describe("pickupInstant", () => {
  it("is midnight Central (CDT) on the booked day", () => {
    expect(pickupInstant(day("2026-10-27")).toISOString()).toBe(
      "2026-10-27T05:00:00.000Z",
    );
  });

  it("uses CST once daylight saving time has ended", () => {
    expect(pickupInstant(day("2026-11-10")).toISOString()).toBe(
      "2026-11-10T06:00:00.000Z",
    );
  });

  it("is the same instant whatever time of that day was stored", () => {
    // The web picker's Central midnight lands at 05:00 in the column.
    expect(pickupInstant(day("2026-10-27", 5)).toISOString()).toBe(
      pickupInstant(day("2026-10-27")).toISOString(),
    );
  });
});

describe("the refund boundary for an Oct 27 Central pickup", () => {
  const start = day("2026-10-27");
  // Midnight starting Oct 26 in Chicago: 24 hours before the pickup day starts.
  const boundary = new Date("2026-10-26T05:00:00Z");

  it("says the full refund lasts until midnight starting Oct 26 Central", () => {
    expect(refundTierExpiresAt(start, new Date("2026-10-24T17:00:00Z"))).toBe(
      boundary.toISOString(),
    );
  });

  // The staging case: 8pm on Oct 25 in Chicago is 01:00 UTC on Oct 26, which
  // the old arithmetic already counted as inside the 24 hours.
  it("is still a full refund at 8pm Central two evenings before", () => {
    const now = new Date("2026-10-26T01:00:00Z");

    expect(refundTierFor(renter, start, now)).toBe("full_refund_24h");
    expect(calculateRenterCancellationRefund(100, start, now)).toMatchObject({
      refundAmountCents: 10000,
      refundReason: "renter_cancellation_24h",
    });
  });

  it("is a full refund exactly at the boundary", () => {
    expect(hoursUntilPickup(start, boundary)).toBe(24);
    expect(refundTierFor(renter, start, boundary)).toBe("full_refund_24h");
    expect(
      calculateRenterCancellationRefund(100, start, boundary).refundReason,
    ).toBe("renter_cancellation_24h");
  });

  it("is half a second later, in the preview and the action alike", () => {
    const now = new Date(boundary.getTime() + 1000);

    expect(refundTierFor(renter, start, now)).toBe("half_refund_under_24h");
    expect(refundTierExpiresAt(start, now)).toBeNull();
    expect(calculateRenterCancellationRefund(100, start, now)).toMatchObject({
      refundAmountCents: 5000,
      refundReason: "renter_cancellation_under_24h",
    });
  });

  it("gives a web-stored day (Central midnight in the column) the same boundary", () => {
    const webStart = day("2026-10-27", 5);

    expect(
      refundTierExpiresAt(webStart, new Date("2026-10-24T17:00:00Z")),
    ).toBe(boundary.toISOString());
  });
});
