import { describe, it, expect } from "vitest";

import {
  buildSchedule,
  rentalToEvent,
  serviceBookingToEvent,
  toWallClock,
} from "../build-schedule";
import type { ScheduleRentalRow } from "@/dal/rentals.dal";
import type { ScheduleServiceBookingRow } from "@/dal/service-booking.dal";

const EXPIRES = new Date("2026-08-20T14:41:00.000Z");

function rental(over: Partial<ScheduleRentalRow> = {}): ScheduleRentalRow {
  return {
    id: "req-1",
    listingName: "Pressure Washer",
    // Local components on purpose — a `timestamp without time zone` arrives from
    // the driver as a local-time Date, and these tests must mirror that.
    startDate: new Date(2026, 7, 22),
    endDate: new Date(2026, 7, 23),
    status: "approved",
    expiresAt: EXPIRES,
    deliveryRequested: false,
    setupRequested: false,
    role: "owner",
    counterpartyName: "Sarah Chen",
    ...over,
  };
}

function booking(
  over: Partial<ScheduleServiceBookingRow> = {},
): ScheduleServiceBookingRow {
  return {
    id: "sb-1",
    listingTitle: "Lawn Mowing",
    proposedDate: "2026-08-24",
    proposedTime: "10:00",
    hours: "1.50",
    status: "accepted",
    expiresAt: EXPIRES,
    role: "provider",
    counterpartyName: "Emily Ross",
    ...over,
  };
}

describe("toWallClock — dates must not drift (mobile D19)", () => {
  /**
   * A note on how this is tested, because the obvious approach does not work.
   *
   * Setting `process.env.TZ` inside a test is a **no-op under vitest**: tests run
   * in worker threads where mutating it does not invalidate Node's cached zone,
   * so a loop over four zone names silently runs all four in one zone and passes
   * vacuously. The zone must be set when the process starts — `bun run test:tz`
   * exists for exactly that (see package.json), and CI runs it.
   *
   * Worse, the bug is **invisible in most of the world's CI**. `toISOString()` on
   * a local midnight only rolls back a day in zones AHEAD of UTC: in UTC (offset
   * 0) and everywhere in the Americas (positive offset) the naive path returns
   * the correct day by accident. So a green suite in UTC proves nothing here.
   */
  const ambientOffset = new Date(2026, 7, 22).getTimezoneOffset();
  const zoneIsAheadOfUtc = ambientOffset < 0;

  it("returns exactly the components the date was built from", () => {
    expect(toWallClock(new Date(2026, 7, 22), { dateOnly: true })).toBe(
      "2026-08-22",
    );
    expect(toWallClock(new Date(2026, 0, 5), { dateOnly: true })).toBe(
      "2026-01-05",
    );
    expect(toWallClock(new Date(2026, 11, 31, 23, 59, 58))).toBe(
      "2026-12-31T23:59:58",
    );
  });

  it("keeps a rental's span on the booked days", () => {
    const event = rentalToEvent(rental());
    expect(event.start).toBe("2026-08-22");
    expect(event.end).toBe("2026-08-23");
  });

  it("never emits a zone designator on start/end", () => {
    expect(rentalToEvent(rental()).start).not.toMatch(/[Zz]|[+-]\d{2}:\d{2}$/);
    expect(serviceBookingToEvent(booking()).start).not.toMatch(
      /[Zz]|[+-]\d{2}:\d{2}$/,
    );
  });

  // Guards the guard: proves the naive path genuinely loses a day, so that
  // "simplifying" toWallClock to toISOString() fails loudly instead of shipping.
  // Only meaningful ahead of UTC — stated rather than silently skipped, so a
  // UTC-only run reports that it did NOT verify this rather than looking green.
  it(
    zoneIsAheadOfUtc
      ? "proves toISOString() would lose a day in this zone"
      : `CANNOT verify the toISOString() drift at UTC${ambientOffset > 0 ? "-" : "+"}${Math.abs(ambientOffset) / 60} — run 'bun run test:tz'`,
    () => {
      const midnight = new Date(2026, 7, 22, 0, 0, 0);
      expect(toWallClock(midnight, { dateOnly: true })).toBe("2026-08-22");
      if (zoneIsAheadOfUtc) {
        expect(midnight.toISOString().slice(0, 10)).toBe("2026-08-21"); // the bug
      }
    },
  );
});

describe("rentals become all-day spans with lifecycle moments (D17)", () => {
  it("is all-day and spans start to end", () => {
    const event = rentalToEvent(rental());
    expect(event.allDay).toBe(true);
    expect(event.start).toBe("2026-08-22");
    expect(event.end).toBe("2026-08-23");
  });

  it("carries pickup and return moments on their own days", () => {
    expect(rentalToEvent(rental()).moments).toEqual([
      { kind: "pickup", date: "2026-08-22", label: "Pickup by Sarah Chen" },
      { kind: "return", date: "2026-08-23", label: "Return from Sarah Chen" },
    ]);
  });

  it("collapses a same-day rental to a single moment", () => {
    const sameDay = rental({ endDate: new Date(2026, 7, 22) });
    const moments = rentalToEvent(sameDay).moments;
    expect(moments).toHaveLength(1);
    expect(moments[0].kind).toBe("pickup");
  });

  it("uses delivery wording when delivery was requested", () => {
    const delivered = rentalToEvent(
      rental({ role: "renter", deliveryRequested: true }),
    );
    expect(delivered.moments.map((m) => m.label)).toEqual([
      "Delivery from Sarah Chen",
      "Pickup by Sarah Chen",
    ]);
  });

  it("links to the rental REQUEST id, which is what the detail route resolves", () => {
    expect(rentalToEvent(rental()).detailRef).toEqual({
      type: "rental",
      id: "req-1",
    });
  });

  it("names the role from the user's side", () => {
    expect(rentalToEvent(rental({ role: "owner" })).roleLabel).toBe(
      "Lending to Sarah Chen",
    );
    expect(rentalToEvent(rental({ role: "renter" })).roleLabel).toBe(
      "Borrowing from Sarah Chen",
    );
  });

  it("falls back to a role word when the counterparty has no name", () => {
    expect(rentalToEvent(rental({ counterpartyName: " " })).roleLabel).toBe(
      "Lending to the renter",
    );
  });
});

describe("service bookings keep their real time (Req 2.8.4)", () => {
  it("is not all-day and starts at the proposed time", () => {
    const event = serviceBookingToEvent(booking());
    expect(event.allDay).toBe(false);
    expect(event.start).toBe("2026-08-24T10:00:00");
  });

  it("derives an end from hours", () => {
    expect(serviceBookingToEvent(booking()).end).toBe("2026-08-24T11:30:00");
  });

  it("emits NO end when the duration is unknown — never a fabricated range", () => {
    expect(serviceBookingToEvent(booking({ hours: null })).end).toBeNull();
    expect(serviceBookingToEvent(booking({ hours: "0" })).end).toBeNull();
    expect(serviceBookingToEvent(booking({ hours: "abc" })).end).toBeNull();
  });

  it("normalizes an unpadded time", () => {
    expect(serviceBookingToEvent(booking({ proposedTime: "9:05" })).start).toBe(
      "2026-08-24T09:05:00",
    );
  });

  it("clamps rather than spilling onto the next day", () => {
    const late = booking({ proposedTime: "23:00", hours: "4" });
    expect(serviceBookingToEvent(late).end).toBe("2026-08-24T23:59:00");
  });

  it("has no moments — a booking is one appointment", () => {
    expect(serviceBookingToEvent(booking()).moments).toEqual([]);
  });
});

describe("status vocabulary (D-E8-1) — must match the mobile UI kit", () => {
  // The client takes the LABEL from here and the icon/tone from its own map, so
  // this table is duplicated in hoador-mobile's `status-vocabulary.test.tsx`.
  // Both ends pin it so the two cannot drift into disagreeing.
  it.each([
    ["pending", "Request"],
    ["approved", "Confirmed"],
    ["active", "Active"],
    ["overdue", "Overdue"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
    ["denied", "Denied"],
  ])("rental %s reads %s", (status, label) => {
    expect(rentalToEvent(rental({ status })).statusLabel).toBe(label);
  });

  it.each([
    ["pending", "Request"],
    ["accepted", "Confirmed"],
    ["declined", "Declined"],
    ["payment_failed", "Payment failed"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
  ])("service booking %s reads %s", (status, label) => {
    expect(serviceBookingToEvent(booking({ status })).statusLabel).toBe(label);
  });

  it("never says Pending or Approved", () => {
    const labels = [
      ...["pending", "approved"].map(
        (s) => rentalToEvent(rental({ status: s })).statusLabel,
      ),
      ...["pending", "accepted"].map(
        (s) => serviceBookingToEvent(booking({ status: s })).statusLabel,
      ),
    ];
    expect(labels).not.toContain("Pending");
    expect(labels).not.toContain("Approved");
    expect(labels).not.toContain("Accepted");
  });

  it("degrades an unrecognized status rather than throwing", () => {
    expect(rentalToEvent(rental({ status: "teleported" })).statusLabel).toBe(
      "Unknown",
    );
  });
});

describe("needsAction is asymmetric — waiting is not a task (Req 5.6.2)", () => {
  it("asks the OWNER to answer a pending rental request", () => {
    const event = rentalToEvent(rental({ status: "pending", role: "owner" }));
    expect(event.needsAction).toBe(true);
    expect(event.actionLabel).toBe("Respond to request");
  });

  it("does NOT flag the renter, who is only waiting", () => {
    const event = rentalToEvent(rental({ status: "pending", role: "renter" }));
    expect(event.needsAction).toBe(false);
    expect(event.actionLabel).toBe("Awaiting response");
  });

  it("flags both sides of an overdue rental", () => {
    expect(
      rentalToEvent(rental({ status: "overdue", role: "owner" })).needsAction,
    ).toBe(true);
    expect(
      rentalToEvent(rental({ status: "overdue", role: "renter" })).needsAction,
    ).toBe(true);
  });

  it("points a payment failure at the side that can fix it", () => {
    expect(
      serviceBookingToEvent(
        booking({ status: "payment_failed", role: "client" }),
      ).actionLabel,
    ).toBe("Update payment method");
  });

  it("flags nothing on a settled booking", () => {
    const event = rentalToEvent(rental({ status: "completed" }));
    expect(event.needsAction).toBe(false);
    expect(event.actionLabel).toBeNull();
  });
});

describe("expiresAt", () => {
  it("is an ISO INSTANT, unlike start/end", () => {
    const event = rentalToEvent(rental({ status: "pending" }));
    expect(event.expiresAt).toBe("2026-08-20T14:41:00.000Z");
  });

  it("is null once the request is no longer pending", () => {
    expect(rentalToEvent(rental({ status: "approved" })).expiresAt).toBeNull();
  });
});

describe("buildSchedule ordering", () => {
  it("sorts by day, all-day spans before timed events", () => {
    const events = buildSchedule(
      [
        rental({
          id: "r-late",
          startDate: new Date(2026, 7, 24),
          endDate: new Date(2026, 7, 25),
        }),
      ],
      [booking({ id: "sb-early", proposedDate: "2026-08-24" })],
    );
    expect(events.map((e) => e.id)).toEqual([
      "rental:r-late",
      "service:sb-early",
    ]);
  });

  it("handles both sources being empty", () => {
    expect(buildSchedule([], [])).toEqual([]);
  });
});
