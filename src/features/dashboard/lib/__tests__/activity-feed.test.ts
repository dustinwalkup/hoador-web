import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardActivityFeed } from "../activity-feed";
import { rentalDAL, reviewDAL, listingDAL } from "@/dal";

vi.mock("@/dal", () => ({
  rentalDAL: { getRecentRentalActivity: vi.fn() },
  reviewDAL: { getRecentReviews: vi.fn() },
  listingDAL: { getUserListings: vi.fn() },
}));

vi.mock("@/lib/utils/date.utils", () => ({
  formatDistanceToNow: (d: Date) => `relative-${d.getTime()}`,
}));

describe("getDashboardActivityFeed", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rentalDAL.getRecentRentalActivity).mockResolvedValue([]);
    vi.mocked(reviewDAL.getRecentReviews).mockResolvedValue([]);
    vi.mocked(listingDAL.getUserListings).mockResolvedValue([]);
  });

  it("should call DALs with correct userId and limit", async () => {
    await getDashboardActivityFeed(userId, 10);

    expect(rentalDAL.getRecentRentalActivity).toHaveBeenCalledWith(
      userId,
      expect.any(Number),
    );
    expect(reviewDAL.getRecentReviews).toHaveBeenCalledWith(userId, {
      limit: expect.any(Number),
    });
    expect(listingDAL.getUserListings).toHaveBeenCalledWith(userId);
  });

  it("should return ActivityFeedItem shape with title, relativeTime, linkTo", async () => {
    const now = new Date();
    vi.mocked(rentalDAL.getRecentRentalActivity).mockResolvedValue([
      {
        id: "r1",
        listingName: "Drill",
        role: "renter",
        status: "approved",
        updatedAt: now,
        linkTo: "/dashboard/rental/r1",
      } as any,
    ]);

    const result = await getDashboardActivityFeed(userId, 10);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "rental-r1",
      title: expect.any(String),
      description: "Drill",
      timestamp: now,
      relativeTime: expect.any(String),
      linkTo: "/dashboard/rental/r1",
    });
  });

  it("should return empty array when no activity", async () => {
    const result = await getDashboardActivityFeed(userId, 10);
    expect(result).toEqual([]);
  });
});
