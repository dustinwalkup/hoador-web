import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUpcomingSchedule } from "../schedule";
import { rentalDAL } from "@/dal";

vi.mock("@/dal", () => ({
  rentalDAL: {
    getBorrowedListings: vi.fn(),
    getLendingRequestsByStatus: vi.fn(),
  },
}));

describe("getUpcomingSchedule", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rentalDAL.getBorrowedListings).mockResolvedValue({
      currentRentals: [],
      upcomingRentals: [],
    });
    vi.mocked(rentalDAL.getLendingRequestsByStatus).mockResolvedValue([]);
  });

  it("should call DALs with correct userId", async () => {
    await getUpcomingSchedule(userId);

    expect(rentalDAL.getBorrowedListings).toHaveBeenCalledWith(userId);
    expect(rentalDAL.getLendingRequestsByStatus).toHaveBeenCalledWith(
      "approved",
      userId,
    );
    expect(rentalDAL.getLendingRequestsByStatus).toHaveBeenCalledWith(
      "active",
      userId,
    );
  });

  it("should return schedule entries for returns and pickups in next 7 days", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    vi.mocked(rentalDAL.getBorrowedListings).mockResolvedValue({
      currentRentals: [],
      upcomingRentals: [
        {
          id: "req-1",
          listingName: "Drill",
          startDate: tomorrow,
          endDate: new Date(tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000),
        } as any,
      ],
    });

    const result = await getUpcomingSchedule(userId);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((e) => e.description.includes("Pickup"))).toBe(true);
    expect(result.some((e) => e.description.includes("Drill"))).toBe(true);
    expect(result.every((e) => e.linkTo?.includes("/dashboard/rental/"))).toBe(
      true,
    );
  });

  it("should return empty array when no borrowed or lending activity", async () => {
    const result = await getUpcomingSchedule(userId);
    expect(result).toEqual([]);
  });
});
