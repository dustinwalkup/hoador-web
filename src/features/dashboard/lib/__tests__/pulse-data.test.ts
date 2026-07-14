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
import { neighborhoodNeedsDAL, communityDAL } from "@/dal";

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
