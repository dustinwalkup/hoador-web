import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getUpcomingSchedule } from "../schedule";
import { rentalDAL } from "@/dal";

vi.mock("@/dal", () => ({
  rentalDAL: {
    getBorrowedListings: vi.fn(),
    getLendingRequestsByStatus: vi.fn(),
  },
}));

/** Fixed "today" for deterministic tests: 2026-03-15 14:00 local. */
const TODAY_NOON = new Date(2026, 2, 15, 14, 0, 0, 0);

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

  afterEach(() => {
    vi.useRealTimers();
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

  it("includes pickup and return when rental starts today (currentRentals)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY_NOON);
    const todayStart = new Date(2026, 2, 15, 0, 0, 0, 0);
    const tomorrowStart = new Date(2026, 2, 16, 0, 0, 0, 0);

    vi.mocked(rentalDAL.getBorrowedListings).mockResolvedValue({
      currentRentals: [
        {
          id: "req-current",
          listingName: "Mower",
          startDate: todayStart,
          endDate: tomorrowStart,
        } as any,
      ],
      upcomingRentals: [],
    });

    const result = await getUpcomingSchedule(userId);

    expect(
      result.some(
        (e) =>
          e.description.includes("Pickup") && e.description.includes("Mower"),
      ),
    ).toBe(true);
    expect(
      result.some(
        (e) =>
          e.description.includes("Return") && e.description.includes("Mower"),
      ),
    ).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("includes both pickup and return for same-day rental in currentRentals", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY_NOON);
    const todayMidnight = new Date(2026, 2, 15, 0, 0, 0, 0);

    vi.mocked(rentalDAL.getBorrowedListings).mockResolvedValue({
      currentRentals: [
        {
          id: "req-sameday",
          listingName: "Hammer",
          startDate: todayMidnight,
          endDate: todayMidnight,
        } as any,
      ],
      upcomingRentals: [],
    });

    const result = await getUpcomingSchedule(userId);

    expect(
      result.some(
        (e) =>
          e.description.includes("Pickup") && e.description.includes("Hammer"),
      ),
    ).toBe(true);
    expect(
      result.some(
        (e) =>
          e.description.includes("Return") && e.description.includes("Hammer"),
      ),
    ).toBe(true);
  });

  it("includes return on last day when rental ends today at midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY_NOON);
    const yesterdayStart = new Date(2026, 2, 14, 0, 0, 0, 0);
    const todayEnd = new Date(2026, 2, 15, 0, 0, 0, 0);

    vi.mocked(rentalDAL.getBorrowedListings).mockResolvedValue({
      currentRentals: [
        {
          id: "req-lastday",
          listingName: "Saw",
          startDate: yesterdayStart,
          endDate: todayEnd,
        } as any,
      ],
      upcomingRentals: [],
    });

    const result = await getUpcomingSchedule(userId);

    expect(
      result.some(
        (e) =>
          e.description.includes("Return") && e.description.includes("Saw"),
      ),
    ).toBe(true);
  });

  it("excludes owner active rental when return date is beyond 7-day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY_NOON);
    const returnIn10Days = new Date(2026, 2, 25, 0, 0, 0, 0);

    vi.mocked(rentalDAL.getLendingRequestsByStatus).mockImplementation(
      (status) => {
        if (status === "active") {
          return Promise.resolve([
            {
              id: "req-active-far",
              listingName: "Ladder",
              startDate: new Date(2026, 2, 15, 0, 0, 0, 0),
              endDate: returnIn10Days,
            } as any,
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const result = await getUpcomingSchedule(userId);

    expect(result.some((e) => e.description.includes("Ladder"))).toBe(false);
  });
});
