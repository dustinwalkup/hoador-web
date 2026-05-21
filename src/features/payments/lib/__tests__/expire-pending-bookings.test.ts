import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  findPendingExpiredRequestsMock,
  markRequestExpiredMock,
  findPendingExpiredServiceMock,
  markServiceExpiredMock,
  getUserByIdMock,
  releaseDepositHoldMock,
  sendNotificationMock,
  logGatingEventMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  findPendingExpiredRequestsMock: vi.fn(),
  markRequestExpiredMock: vi.fn(),
  findPendingExpiredServiceMock: vi.fn(),
  markServiceExpiredMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  releaseDepositHoldMock: vi.fn(),
  sendNotificationMock: vi.fn(),
  logGatingEventMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/dal", () => ({
  rentalDAL: {
    findPendingExpiredRequests: findPendingExpiredRequestsMock,
    markRequestExpired: markRequestExpiredMock,
  },
  serviceBookingDAL: {
    findPendingExpired: findPendingExpiredServiceMock,
    markExpired: markServiceExpiredMock,
  },
  userDAL: {
    getUserById: getUserByIdMock,
  },
}));

vi.mock("@/services/stripe/deposit-hold", () => ({
  releaseDepositHold: releaseDepositHoldMock,
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: sendNotificationMock,
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    error: loggerErrorMock,
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("../log-events", () => ({
  logGatingEvent: logGatingEventMock,
}));

import { expirePendingBookings } from "../expire-pending-bookings";

const RENTAL_ROW = {
  id: "rental-1",
  renterId: "renter-1",
  ownerId: "owner-1",
  listingId: "listing-1",
  listingName: "Power Washer",
  securityDepositAuthId: "pi_dep_123",
};

const SERVICE_ROW = {
  id: "svc-1",
  requesterId: "requester-1",
  providerId: "provider-1",
  listingId: "svc-listing-1",
  listingTitle: "Lawn Mowing",
};

const VERIFIED_USER = {
  stripeConnectedAccountId: "acct_1",
  connectChargesEnabled: true,
  connectPayoutsEnabled: true,
  connectOnboardingComplete: true,
};

const PENDING_USER = {
  stripeConnectedAccountId: "acct_2",
  connectChargesEnabled: false,
  connectPayoutsEnabled: false,
  connectOnboardingComplete: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  findPendingExpiredRequestsMock.mockResolvedValue([]);
  findPendingExpiredServiceMock.mockResolvedValue([]);
  markRequestExpiredMock.mockResolvedValue(true);
  markServiceExpiredMock.mockResolvedValue(true);
  getUserByIdMock.mockResolvedValue(VERIFIED_USER);
  releaseDepositHoldMock.mockResolvedValue(undefined);
  sendNotificationMock.mockResolvedValue({ success: true });
});

describe("expirePendingBookings", () => {
  it("returns zero counts when no rows are eligible", async () => {
    const result = await expirePendingBookings();

    expect(result).toEqual({
      rentalsChecked: 0,
      servicesChecked: 0,
      expiredCount: 0,
      failedCount: 0,
    });
    expect(markRequestExpiredMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("expires a pending rental: marks cancelled, releases hold, notifies both parties", async () => {
    findPendingExpiredRequestsMock.mockResolvedValue([RENTAL_ROW]);
    getUserByIdMock.mockResolvedValue(VERIFIED_USER);

    const result = await expirePendingBookings();

    expect(result.expiredCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(markRequestExpiredMock).toHaveBeenCalledWith("rental-1");
    expect(releaseDepositHoldMock).toHaveBeenCalledWith("pi_dep_123");
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);

    const calls = sendNotificationMock.mock.calls.map((c) => c[0]);
    const renterCall = calls.find((c) => c.userId === "renter-1");
    expect(renterCall).toMatchObject({
      type: "rental_cancelled",
      title: "Rental request expired",
    });
    expect(renterCall?.message).toContain("Power Washer");
    expect(renterCall?.message).toContain("did not respond in time");
    expect(renterCall?.message).not.toMatch(/Stripe|payout|connect/i);

    const ownerCall = calls.find((c) => c.userId === "owner-1");
    expect(ownerCall?.message).not.toMatch(/Set up your payout account/);
    expect(ownerCall?.linkUrl).toBe("/dashboard/rental/rental-1");

    expect(logGatingEventMock).not.toHaveBeenCalled();
  });

  it("includes a soft payout prompt and logs the gating event when the owner is not payout-ready", async () => {
    findPendingExpiredRequestsMock.mockResolvedValue([RENTAL_ROW]);
    getUserByIdMock.mockResolvedValue(PENDING_USER);

    await expirePendingBookings();

    const ownerCall = sendNotificationMock.mock.calls
      .map((c) => c[0])
      .find((c) => c.userId === "owner-1");
    expect(ownerCall?.message).toContain("Set up your payout account");
    expect(ownerCall?.linkUrl).toBe("/dashboard/payments/earnings-and-payouts");

    expect(logGatingEventMock).toHaveBeenCalledWith(
      "pending_booking_expired_owner_not_ready",
      expect.objectContaining({
        userId: "owner-1",
        bookingType: "rental",
        bookingId: "rental-1",
        onboardingStatus: "pending",
      }),
    );

    const renterCall = sendNotificationMock.mock.calls
      .map((c) => c[0])
      .find((c) => c.userId === "renter-1");
    expect(renterCall?.message).not.toMatch(/Stripe|payout|connect/i);
  });

  it("skips deposit release for a rental with no securityDepositAuthId", async () => {
    findPendingExpiredRequestsMock.mockResolvedValue([
      { ...RENTAL_ROW, securityDepositAuthId: null },
    ]);

    await expirePendingBookings();

    expect(releaseDepositHoldMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it("counts the row as expired but logs an error when deposit release fails", async () => {
    findPendingExpiredRequestsMock.mockResolvedValue([RENTAL_ROW]);
    releaseDepositHoldMock.mockRejectedValueOnce(new Error("stripe boom"));

    const result = await expirePendingBookings();

    expect(result.expiredCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(loggerErrorMock).toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it("does not double-expire: when markRequestExpired returns false the row is skipped", async () => {
    findPendingExpiredRequestsMock.mockResolvedValue([RENTAL_ROW]);
    markRequestExpiredMock.mockResolvedValueOnce(false);

    const result = await expirePendingBookings();

    expect(result.expiredCount).toBe(0);
    expect(releaseDepositHoldMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("isolates per-row failures so one bad row does not stop the batch", async () => {
    findPendingExpiredRequestsMock.mockResolvedValue([
      { ...RENTAL_ROW, id: "rental-a" },
      { ...RENTAL_ROW, id: "rental-b" },
    ]);
    markRequestExpiredMock.mockImplementation(async (id: string) => {
      if (id === "rental-a") throw new Error("db fail");
      return true;
    });

    const result = await expirePendingBookings();

    expect(result.rentalsChecked).toBe(2);
    expect(result.expiredCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it("expires service bookings: notifies both parties, no deposit release", async () => {
    findPendingExpiredServiceMock.mockResolvedValue([SERVICE_ROW]);
    getUserByIdMock.mockResolvedValue(VERIFIED_USER);

    const result = await expirePendingBookings();

    expect(result.expiredCount).toBe(1);
    expect(markServiceExpiredMock).toHaveBeenCalledWith("svc-1");
    expect(releaseDepositHoldMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);

    const renterCall = sendNotificationMock.mock.calls
      .map((c) => c[0])
      .find((c) => c.userId === "requester-1");
    expect(renterCall).toMatchObject({
      type: "service_booking_declined",
    });
    expect(renterCall?.message).toContain("Lawn Mowing");
    expect(renterCall?.message).not.toMatch(/Stripe|payout|connect/i);
  });

  it("logs soft-prompt gating event for service bookings when provider is not payout-ready", async () => {
    findPendingExpiredServiceMock.mockResolvedValue([SERVICE_ROW]);
    getUserByIdMock.mockResolvedValue(PENDING_USER);

    await expirePendingBookings();

    expect(logGatingEventMock).toHaveBeenCalledWith(
      "pending_booking_expired_owner_not_ready",
      expect.objectContaining({
        userId: "provider-1",
        bookingType: "service",
        bookingId: "svc-1",
        onboardingStatus: "pending",
      }),
    );

    const providerCall = sendNotificationMock.mock.calls
      .map((c) => c[0])
      .find((c) => c.userId === "provider-1");
    expect(providerCall?.message).toContain("Set up your payout account");
    expect(providerCall?.linkUrl).toBe(
      "/dashboard/payments/earnings-and-payouts",
    );
  });

  it("uses the provided `now` to drive both DAL queries", async () => {
    const now = new Date("2026-05-18T10:00:00Z");
    await expirePendingBookings(now);
    expect(findPendingExpiredRequestsMock).toHaveBeenCalledWith(now);
    expect(findPendingExpiredServiceMock).toHaveBeenCalledWith(now);
  });
});
