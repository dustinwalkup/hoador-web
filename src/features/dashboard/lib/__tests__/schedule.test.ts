import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getUpcomingSchedule } from "../schedule";
import { rentalDAL, serviceBookingDAL } from "@/dal";

vi.mock("@/dal", () => ({
  rentalDAL: {
    getBorrowedListings: vi.fn(),
    getLendingRequestsByStatus: vi.fn(),
  },
  serviceBookingDAL: {
    findByRequesterForDashboard: vi.fn(),
    findByProviderForDashboard: vi.fn(),
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
    vi.mocked(serviceBookingDAL.findByRequesterForDashboard).mockResolvedValue(
      [],
    );
    vi.mocked(serviceBookingDAL.findByProviderForDashboard).mockResolvedValue(
      [],
    );
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
    expect(serviceBookingDAL.findByRequesterForDashboard).toHaveBeenCalledWith(
      userId,
    );
    expect(serviceBookingDAL.findByProviderForDashboard).toHaveBeenCalledWith(
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
          ownerName: "Alex Owner",
          deliveryRequested: false,
          startDate: tomorrow,
          endDate: new Date(tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000),
        } as any,
      ],
    });

    const result = await getUpcomingSchedule(userId);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((e) => e.description.includes("Pickup from"))).toBe(
      true,
    );
    expect(result.some((e) => e.subtitle === "Drill")).toBe(true);
    expect(
      result.every(
        (e) =>
          e.linkTo?.includes("/dashboard/rental/") ||
          e.linkTo?.includes("/dashboard/services/bookings/"),
      ),
    ).toBe(true);
  });

  it("includes accepted service bookings within the window with roles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY_NOON);

    vi.mocked(serviceBookingDAL.findByRequesterForDashboard).mockResolvedValue([
      {
        id: "sb-client",
        listingId: "list-1",
        requesterId: userId,
        providerId: "prov-1",
        communityId: "c1",
        proposedDate: "2026-03-16",
        proposedTime: "10:00",
        hours: null,
        notes: null,
        declineReason: null,
        servicePrice: "50.00",
        serviceFee: "5.00",
        totalAmount: "55.00",
        status: "accepted",
        stripePaymentIntentId: "pi_1",
        stripeChargeId: "ch_1",
        paymentStatus: "succeeded",
        refundAmount: null,
        stripeRefundId: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        completedAt: null,
        selectedPaymentMethodId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        listingTitle: "Lawn care",
        counterparty: {
          id: "prov-1",
          firstName: "Jane",
          lastName: "Provider",
          profileImageUrl: null,
          email: "j@example.com",
        },
      },
    ]);
    vi.mocked(serviceBookingDAL.findByProviderForDashboard).mockResolvedValue([
      {
        id: "sb-prov",
        listingId: "list-2",
        requesterId: "req-1",
        providerId: userId,
        communityId: "c1",
        proposedDate: "2026-03-17",
        proposedTime: "14:00",
        hours: null,
        notes: null,
        declineReason: null,
        servicePrice: "80.00",
        serviceFee: "8.00",
        totalAmount: "88.00",
        status: "accepted",
        stripePaymentIntentId: "pi_2",
        stripeChargeId: "ch_2",
        paymentStatus: "succeeded",
        refundAmount: null,
        stripeRefundId: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        completedAt: null,
        selectedPaymentMethodId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        listingTitle: "Gutter clean",
        counterparty: {
          id: "req-1",
          firstName: "Sam",
          lastName: "Client",
          profileImageUrl: null,
          email: "s@example.com",
        },
      },
    ]);

    const result = await getUpcomingSchedule(userId);

    const clientEntry = result.find((e) => e.id === "service-sb-client");
    const providerEntry = result.find((e) => e.id === "service-sb-prov");
    expect(clientEntry?.role).toBe("client");
    expect(clientEntry?.description).toBe("Service with Jane Provider");
    expect(clientEntry?.subtitle).toBe("Lawn care");
    expect(clientEntry?.linkTo).toBe("/dashboard/services/bookings/sb-client");
    expect(providerEntry?.role).toBe("provider");
    expect(providerEntry?.description).toBe("Service for Sam Client");
    expect(providerEntry?.subtitle).toBe("Gutter clean");
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
          ownerName: "Lisa Owner",
          deliveryRequested: false,
          startDate: todayStart,
          endDate: tomorrowStart,
        } as any,
      ],
      upcomingRentals: [],
    });

    const result = await getUpcomingSchedule(userId);

    expect(
      result.some(
        (e) => e.description.includes("Pickup from") && e.subtitle === "Mower",
      ),
    ).toBe(true);
    expect(
      result.some(
        (e) => e.description.includes("Return to") && e.subtitle === "Mower",
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
          ownerName: "Pat Owner",
          deliveryRequested: false,
          startDate: todayMidnight,
          endDate: todayMidnight,
        } as any,
      ],
      upcomingRentals: [],
    });

    const result = await getUpcomingSchedule(userId);

    expect(
      result.some(
        (e) => e.description.includes("Pickup from") && e.subtitle === "Hammer",
      ),
    ).toBe(true);
    expect(
      result.some(
        (e) => e.description.includes("Return to") && e.subtitle === "Hammer",
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
          ownerName: "Chris Owner",
          deliveryRequested: false,
          startDate: yesterdayStart,
          endDate: todayEnd,
        } as any,
      ],
      upcomingRentals: [],
    });

    const result = await getUpcomingSchedule(userId);

    expect(
      result.some(
        (e) => e.description.includes("Return to") && e.subtitle === "Saw",
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
              renterName: "Riley Renter",
              deliveryRequested: false,
              startDate: new Date(2026, 2, 15, 0, 0, 0, 0),
              endDate: returnIn10Days,
            } as any,
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const result = await getUpcomingSchedule(userId);

    expect(result.some((e) => e.subtitle === "Ladder")).toBe(false);
  });
});
