import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

/**
 * PERF-01. Unlike `route.test.ts`, this runs the REAL dashboard helpers
 * (pulse, schedule, activity feed, cached fetchers) under the route and mocks
 * only the DAL, so it sees every DB read one request makes. `cache()` doesn't
 * dedupe outside an RSC render, which is what made the route query provider
 * bookings 5x and requester bookings / borrowed listings 3x per request.
 */

const mockGetCurrentUser = vi.fn();

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserId: async () => (await mockGetCurrentUser())?.id ?? null,
  getAuthenticatedUser: async () => {
    const user = await mockGetCurrentUser();
    if (!user) return null;
    return { user, userId: user.id, isAdmin: false };
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

vi.mock("@/dal", () => ({
  rentalDAL: {
    getBorrowedListings: vi.fn(),
    getLendingRequestsByStatus: vi.fn(),
    getActionableAlerts: vi.fn(),
    countSharedListings: vi.fn(),
    getRecentRentalActivity: vi.fn(),
  },
  listingDAL: {
    getInventoryUsage: vi.fn(),
    getUserListingsByApprovalStatus: vi.fn(),
    getUserListingsForFeed: vi.fn(),
  },
  serviceListingDAL: { findByProvider: vi.fn() },
  serviceBookingDAL: {
    findByRequesterForDashboard: vi.fn(),
    findByProviderForDashboard: vi.fn(),
  },
  disputeDAL: { getUserDisputes: vi.fn() },
  neighborhoodNeedsDAL: { countOpenVisibleNeeds: vi.fn() },
  communityDAL: { getVisibleCommunityIds: vi.fn() },
  messagesDAL: { getUnreadMessageCount: vi.fn() },
}));

import {
  communityDAL,
  disputeDAL,
  listingDAL,
  neighborhoodNeedsDAL,
  rentalDAL,
  serviceBookingDAL,
  serviceListingDAL,
} from "@/dal";

const USER_ID = "user-1";

/** Local `YYYY-MM-DD` `days` from today — inside the schedule's 7-day window. */
function localDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function booking(overrides: Record<string, unknown>) {
  const at = new Date("2026-09-20T12:00:00Z");
  return {
    id: "sb-1",
    status: "pending",
    proposedDate: localDay(2),
    proposedTime: "10:00",
    createdAt: at,
    updatedAt: at,
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

function seedDal() {
  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const inFourDays = new Date();
  inFourDays.setDate(inFourDays.getDate() + 4);

  vi.mocked(rentalDAL.getBorrowedListings).mockResolvedValue({
    currentRentals: [],
    upcomingRentals: [
      {
        id: "req-b",
        listingName: "Drill",
        ownerName: "Alex Owner",
        status: "approved",
        deliveryRequested: false,
        startDate: inTwoDays,
        endDate: inFourDays,
      },
    ],
  } as any);
  vi.mocked(rentalDAL.getLendingRequestsByStatus).mockImplementation(
    async (status) =>
      status === "pending"
        ? ([
            {
              id: "req-p",
              listingName: "Pressure washer",
              renterName: "Alan Turing",
            },
          ] as any)
        : [],
  );
  vi.mocked(rentalDAL.getActionableAlerts).mockResolvedValue([
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
  ] as any);
  vi.mocked(rentalDAL.countSharedListings).mockResolvedValue(1);
  vi.mocked(rentalDAL.getRecentRentalActivity).mockResolvedValue([
    {
      id: "r-1",
      listingName: "Drill",
      role: "renter",
      status: "approved",
      updatedAt: new Date("2026-09-21T12:00:00Z"),
      linkTo: "/dashboard/rental/r-1",
    },
  ] as any);
  vi.mocked(listingDAL.getInventoryUsage).mockResolvedValue({
    activeCount: 2,
    totalCount: 3,
    usagePercent: 66,
  } as any);
  vi.mocked(listingDAL.getUserListingsByApprovalStatus).mockResolvedValue([]);
  vi.mocked(listingDAL.getUserListingsForFeed).mockResolvedValue([
    { id: "l-1", name: "Ladder", updatedAt: new Date("2026-09-19T12:00:00Z") },
  ]);
  vi.mocked(serviceListingDAL.findByProvider).mockResolvedValue([
    {
      id: "sl-1",
      title: "Lawn mowing",
      status: "active",
      updatedAt: new Date("2026-09-18T12:00:00Z"),
    },
  ] as any);
  vi.mocked(serviceBookingDAL.findByRequesterForDashboard).mockResolvedValue(
    [],
  );
  vi.mocked(serviceBookingDAL.findByProviderForDashboard).mockResolvedValue([
    booking({ id: "sb-pending" }),
    booking({ id: "sb-accepted", status: "accepted" }),
  ] as any);
  vi.mocked(disputeDAL.getUserDisputes).mockResolvedValue({
    data: [],
    pagination: {},
  } as any);
  vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue(["c-1"]);
  vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockResolvedValue(3);
}

async function getSummary() {
  const { GET } = await import("../route");
  const res = await GET(
    new NextRequest("http://localhost/api/dashboard/summary"),
  );
  expect(res.status).toBe(200);
  return res.json();
}

/**
 * Hand copy of `dashboardSummarySchema` from
 * hoador-mobile/src/api/contract/dashboard.contract.ts (the app parses this
 * response with it). `tolerantEnum` → string; `wallClockSchema` → YYYY-MM-DD.
 * Strict where the route builds the object itself, so an added or dropped
 * field fails here. Alerts stay loose: the route spreads the DAL row into them
 * and the app strips the extra keys.
 */
const pendingRequest = z.strictObject({
  id: z.string(),
  listingName: z.string(),
  requesterName: z.string(),
  statusText: z.string(),
  detailUrl: z.string(),
});
const mobileSummarySchema = z.strictObject({
  pulse: z.strictObject({
    action: z.strictObject({
      pendingRequests: z.number(),
      overdueReturns: z.number(),
      overdueServices: z.number(),
      unconfirmedServices: z.number(),
      rentalListingRevisions: z.number(),
      serviceListingRevisions: z.number(),
    }),
    active: z.strictObject({
      borrowing: z.number(),
      lending: z.number(),
      disputes: z.number(),
    }),
    upcoming: z.strictObject({
      rentals: z.number(),
      services: z.number(),
      pickupsToday: z.number().optional(),
    }),
    listed: z.strictObject({ tools: z.number(), services: z.number() }),
    needs: z.strictObject({ open: z.number() }),
  }),
  pendingRequests: z.strictObject({
    rentals: z.array(pendingRequest),
    rentalTotal: z.number(),
    services: z.array(pendingRequest),
    serviceTotal: z.number(),
  }),
  alerts: z.array(
    z.object({
      id: z.string(),
      listingName: z.string(),
      alertType: z.string(),
      userRole: z.string(),
      otherPartyName: z.string(),
      daysLate: z.number().optional(),
      severity: z.string(),
      linkTo: z.string(),
      message: z.string(),
    }),
  ),
  upcomingSchedule: z.array(
    z.strictObject({
      id: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string(),
      subtitle: z.string().optional(),
      linkTo: z.string().optional(),
      type: z.string(),
      role: z.string(),
      deliveryRequested: z.boolean().optional(),
      setupRequested: z.boolean().optional(),
    }),
  ),
  activity: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      timestamp: z.iso.datetime({ offset: true }),
      relativeTime: z.string(),
      linkTo: z.string().optional(),
    }),
  ),
});

describe("GET /api/dashboard/summary — shared sources (PERF-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: USER_ID, userType: "user" });
    seedDal();
  });

  it("reads each source exactly once per request", async () => {
    await getSummary();

    // Were 5x, 3x and 3x before the route shared them.
    expect(serviceBookingDAL.findByProviderForDashboard).toHaveBeenCalledTimes(
      1,
    );
    expect(serviceBookingDAL.findByRequesterForDashboard).toHaveBeenCalledTimes(
      1,
    );
    expect(rentalDAL.getBorrowedListings).toHaveBeenCalledTimes(1);
    // One read per status, not two of each.
    expect(
      vi
        .mocked(rentalDAL.getLendingRequestsByStatus)
        .mock.calls.map(([status]) => status)
        .sort(),
    ).toEqual(["active", "approved", "pending"]);
    expect(rentalDAL.getActionableAlerts).toHaveBeenCalledTimes(1);
    expect(serviceListingDAL.findByProvider).toHaveBeenCalledTimes(1);
    for (const fn of [
      rentalDAL.countSharedListings,
      rentalDAL.getRecentRentalActivity,
      listingDAL.getInventoryUsage,
      listingDAL.getUserListingsByApprovalStatus,
      listingDAL.getUserListingsForFeed,
      disputeDAL.getUserDisputes,
      communityDAL.getVisibleCommunityIds,
      neighborhoodNeedsDAL.countOpenVisibleNeeds,
    ]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("bounds the booking reads and the listing feed read", async () => {
    await getSummary();

    expect(serviceBookingDAL.findByProviderForDashboard).toHaveBeenCalledWith(
      USER_ID,
      { limit: 100 },
    );
    expect(serviceBookingDAL.findByRequesterForDashboard).toHaveBeenCalledWith(
      USER_ID,
      { limit: 100 },
    );
    expect(listingDAL.getUserListingsForFeed).toHaveBeenCalledWith(USER_ID, 10);
  });

  it("keeps the response the mobile contract parses", async () => {
    const json = await getSummary();

    expect(() => mobileSummarySchema.parse(json)).not.toThrow();

    // Each section is really built from the shared sources, not a fallback.
    expect(json.pulse.action).toMatchObject({
      pendingRequests: 1,
      overdueReturns: 1,
      unconfirmedServices: 1,
    });
    expect(json.pulse.upcoming).toMatchObject({ rentals: 2, services: 1 });
    expect(json.pulse.needs.open).toBe(3);
    expect(json.pendingRequests).toMatchObject({
      rentalTotal: 1,
      serviceTotal: 1,
    });
    expect(json.upcomingSchedule.map((e: { id: string }) => e.id)).toEqual(
      expect.arrayContaining([
        "rental-req-b-pickup-renter",
        "rental-req-b-return-renter",
        "service-sb-accepted",
      ]),
    );
    expect(json.activity.map((a: { id: string }) => a.id)).toEqual(
      expect.arrayContaining([
        "rental-r-1",
        "listing-l-1",
        "service-booking-sb-pending",
        "service-listing-sl-1",
      ]),
    );
  });
});
