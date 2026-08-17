import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Per CLAUDE.md, route tests mock the SESSION module, not `route-helpers` — so
// the route's real auth path (`getAuthenticatedUserResponse` → 401 vs userId)
// is under test rather than stubbed out.
const mockGetCurrentUser = vi.fn();

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserId: async () => (await mockGetCurrentUser())?.id ?? null,
  // `getAuthenticatedUserResponse` composes this one; keeping the same
  // null-vs-user contract keeps the real 401 branch under test.
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

const mockPulse = vi.fn();
const mockSchedule = vi.fn();
const mockAlerts = vi.fn();
const mockActivity = vi.fn();
const mockLendingPending = vi.fn();
const mockProviderBookings = vi.fn();

vi.mock("@/features/dashboard/lib", () => ({
  getDashboardPulseData: (...a: any[]) => mockPulse(...a),
  getUpcomingSchedule: (...a: any[]) => mockSchedule(...a),
  getActionableAlertsCached: (...a: any[]) => mockAlerts(...a),
  getDashboardActivityFeed: (...a: any[]) => mockActivity(...a),
  getLendingRequestsByStatusCached: (...a: any[]) => mockLendingPending(...a),
  findServiceBookingsByProviderCached: (...a: any[]) =>
    mockProviderBookings(...a),
}));

const PULSE = {
  action: {
    pendingRequests: 2,
    overdueReturns: 1,
    overdueServices: 0,
    unconfirmedServices: 0,
    rentalListingRevisions: 0,
    serviceListingRevisions: 0,
  },
  active: { borrowing: 1, lending: 3, disputes: 0 },
  upcoming: { rentals: 1, services: 0 },
  listed: { tools: 4, services: 1 },
  needs: { open: 2 },
};

function req() {
  return new NextRequest("http://localhost/api/dashboard/summary");
}

function serviceBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "sb-1",
    status: "pending",
    listingTitle: "Lawn mowing",
    counterparty: {
      id: "u-9",
      firstName: "Ada",
      lastName: "Lovelace",
      profileImageUrl: null,
      email: "ada@example.com",
    },
    ...overrides,
  };
}

describe("GET /api/dashboard/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockPulse.mockResolvedValue(PULSE);
    mockSchedule.mockResolvedValue([]);
    mockAlerts.mockResolvedValue([]);
    mockActivity.mockResolvedValue([]);
    mockLendingPending.mockResolvedValue([]);
    mockProviderBookings.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated and touches no data source", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockPulse).not.toHaveBeenCalled();
  });

  it("returns the composed payload for the authenticated user", async () => {
    const { GET } = await import("../route");
    const res = await GET(req());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.pulse).toEqual(PULSE);
    expect(mockPulse).toHaveBeenCalledWith("user-1");
    expect(mockActivity).toHaveBeenCalledWith("user-1", 10);
    expect(mockLendingPending).toHaveBeenCalledWith("pending", "user-1");
  });

  it("isolates a failing source: one throw degrades that key, the rest survive", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockPulse.mockRejectedValue(new Error("pulse down"));
    mockActivity.mockResolvedValue([{ id: "a1", title: "Rental completed" }]);

    const { GET } = await import("../route");
    const res = await GET(req());
    const json = await res.json();

    expect(res.status).toBe(200);
    // Zeroed fallback, not a 500 and not a missing key.
    expect(json.pulse.action.pendingRequests).toBe(0);
    expect(json.pulse.active).toEqual({
      borrowing: 0,
      lending: 0,
      disputes: 0,
    });
    expect(json.activity).toEqual([{ id: "a1", title: "Rental completed" }]);

    consoleError.mockRestore();
  });

  it("caps pending previews at 5 while reporting the true totals", async () => {
    mockLendingPending.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        id: `r-${i}`,
        listingName: `Drill ${i}`,
        renterName: "Grace Hopper",
      })),
    );
    mockProviderBookings.mockResolvedValue([
      serviceBooking({ id: "sb-1" }),
      serviceBooking({ id: "sb-2" }),
      serviceBooking({ id: "sb-3", status: "accepted" }),
    ]);

    const { GET } = await import("../route");
    const json = await (await GET(req())).json();

    expect(json.pendingRequests.rentals).toHaveLength(5);
    expect(json.pendingRequests.rentalTotal).toBe(7);
    // Only `pending` provider bookings count as awaiting confirmation.
    expect(json.pendingRequests.services).toHaveLength(2);
    expect(json.pendingRequests.serviceTotal).toBe(2);
  });

  it("projects pending rows narrowly — no counterparty email reaches the client", async () => {
    mockProviderBookings.mockResolvedValue([serviceBooking()]);

    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.text();

    expect(body).not.toContain("ada@example.com");
    const json = JSON.parse(body);
    expect(json.pendingRequests.services[0]).toEqual({
      id: "sb-1",
      listingName: "Lawn mowing",
      requesterName: "Ada Lovelace",
      statusText: "Awaiting your confirmation",
      detailUrl: "/dashboard/services/bookings/sb-1",
    });
  });

  it("shapes pending rental rows with the lending-view detail URL", async () => {
    mockLendingPending.mockResolvedValue([
      {
        id: "req-1",
        listingName: "Pressure washer",
        renterName: "Alan Turing",
      },
    ]);

    const { GET } = await import("../route");
    const json = await (await GET(req())).json();

    expect(json.pendingRequests.rentals[0]).toEqual({
      id: "req-1",
      listingName: "Pressure washer",
      requesterName: "Alan Turing",
      statusText: "Awaiting your response",
      detailUrl: "/dashboard/rental/req-1?view=lending",
    });
  });

  it("formats the alert sentence server-side so both clients read the same copy", async () => {
    mockAlerts.mockResolvedValue([
      {
        id: "alert-1",
        listingName: "Ladder",
        alertType: "overdue_return",
        userRole: "owner",
        deliveryRequested: false,
        daysLate: 2,
        otherPartyName: "Ada Lovelace",
        linkTo: "/dashboard/rental/r-1",
        severity: "error",
      },
    ]);

    const { GET } = await import("../route");
    const json = await (await GET(req())).json();

    const [alert] = json.alerts;
    // Structured fields survive for tone/icon; the sentence comes from the server.
    expect(alert.severity).toBe("error");
    expect(alert.alertType).toBe("overdue_return");
    expect(typeof alert.message).toBe("string");
    expect(alert.message.length).toBeGreaterThan(0);
    expect(alert.message).toContain("2 days");
  });
});
