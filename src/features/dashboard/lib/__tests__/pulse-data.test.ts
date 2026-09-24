import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardPulseData } from "../pulse-data";

// Mock the entire DAL barrel — only stub what pulse-data.ts actually calls
vi.mock("@/dal", () => ({
  rentalDAL: {
    countSharedListings: vi.fn().mockResolvedValue(0),
  },
  listingDAL: {
    getInventoryUsage: vi
      .fn()
      .mockResolvedValue({ activeCount: 0, totalCount: 0, usagePercent: 0 }),
    getUserListingsByApprovalStatus: vi.fn().mockResolvedValue([]),
  },
  serviceListingDAL: {
    findByProvider: vi.fn().mockResolvedValue([]),
  },
  disputeDAL: {
    getUserDisputes: vi.fn().mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
  },
  neighborhoodNeedsDAL: {
    countOpenVisibleNeeds: vi.fn().mockResolvedValue(0),
  },
  communityDAL: {
    getVisibleCommunityIds: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../cached-fetchers", () => ({
  getBorrowedListingsCached: vi
    .fn()
    .mockResolvedValue({ currentRentals: [], upcomingRentals: [] }),
  getLendingRequestsByStatusCached: vi.fn().mockResolvedValue([]),
  getActionableAlertsCached: vi.fn().mockResolvedValue([]),
  findServiceBookingsByProviderCached: vi.fn().mockResolvedValue([]),
}));

vi.mock("../schedule", () => ({
  getUpcomingSchedule: vi.fn().mockResolvedValue([]),
}));

// Import the mocks after vi.mock declarations
import { neighborhoodNeedsDAL, communityDAL, serviceListingDAL } from "@/dal";
import {
  getBorrowedListingsCached,
  getLendingRequestsByStatusCached,
  getActionableAlertsCached,
  findServiceBookingsByProviderCached,
} from "../cached-fetchers";
import { getUpcomingSchedule } from "../schedule";

const USER_ID = "user-abc-123";

describe("getDashboardPulseData — needs section", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to safe defaults
    vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue([]);
    vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockResolvedValue(0);
  });

  it("returns needs.open = 0 when there are no open needs", async () => {
    vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue([
      "comm-1",
    ]);
    vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockResolvedValue(0);

    const result = await getDashboardPulseData(USER_ID);

    expect(result.needs.open).toBe(0);
  });

  it("returns needs.open matching the count from countOpenVisibleNeeds", async () => {
    vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue([
      "comm-1",
      "comm-2",
    ]);
    vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockResolvedValue(5);

    const result = await getDashboardPulseData(USER_ID);

    expect(result.needs.open).toBe(5);
  });

  it("calls getVisibleCommunityIds with the user id", async () => {
    vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue([]);
    vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockResolvedValue(0);

    await getDashboardPulseData(USER_ID);

    expect(communityDAL.getVisibleCommunityIds).toHaveBeenCalledWith(USER_ID);
  });

  it("passes the visible community ids to countOpenVisibleNeeds", async () => {
    const communityIds = ["comm-a", "comm-b", "comm-c"];
    vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue(
      communityIds,
    );
    vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockResolvedValue(3);

    await getDashboardPulseData(USER_ID);

    expect(neighborhoodNeedsDAL.countOpenVisibleNeeds).toHaveBeenCalledWith(
      communityIds,
    );
  });

  it("falls back to needs.open = 0 when communityDAL throws", async () => {
    vi.mocked(communityDAL.getVisibleCommunityIds).mockRejectedValue(
      new Error("DB unavailable"),
    );
    // countOpenVisibleNeeds will receive [] from the safe() fallback
    vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockResolvedValue(0);

    const result = await getDashboardPulseData(USER_ID);

    expect(result.needs.open).toBe(0);
  });

  it("falls back to needs.open = 0 when countOpenVisibleNeeds throws", async () => {
    vi.mocked(communityDAL.getVisibleCommunityIds).mockResolvedValue([
      "comm-1",
    ]);
    vi.mocked(neighborhoodNeedsDAL.countOpenVisibleNeeds).mockRejectedValue(
      new Error("DB unavailable"),
    );

    const result = await getDashboardPulseData(USER_ID);

    expect(result.needs.open).toBe(0);
  });

  it("includes the needs key in the overall return shape", async () => {
    const result = await getDashboardPulseData(USER_ID);

    expect(result).toHaveProperty("needs");
    expect(result.needs).toHaveProperty("open");
  });
});

// PERF-01: the summary route fetches these once and shares them with the
// schedule and the activity feed; pulse must not fetch them again.
describe("getDashboardPulseData — prefetched sources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("derives its counts from the prefetched sources without re-querying", async () => {
    const result = await getDashboardPulseData(USER_ID, {
      pendingLendingRequests: Promise.resolve([{}, {}] as any),
      serviceBookingsAsProvider: [
        { status: "pending" },
        { status: "accepted" },
      ] as any,
      borrowed: Promise.resolve({
        currentRentals: [{}] as any,
        upcomingRentals: [],
      }),
      serviceListings: [{ status: "active" }, { status: "denied" }] as any,
      actionableAlerts: [
        { alertType: "overdue_return" },
        { alertType: "end_today" },
      ] as any,
      upcomingSchedule: Promise.resolve([
        { type: "pickup" },
        { type: "service" },
        { type: "service" },
      ] as any),
    });

    expect(result.action).toMatchObject({
      pendingRequests: 2,
      unconfirmedServices: 1,
      overdueReturns: 1,
      serviceListingRevisions: 1,
    });
    expect(result.active.borrowing).toBe(1);
    expect(result.upcoming).toEqual({
      rentals: 1,
      services: 2,
      pickupsToday: 1,
    });
    expect(result.listed.services).toBe(1);

    expect(getLendingRequestsByStatusCached).not.toHaveBeenCalled();
    expect(findServiceBookingsByProviderCached).not.toHaveBeenCalled();
    expect(getBorrowedListingsCached).not.toHaveBeenCalled();
    expect(getActionableAlertsCached).not.toHaveBeenCalled();
    expect(serviceListingDAL.findByProvider).not.toHaveBeenCalled();
    expect(getUpcomingSchedule).not.toHaveBeenCalled();
  });
});
