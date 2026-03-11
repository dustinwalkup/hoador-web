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

vi.mock("@/dal", () => ({
  listingDAL: {
    getListingById: (...args: unknown[]) => mockGetListingById(...args),
  },
  rentalDAL: {
    insertRentalRequest: (...args: unknown[]) =>
      mockInsertRentalRequest(...args),
    getRentalRequestById: (...args: unknown[]) =>
      mockGetRentalRequestById(...args),
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

const validFormData: CreateRentalRequestFormData = {
  listingId: "listing-123",
  startDate: new Date("2024-02-01"),
  endDate: new Date("2024-02-05"),
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
    mockInsertRentalRequest.mockResolvedValue({ id: "request-456" });
    mockGetRentalRequestById.mockResolvedValue({
      id: "request-456",
      ownerId: "owner-123",
      renterId: "renter-789",
      listingName: "Test Tool",
      startDate: new Date("2024-02-01"),
      endDate: new Date("2024-02-05"),
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
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-02-02"),
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
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-02-20"),
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
      const sameDay = new Date("2024-02-01");
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
