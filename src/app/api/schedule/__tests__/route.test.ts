import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Per CLAUDE.md, route tests mock the SESSION module, not `route-helpers` — so
// the route's real auth path (401 vs userId) is exercised rather than stubbed.
const mockGetCurrentUser = vi.fn();

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserId: async () => (await mockGetCurrentUser())?.id ?? null,
  getAuthenticatedUser: async () => {
    const user = await mockGetCurrentUser();
    if (!user) return null;
    return {
      user,
      userId: user.id,
      isAdmin: user.userType === "admin" || user.userType === "superadmin",
    };
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockScheduleRentals = vi.fn();
const mockScheduleBookings = vi.fn();
const mockActionableRentals = vi.fn();
const mockActionableBookings = vi.fn();

vi.mock("@/dal", () => ({
  rentalDAL: {
    getScheduleRentals: (...a: any[]) => mockScheduleRentals(...a),
    getActionableRentals: (...a: any[]) => mockActionableRentals(...a),
  },
  serviceBookingDAL: {
    getScheduleBookings: (...a: any[]) => mockScheduleBookings(...a),
    getActionableBookings: (...a: any[]) => mockActionableBookings(...a),
  },
}));

const { GET } = await import("../route");

const USER = { id: "user-1", userType: "user" };

const RENTAL_ROW = {
  id: "req-1",
  listingName: "Pressure Washer",
  startDate: new Date(2026, 7, 22),
  endDate: new Date(2026, 7, 23),
  status: "pending",
  expiresAt: new Date("2026-08-20T14:41:00.000Z"),
  deliveryRequested: false,
  setupRequested: false,
  role: "owner" as const,
  counterpartyName: "Sarah Chen",
};

const BOOKING_ROW = {
  id: "sb-1",
  listingTitle: "Lawn Mowing",
  proposedDate: "2026-08-24",
  proposedTime: "10:00",
  hours: "1.50",
  status: "accepted",
  expiresAt: new Date("2026-08-20T14:41:00.000Z"),
  role: "provider" as const,
  counterpartyName: "Emily Ross",
};

function req(query: string) {
  return new NextRequest(`http://localhost:3000/api/schedule${query}`);
}

const RANGE = "?from=2026-08-01&to=2026-08-31";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(USER);
  mockScheduleRentals.mockResolvedValue([RENTAL_ROW]);
  mockScheduleBookings.mockResolvedValue([BOOKING_ROW]);
  mockActionableRentals.mockResolvedValue([RENTAL_ROW]);
  mockActionableBookings.mockResolvedValue([]);
});

describe("GET /api/schedule — auth", () => {
  it("401s without a session", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    expect((await GET(req(RANGE))).status).toBe(401);
  });

  it("scopes both reads to the session user, never a query param", async () => {
    await GET(req(`${RANGE}&userId=someone-else`));
    expect(mockScheduleRentals).toHaveBeenCalledWith(
      "user-1",
      expect.any(Date),
      expect.any(Date),
    );
    expect(mockScheduleBookings).toHaveBeenCalledWith(
      "user-1",
      "2026-08-01",
      "2026-08-31",
    );
  });
});

describe("GET /api/schedule — range validation", () => {
  it.each([
    ["missing both", ""],
    ["missing to", "?from=2026-08-01"],
    ["missing from", "?to=2026-08-31"],
    ["not a date", "?from=august&to=2026-08-31"],
    ["wrong format", "?from=08/01/2026&to=2026-08-31"],
    ["impossible day", "?from=2026-02-30&to=2026-03-31"],
  ])("400s on %s", async (_label, query) => {
    expect((await GET(req(query))).status).toBe(400);
  });

  it("400s when `to` precedes `from`", async () => {
    expect((await GET(req("?from=2026-08-31&to=2026-08-01"))).status).toBe(400);
  });

  it("400s on a range wider than a year", async () => {
    expect((await GET(req("?from=2020-01-01&to=2026-01-01"))).status).toBe(400);
  });

  it("accepts a single-day range", async () => {
    expect((await GET(req("?from=2026-08-22&to=2026-08-22"))).status).toBe(200);
  });

  it("includes the whole of the last day, not just its midnight", async () => {
    await GET(req(RANGE));
    const rangeEnd: Date = mockScheduleRentals.mock.calls[0][2];
    expect(rangeEnd.getDate()).toBe(31);
    expect(rangeEnd.getHours()).toBe(23);
    expect(rangeEnd.getMinutes()).toBe(59);
  });

  it("builds bounds from local components, so the range does not shift a day", async () => {
    await GET(req(RANGE));
    const rangeStart: Date = mockScheduleRentals.mock.calls[0][1];
    expect(rangeStart.getFullYear()).toBe(2026);
    expect(rangeStart.getMonth()).toBe(7);
    expect(rangeStart.getDate()).toBe(1);
  });
});

describe("GET /api/schedule — payload", () => {
  it("returns both sources projected into one list", async () => {
    const body = await (await GET(req(RANGE))).json();
    expect(body.events.map((e: any) => e.id)).toEqual([
      "rental:req-1",
      "service:sb-1",
    ]);
    expect(body.range).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("names what needs the user's attention, as full events", async () => {
    const body = await (await GET(req(RANGE))).json();
    // The pending request is the owner's to answer; the accepted booking is not.
    expect(body.needsAttention.map((e: any) => e.id)).toEqual(["rental:req-1"]);
    expect(body.needsAttention[0].actionLabel).toBe("Respond to request");
  });

  it("serializes rental dates as wall clock, with no zone designator", async () => {
    const body = await (await GET(req(RANGE))).json();
    const rental = body.events.find((e: any) => e.kind === "rental");
    expect(rental.start).toBe("2026-08-22");
    expect(rental.end).toBe("2026-08-23");
    expect(JSON.stringify(rental.start)).not.toMatch(/[Zz]/);
  });

  it("keeps the service booking's real time", async () => {
    const body = await (await GET(req(RANGE))).json();
    const service = body.events.find((e: any) => e.kind === "service");
    expect(service.start).toBe("2026-08-24T10:00:00");
    expect(service.end).toBe("2026-08-24T11:30:00");
  });
});

describe("GET /api/schedule — attention is NOT range-scoped", () => {
  // The bug this prevents: a pending request for a December rental is urgent
  // because of its 72-hour expiry, not because of when the rental starts. If
  // attention were filtered to the visible range, the owner would never see it
  // while looking at August and would lose the booking to expiry.
  it("surfaces a pending request whose rental falls OUTSIDE the fetched range", async () => {
    mockScheduleRentals.mockResolvedValue([]); // nothing in August
    mockScheduleBookings.mockResolvedValue([]);
    mockActionableRentals.mockResolvedValue([
      {
        ...RENTAL_ROW,
        id: "req-december",
        startDate: new Date(2026, 11, 20),
        endDate: new Date(2026, 11, 22),
      },
    ]);

    const body = await (await GET(req(RANGE))).json();

    expect(body.events).toEqual([]); // correctly absent from the August calendar
    expect(body.needsAttention.map((e: any) => e.id)).toEqual([
      "rental:req-december",
    ]);
  });

  it("queries the actionable sources without any date bound", async () => {
    await GET(req(RANGE));
    expect(mockActionableRentals).toHaveBeenCalledWith("user-1", [
      "pending",
      "overdue",
    ]);
    expect(mockActionableBookings).toHaveBeenCalledWith("user-1", [
      "pending",
      "payment_failed",
    ]);
  });

  it("omits an item that needs the OTHER party's action", async () => {
    // A renter's own pending request: they are waiting, which is not a task.
    mockActionableRentals.mockResolvedValue([
      { ...RENTAL_ROW, role: "renter" as const },
    ]);
    const body = await (await GET(req(RANGE))).json();
    expect(body.needsAttention).toEqual([]);
  });
});

describe("GET /api/schedule — never leaks", () => {
  it("serializes no email, Stripe id, or payment-method id", async () => {
    // The fat dashboard rows carry all of these; the schedule projection is a
    // narrow allowlist and must not regain them by someone widening a select.
    mockScheduleRentals.mockResolvedValue([
      { ...RENTAL_ROW, counterpartyName: "Sarah Chen" },
    ]);
    const raw = await (await GET(req(RANGE))).text();

    expect(raw).not.toMatch(/@/); // no email address, anywhere
    expect(raw.toLowerCase()).not.toContain("stripe");
    expect(raw).not.toMatch(/\bpi_|\bpm_|\bch_|\bseti_/); // Stripe id prefixes
    expect(raw.toLowerCase()).not.toContain("paymentmethod");
    expect(raw.toLowerCase()).not.toContain("totalamount");
    expect(raw.toLowerCase()).not.toContain("securitydeposit");
  });
});

describe("GET /api/schedule — per-source isolation", () => {
  it("still returns rentals when the booking source fails", async () => {
    mockActionableRentals.mockResolvedValue([]);
    mockScheduleBookings.mockRejectedValue(new Error("boom"));
    const res = await GET(req(RANGE));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.events.map((e: any) => e.kind)).toEqual(["rental"]);
  });

  it("still returns bookings when the rental source fails", async () => {
    mockActionableRentals.mockResolvedValue([]);
    mockScheduleRentals.mockRejectedValue(new Error("boom"));
    const res = await GET(req(RANGE));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.events.map((e: any) => e.kind)).toEqual(["service"]);
  });

  it("returns an empty schedule rather than 500 when every source fails", async () => {
    mockScheduleRentals.mockRejectedValue(new Error("boom"));
    mockScheduleBookings.mockRejectedValue(new Error("boom"));
    mockActionableRentals.mockRejectedValue(new Error("boom"));
    mockActionableBookings.mockRejectedValue(new Error("boom"));
    const res = await GET(req(RANGE));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.events).toEqual([]);
    expect(body.needsAttention).toEqual([]);
  });

  it("still surfaces attention when the calendar sources fail", async () => {
    mockScheduleRentals.mockRejectedValue(new Error("boom"));
    mockScheduleBookings.mockRejectedValue(new Error("boom"));
    const res = await GET(req(RANGE));
    const body = await res.json();
    expect(body.events).toEqual([]);
    expect(body.needsAttention).toHaveLength(1);
  });
});
