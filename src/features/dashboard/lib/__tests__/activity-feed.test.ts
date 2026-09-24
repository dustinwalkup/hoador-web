import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardActivityFeed } from "../activity-feed";
import {
  listingDAL,
  rentalDAL,
  serviceBookingDAL,
  serviceListingDAL,
} from "@/dal";

vi.mock("@/dal", () => ({
  rentalDAL: { getRecentRentalActivity: vi.fn() },
  listingDAL: { getUserListingsForFeed: vi.fn() },
  serviceBookingDAL: {
    findByRequesterForDashboard: vi.fn(),
    findByProviderForDashboard: vi.fn(),
  },
  serviceListingDAL: { findByProvider: vi.fn() },
}));

vi.mock("@/lib/utils/date.utils", () => ({
  formatDistanceToNow: (d: Date) => `relative-${d.getTime()}`,
}));

describe("getDashboardActivityFeed", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rentalDAL.getRecentRentalActivity).mockResolvedValue([]);
    vi.mocked(listingDAL.getUserListingsForFeed).mockResolvedValue([]);
    vi.mocked(serviceBookingDAL.findByRequesterForDashboard).mockResolvedValue(
      [],
    );
    vi.mocked(serviceBookingDAL.findByProviderForDashboard).mockResolvedValue(
      [],
    );
    vi.mocked(serviceListingDAL.findByProvider).mockResolvedValue([]);
  });

  it("should call DALs with correct userId and limit", async () => {
    await getDashboardActivityFeed(userId, 10);

    expect(rentalDAL.getRecentRentalActivity).toHaveBeenCalledWith(
      userId,
      expect.any(Number),
    );
    // The lean, capped listing read — not every listing with its images.
    expect(listingDAL.getUserListingsForFeed).toHaveBeenCalledWith(userId, 10);
    // Booking reads are capped at the feed's own fetch window.
    expect(serviceBookingDAL.findByRequesterForDashboard).toHaveBeenCalledWith(
      userId,
      { limit: 20 },
    );
    expect(serviceBookingDAL.findByProviderForDashboard).toHaveBeenCalledWith(
      userId,
      { limit: 20 },
    );
    expect(serviceListingDAL.findByProvider).toHaveBeenCalledWith(userId);
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

  it("should include service booking activity when present", async () => {
    const updatedAt = new Date("2025-01-15T12:00:00Z");
    vi.mocked(serviceBookingDAL.findByRequesterForDashboard).mockResolvedValue([
      {
        id: "sb-1",
        listingId: "sl-1",
        requesterId: userId,
        providerId: "other",
        communityId: "c1",
        proposedDate: "2025-01-20",
        proposedTime: "10:00",
        servicePrice: "100",
        serviceFee: "10",
        totalAmount: "110",
        status: "pending",
        createdAt: updatedAt,
        updatedAt,
        listingTitle: "Lawn mowing",
        counterparty: {} as any,
      } as any,
    ]);

    const result = await getDashboardActivityFeed(userId, 10);

    expect(result.some((i) => i.id === "service-booking-sb-1")).toBe(true);
    const row = result.find((i) => i.id === "service-booking-sb-1");
    expect(row).toMatchObject({
      title: "Service booking requested",
      description: "Lawn mowing",
      linkTo: "/dashboard/services/bookings/sb-1",
    });
  });

  it("renders listing updates from the lean feed query", async () => {
    const updatedAt = new Date("2025-01-15T12:00:00Z");
    vi.mocked(listingDAL.getUserListingsForFeed).mockResolvedValue([
      { id: "l-1", name: "Pressure washer", updatedAt },
    ]);

    const result = await getDashboardActivityFeed(userId, 10);

    expect(result).toEqual([
      expect.objectContaining({
        id: "listing-l-1",
        title: "Listing updated",
        description: "Pressure washer",
        timestamp: updatedAt,
        linkTo: "/dashboard/listings/l-1/edit",
      }),
    ]);
  });

  // PERF-01: the summary route shares these with pulse and the schedule.
  it("uses prefetched sources instead of querying them again", async () => {
    const updatedAt = new Date("2025-01-15T12:00:00Z");
    const result = await getDashboardActivityFeed(userId, 10, {
      serviceBookingsAsRequester: Promise.resolve([]),
      serviceBookingsAsProvider: [
        {
          id: "sb-2",
          status: "pending",
          updatedAt,
          listingTitle: "Gutter cleaning",
        } as any,
      ],
      serviceListingsOwned: [],
    });

    expect(result.map((i) => [i.id, i.title])).toEqual([
      ["service-booking-sb-2", "New service booking request"],
    ]);
    expect(
      serviceBookingDAL.findByRequesterForDashboard,
    ).not.toHaveBeenCalled();
    expect(serviceBookingDAL.findByProviderForDashboard).not.toHaveBeenCalled();
    expect(serviceListingDAL.findByProvider).not.toHaveBeenCalled();
  });
});
