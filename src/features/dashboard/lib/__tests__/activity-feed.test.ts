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
  listingDAL: { getUserListings: vi.fn() },
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
    vi.mocked(listingDAL.getUserListings).mockResolvedValue([]);
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
    expect(listingDAL.getUserListings).toHaveBeenCalledWith(userId);
    expect(serviceBookingDAL.findByRequesterForDashboard).toHaveBeenCalledWith(
      userId,
    );
    expect(serviceBookingDAL.findByProviderForDashboard).toHaveBeenCalledWith(
      userId,
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
});
