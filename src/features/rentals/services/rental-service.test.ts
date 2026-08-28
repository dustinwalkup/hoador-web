import { describe, it, expect, vi, beforeEach } from "vitest";
import { RentalService } from "./rental-service";
import type { CreateRentalRequestFormData } from "@/features/rentals/lib/form-schema";
import { NotFoundError } from "@/dal/errors";

const mockInsertRentalRequest = vi.fn();
const mockGetListingById = vi.fn();
const mockGetRentalRequestById = vi.fn();
const mockGetUserById = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockLegalGetAllCurrentVersions = vi.fn();
const mockLegalRecordAcceptance = vi.fn();
const mockTrackActivity = vi.fn();

const mockGetBookedDatesForListing = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: {
    getListingById: (...args: unknown[]) => mockGetListingById(...args),
  },
  rentalDAL: {
    insertRentalRequest: (...args: unknown[]) =>
      mockInsertRentalRequest(...args),
    getRentalRequestById: (...args: unknown[]) =>
      mockGetRentalRequestById(...args),
    getBookedDatesForListing: (...args: unknown[]) =>
      mockGetBookedDatesForListing(...args),
  },
  userDAL: {
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
  },
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditLogCreate(...args),
  },
  legalDocumentDAL: {
    getAllCurrentVersions: (...args: unknown[]) =>
      mockLegalGetAllCurrentVersions(...args),
    recordAcceptance: (...args: unknown[]) =>
      mockLegalRecordAcceptance(...args),
  },
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: (...args: unknown[]) => mockTrackActivity(...args),
}));

vi.mock("@/features/rentals/notifications/rental-request-created", () => ({
  sendRentalRequestCreatedNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  chargeRentalPayment: vi.fn(),
  authorizeSecurityDeposit: vi.fn(),
  getPaymentErrorMessage: vi.fn((err: unknown) => (err as Error)?.message),
  isRetryablePaymentError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {},
}));

/**
 * Dates relative to today.
 *
 * These fixtures used to be pinned to Feb 2024 — harmless while creation had no
 * opinion about the past, and a landmine once it grew one (P-E8A-2b's no-past
 * rule). Relative dates make the suite time-independent rather than correct
 * until the next rule lands.
 */
const daysFromToday = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

const validFormData: CreateRentalRequestFormData = {
  listingId: "listing-123",
  startDate: daysFromToday(1),
  endDate: daysFromToday(5),
  deliveryRequested: false,
  setupRequested: false,
  setupFee: 0,
  paymentMethodId: "pm_test_123",
  message: "I need this",
};

const context = { ipAddress: "127.0.0.1", userAgent: "test" };

describe("RentalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetListingById.mockResolvedValue({
      id: "listing-123",
      owner: { id: "owner-123" },
      dailyRate: 15,
      weeklyRate: 90,
      monthlyRate: 400,
      deliveryFee: 10,
      setupFee: 20,
      securityDeposit: 50,
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
    });
    mockGetBookedDatesForListing.mockResolvedValue([]);
    mockInsertRentalRequest.mockResolvedValue({ id: "request-456" });
    mockGetRentalRequestById.mockResolvedValue({
      id: "request-456",
      ownerId: "owner-123",
      renterId: "renter-789",
      listingName: "Test Tool",
      startDate: daysFromToday(1),
      endDate: daysFromToday(5),
      totalAmount: "75.50",
    });
    mockGetUserById.mockImplementation((id: string) =>
      Promise.resolve(
        id === "owner-123"
          ? {
              id: "owner-123",
              email: "owner@test.com",
              firstName: "Owner",
              lastName: "User",
            }
          : {
              id: "renter-789",
              email: "renter@test.com",
              firstName: "Renter",
              lastName: "User",
            },
      ),
    );
    mockLegalGetAllCurrentVersions.mockResolvedValue({});
  });

  describe("createRentalRequest", () => {
    it("returns id when listing exists and user is not owner", async () => {
      const result = await RentalService.createRentalRequest(
        validFormData,
        "renter-789",
        context,
      );
      expect(result).toEqual({ id: "request-456" });
      expect(mockGetListingById).toHaveBeenCalledWith("listing-123");
      expect(mockInsertRentalRequest).toHaveBeenCalled();
      expect(mockAuditLogCreate).toHaveBeenCalled();
      expect(mockTrackActivity).toHaveBeenCalledWith(
        "renter-789",
        "rental_requested",
        expect.objectContaining({ rentalRequestId: "request-456" }),
      );
    });

    it("throws NotFoundError when listing not found", async () => {
      mockGetListingById.mockResolvedValue(undefined);
      await expect(
        RentalService.createRentalRequest(validFormData, "renter-789", context),
      ).rejects.toThrow(NotFoundError);
      expect(mockInsertRentalRequest).not.toHaveBeenCalled();
    });

    it("throws when user tries to rent own listing", async () => {
      mockGetListingById.mockResolvedValue({
        id: "listing-123",
        owner: { id: "renter-789" },
        dailyRate: 15,
        weeklyRate: 90,
        monthlyRate: 400,
        deliveryFee: 10,
        setupFee: 20,
        securityDeposit: 50,
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 30,
      });
      await expect(
        RentalService.createRentalRequest(validFormData, "renter-789", context),
      ).rejects.toThrow("Cannot rent your own listing");
      expect(mockInsertRentalRequest).not.toHaveBeenCalled();
    });

    it("throws when totalDays less than minimumRentalPeriod", async () => {
      mockGetListingById.mockResolvedValue({
        id: "listing-123",
        owner: { id: "owner-123" },
        dailyRate: 15,
        weeklyRate: null,
        monthlyRate: null,
        deliveryFee: 10,
        setupFee: 20,
        securityDeposit: 50,
        minimumRentalPeriod: 5,
        maximumRentalPeriod: 30,
      });
      const shortStay = {
        ...validFormData,
        startDate: daysFromToday(1),
        endDate: daysFromToday(2),
      };
      await expect(
        RentalService.createRentalRequest(shortStay, "renter-789", context),
      ).rejects.toThrow(/minimum rental period/i);
      expect(mockInsertRentalRequest).not.toHaveBeenCalled();
    });

    it("throws when totalDays exceeds maximumRentalPeriod", async () => {
      mockGetListingById.mockResolvedValue({
        id: "listing-123",
        owner: { id: "owner-123" },
        dailyRate: 15,
        weeklyRate: null,
        monthlyRate: null,
        deliveryFee: 10,
        setupFee: 20,
        securityDeposit: 50,
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 5,
      });
      const longStay = {
        ...validFormData,
        startDate: daysFromToday(1),
        endDate: daysFromToday(20),
      };
      await expect(
        RentalService.createRentalRequest(longStay, "renter-789", context),
      ).rejects.toThrow(/maximum rental period/i);
      expect(mockInsertRentalRequest).not.toHaveBeenCalled();
    });

    it("passes correct payload to insertRentalRequest", async () => {
      await RentalService.createRentalRequest(
        validFormData,
        "renter-789",
        context,
      );
      const payload = mockInsertRentalRequest.mock.calls[0][0];
      expect(payload.listingId).toBe("listing-123");
      expect(payload.renterId).toBe("renter-789");
      expect(payload.ownerId).toBe("owner-123");
      expect(payload.totalDays).toBe(5);
      expect(payload.status).toBe("pending");
      expect(typeof payload.dailyRate).toBe("string");
      expect(typeof payload.totalAmount).toBe("string");
      expect(typeof payload.serviceFee).toBe("string");
    });

    it("accepts single-day rental when startDate equals endDate", async () => {
      const sameDay = daysFromToday(1);
      const singleDayFormData: CreateRentalRequestFormData = {
        ...validFormData,
        startDate: sameDay,
        endDate: new Date(sameDay.getTime()),
      };
      const result = await RentalService.createRentalRequest(
        singleDayFormData,
        "renter-789",
        context,
      );
      expect(result).toEqual({ id: "request-456" });
      const payload = mockInsertRentalRequest.mock.calls[0][0];
      expect(payload.totalDays).toBe(1);
    });
  });
});

/**
 * Requirements: mobile Req 9.1.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md (P-E8A-2b)
 *
 * **The guard that did not exist.** Until this landed, `createRentalRequest`
 * validated the listing, the own-listing rule and the period bounds and then
 * inserted — no availability check, no DB constraint. `getBookedDatesForListing`
 * had exactly one caller, the web rent page, which used it to grey out days in a
 * date picker. Any client that skipped that picker could book straight over a
 * live rental, and a second client was about to be able to.
 */
describe("RentalService.createRentalRequest — availability (P-E8A-2b)", () => {
  const daysAhead = (offset: number) => daysFromToday(offset);

  beforeEach(() => {
    // A sibling describe, so the outer block's reset does not reach here — and
    // `not.toHaveBeenCalled()` would otherwise read another test's insert.
    vi.clearAllMocks();
    mockGetListingById.mockResolvedValue({
      id: "listing-123",
      name: "Test Tool",
      owner: { id: "owner-123" },
      dailyRate: 15,
      weeklyRate: null,
      monthlyRate: null,
      deliveryFee: 10,
      setupFee: 20,
      securityDeposit: 50,
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
    });
    mockGetBookedDatesForListing.mockResolvedValue([]);
    mockInsertRentalRequest.mockResolvedValue({ id: "request-456" });
  });

  it("refuses a request overlapping an existing booking", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: daysAhead(3), endDate: daysAhead(7) },
    ]);

    await expect(
      RentalService.createRentalRequest(
        { ...validFormData, startDate: daysAhead(5), endDate: daysAhead(9) },
        "renter-789",
        context,
      ),
    ).rejects.toThrow(/already booked/i);
    expect(mockInsertRentalRequest).not.toHaveBeenCalled();
  });

  // The item is out on its return day too — half-open would hand two renters
  // the same drill on the changeover day.
  it("refuses a request starting the day an existing booking ends", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: daysAhead(3), endDate: daysAhead(7) },
    ]);

    await expect(
      RentalService.createRentalRequest(
        { ...validFormData, startDate: daysAhead(7), endDate: daysAhead(9) },
        "renter-789",
        context,
      ),
    ).rejects.toThrow(/already booked/i);
  });

  it("names the reason when a manual block is what clashes", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: daysAhead(3), endDate: daysAhead(7), reason: "Maintenance" },
    ]);

    await expect(
      RentalService.createRentalRequest(
        { ...validFormData, startDate: daysAhead(4), endDate: daysAhead(5) },
        "renter-789",
        context,
      ),
    ).rejects.toThrow(/Maintenance/);
  });

  it("allows a request that clears an existing booking", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: daysAhead(3), endDate: daysAhead(7) },
    ]);

    const result = await RentalService.createRentalRequest(
      { ...validFormData, startDate: daysAhead(8), endDate: daysAhead(9) },
      "renter-789",
      context,
    );

    expect(result.id).toBe("request-456");
    expect(mockInsertRentalRequest).toHaveBeenCalled();
  });

  it("refuses a start date in the past (Req 9.1.2)", async () => {
    await expect(
      RentalService.createRentalRequest(
        { ...validFormData, startDate: daysAhead(-1), endDate: daysAhead(2) },
        "renter-789",
        context,
      ),
    ).rejects.toThrow(/past/i);
    expect(mockInsertRentalRequest).not.toHaveBeenCalled();
  });

  // A booking made for TODAY carries a midnight start, already behind `now` by
  // the time anyone taps anything. Comparing instants would break same-day
  // rentals after lunch and only then.
  it("still allows a booking that starts today", async () => {
    const result = await RentalService.createRentalRequest(
      { ...validFormData, startDate: daysAhead(0), endDate: daysAhead(2) },
      "renter-789",
      context,
    );

    expect(result.id).toBe("request-456");
  });

  // Availability is advisory at read time and authoritative at write time; a
  // failed read must not become a silent "all clear" that blocks nothing, nor
  // an outage that blocks everything.
  it("still creates the request when the availability read fails", async () => {
    mockGetBookedDatesForListing.mockRejectedValue(new Error("db down"));

    const result = await RentalService.createRentalRequest(
      validFormData,
      "renter-789",
      context,
    );

    expect(result.id).toBe("request-456");
  });
});
