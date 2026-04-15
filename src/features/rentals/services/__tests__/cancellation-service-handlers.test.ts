import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";

const mockGetRentalRequestById = vi.fn();
const mockCancelRentalRequest = vi.fn();
const mockGetRentalCancellationContext = vi.fn();
const mockCancelApprovedRental = vi.fn();
const mockRecordRefund = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();
const mockUpdateOwnerTransferStatus = vi.fn();
const mockMarkCancelled = vi.fn();
const mockGetUserById = vi.fn();
const mockAuditCreate = vi.fn();
const mockProcessRefund = vi.fn();
const mockCreateOwnerTransfer = vi.fn();
const mockReleaseDepositHold = vi.fn();
const mockSendOpsAlert = vi.fn();
const mockSendRentalCancelledNotification = vi.fn();
const mockSendNotification = vi.fn();
const mockTrackActivity = vi.fn();

vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: (...args: unknown[]) =>
      mockGetRentalRequestById(...args),
    cancelRentalRequest: (...args: unknown[]) =>
      mockCancelRentalRequest(...args),
    getRentalCancellationContext: (...args: unknown[]) =>
      mockGetRentalCancellationContext(...args),
    cancelApprovedRental: (...args: unknown[]) =>
      mockCancelApprovedRental(...args),
  },
  paymentDAL: {
    recordRefund: (...args: unknown[]) => mockRecordRefund(...args),
  },
  paymentLifecycleDAL: {
    updateDepositHoldStatus: (...args: unknown[]) =>
      mockUpdateDepositHoldStatus(...args),
    updateOwnerTransferStatus: (...args: unknown[]) =>
      mockUpdateOwnerTransferStatus(...args),
    markCancelled: (...args: unknown[]) => mockMarkCancelled(...args),
  },
  userDAL: {
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
  },
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
}));

vi.mock("@/services/stripe/refund", () => ({
  processRefund: (...args: unknown[]) => mockProcessRefund(...args),
}));

vi.mock("@/services/stripe/payout", () => ({
  createOwnerTransfer: (...args: unknown[]) => mockCreateOwnerTransfer(...args),
}));

vi.mock("@/services/stripe/deposit-hold", () => ({
  releaseDepositHold: (...args: unknown[]) => mockReleaseDepositHold(...args),
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));

vi.mock("@/features/rentals/notifications/rental-cancelled", () => ({
  sendRentalCancelledNotification: (...args: unknown[]) =>
    mockSendRentalCancelledNotification(...args),
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: (...args: unknown[]) => mockTrackActivity(...args),
}));

vi.mock("@/constants/payments", () => ({
  PLATFORM_FEE_PERCENTAGE: 0.2,
}));

import {
  cancelPendingRequest,
  cancelRental,
  cancelApprovedRental,
  applyNoShow,
} from "../cancellation-service";

function addHours(date: Date, h: number): Date {
  const out = new Date(date);
  out.setTime(out.getTime() + h * 60 * 60 * 1000);
  return out;
}

describe("CancellationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditCreate.mockResolvedValue(undefined);
    mockGetUserById.mockImplementation((id: string) =>
      Promise.resolve({
        id,
        name: "User",
        firstName: "Test",
        lastName: "User",
      }),
    );
  });

  describe("cancelPendingRequest", () => {
    it("updates status to cancelled and notifies owner; makes no Stripe calls", async () => {
      mockGetRentalRequestById.mockResolvedValue({
        id: "req-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "pending",
        listingName: "Listing",
      });
      mockCancelRentalRequest.mockResolvedValue(undefined);
      mockSendRentalCancelledNotification.mockResolvedValue(undefined);

      await cancelPendingRequest("req-1", "renter-1", {
        ipAddress: "127.0.0.1",
      });

      expect(mockCancelRentalRequest).toHaveBeenCalledWith(
        "req-1",
        "renter-1",
        null,
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "rental_request",
          entityId: "req-1",
          action: "rental_request.cancelled",
          userId: "renter-1",
        }),
      );
      expect(mockSendRentalCancelledNotification).toHaveBeenCalled();
      expect(mockProcessRefund).not.toHaveBeenCalled();
      expect(mockReleaseDepositHold).not.toHaveBeenCalled();
      expect(mockCreateOwnerTransfer).not.toHaveBeenCalled();
    });

    it("rejects non-renter with ForbiddenError", async () => {
      mockGetRentalRequestById.mockResolvedValue({
        id: "req-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "pending",
      });

      await expect(
        cancelPendingRequest("req-1", "owner-1", {}),
      ).rejects.toThrow(ForbiddenError);

      expect(mockCancelRentalRequest).not.toHaveBeenCalled();
    });

    it("rejects non-pending status with ValidationError", async () => {
      mockGetRentalRequestById.mockResolvedValue({
        id: "req-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "approved",
      });

      await expect(
        cancelPendingRequest("req-1", "renter-1", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockCancelRentalRequest).not.toHaveBeenCalled();
    });
  });

  describe("cancelRental", () => {
    it("delegates pending + renter to cancelPendingRequest and returns success", async () => {
      mockGetRentalRequestById.mockResolvedValue({
        id: "req-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "pending",
        listingName: "L",
      });
      mockCancelRentalRequest.mockResolvedValue(undefined);
      mockSendRentalCancelledNotification.mockResolvedValue(undefined);

      const result = await cancelRental("req-1", "renter-1", {});

      expect(result).toEqual({ success: true });
      expect(mockCancelRentalRequest).toHaveBeenCalled();
      expect(mockGetRentalCancellationContext).not.toHaveBeenCalled();
    });

    it("rejects active rental with ValidationError", async () => {
      mockGetRentalRequestById.mockResolvedValue({
        id: "req-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "active",
      });

      await expect(cancelRental("req-1", "renter-1", {})).rejects.toThrow(
        ValidationError,
      );
      expect(mockGetRentalCancellationContext).not.toHaveBeenCalled();
      expect(mockProcessRefund).not.toHaveBeenCalled();
    });

    it("rejects when caller is neither renter nor owner with ForbiddenError", async () => {
      mockGetRentalRequestById.mockResolvedValue({
        id: "req-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "pending",
      });

      await expect(cancelRental("req-1", "other-user", {})).rejects.toThrow(
        ForbiddenError,
      );
    });

    it("returns 404 for non-existent rental", async () => {
      mockGetRentalRequestById.mockResolvedValue(null);

      await expect(cancelRental("req-missing", "renter-1", {})).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("cancelApprovedRental — renter ≥24h", () => {
    it("refunds 100% rental price, no owner transfer, releases deposit, sends notifications and OPS_ALERT", async () => {
      const startDate = addHours(new Date(), 48);
      mockGetRentalCancellationContext.mockResolvedValue({
        rentalRequestId: "req-1",
        rentalId: "rental-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "approved",
        startDate,
        rentalPrice: "100",
        serviceFee: "12",
        totalChargeAmount: "112",
        depositHoldStatus: "held",
        securityDepositAuthId: "pi_dep_1",
        rentalChargeId: "ch_1",
        paymentId: "pay-1",
        paymentStatus: "succeeded",
        ownerConnectedAccountId: "acct_1",
      });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockRecordRefund.mockResolvedValue(undefined);
      mockReleaseDepositHold.mockResolvedValue(undefined);
      mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
      mockCancelApprovedRental.mockResolvedValue(undefined);
      mockMarkCancelled.mockResolvedValue(undefined);
      mockSendNotification.mockResolvedValue(undefined);
      mockSendOpsAlert.mockResolvedValue(undefined);

      const result = await cancelApprovedRental(
        "req-1",
        "renter-1",
        "renter",
        {},
      );

      expect(result).toEqual({ success: true, refundAmount: 100 });
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeId: "ch_1",
          refundAmountCents: 10000,
          reason: "renter_cancellation_24h",
        }),
      );
      expect(mockCreateOwnerTransfer).not.toHaveBeenCalled();
      expect(mockReleaseDepositHold).toHaveBeenCalledWith("pi_dep_1");
      expect(mockCancelApprovedRental).toHaveBeenCalledWith(
        "req-1",
        "renter-1",
        "renter_cancellation",
        null,
      );
      expect(mockSendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({ sendEmailAlert: true }),
      );
    });

    it("when refund fails, returns error and does not mark rental cancelled", async () => {
      mockGetRentalCancellationContext.mockResolvedValue({
        rentalRequestId: "req-1",
        rentalId: "rental-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "approved",
        startDate: addHours(new Date(), 48),
        rentalPrice: "100",
        serviceFee: "12",
        totalChargeAmount: "112",
        depositHoldStatus: "scheduled",
        rentalChargeId: "ch_1",
        paymentId: "pay-1",
        paymentStatus: "succeeded",
        ownerConnectedAccountId: "acct_1",
      });
      mockProcessRefund.mockResolvedValue({
        success: false,
        error: "Charge already refunded",
      });

      const result = await cancelApprovedRental(
        "req-1",
        "renter-1",
        "renter",
        {},
      );

      expect(result).toEqual({
        success: false,
        error: "Charge already refunded",
      });
      expect(mockCancelApprovedRental).not.toHaveBeenCalled();
      expect(mockRecordRefund).not.toHaveBeenCalled();
    });
  });

  describe("cancelApprovedRental — same-day (startDate passed)", () => {
    it("allows cancellation when approved and startDate has passed, applies <24h refund tier (50%)", async () => {
      const startDate = addHours(new Date(), -2);
      mockGetRentalCancellationContext.mockResolvedValue({
        rentalRequestId: "req-1",
        rentalId: "rental-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "approved",
        startDate,
        rentalPrice: "100",
        serviceFee: "12",
        totalChargeAmount: "112",
        depositHoldStatus: "held",
        securityDepositAuthId: "pi_dep_1",
        rentalChargeId: "ch_1",
        paymentId: "pay-1",
        paymentStatus: "succeeded",
        ownerConnectedAccountId: "acct_1",
      });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockRecordRefund.mockResolvedValue(undefined);
      mockReleaseDepositHold.mockResolvedValue(undefined);
      mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
      mockCreateOwnerTransfer.mockResolvedValue({
        success: true,
        transferId: "tr_1",
      });
      mockUpdateOwnerTransferStatus.mockResolvedValue(undefined);
      mockCancelApprovedRental.mockResolvedValue(undefined);
      mockMarkCancelled.mockResolvedValue(undefined);
      mockSendOpsAlert.mockResolvedValue(undefined);

      const result = await cancelApprovedRental(
        "req-1",
        "renter-1",
        "renter",
        {},
      );

      expect(result).toEqual({
        success: true,
        refundAmount: 50,
        ownerTransferAmount: 30,
      });
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeId: "ch_1",
          refundAmountCents: 5000,
          reason: "renter_cancellation_under_24h",
        }),
      );
      expect(mockCreateOwnerTransfer).toHaveBeenCalled();
      expect(mockReleaseDepositHold).toHaveBeenCalledWith("pi_dep_1");
      expect(mockCancelApprovedRental).toHaveBeenCalledWith(
        "req-1",
        "renter-1",
        "renter_cancellation",
        null,
      );
      expect(mockSendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({ sendEmailAlert: true }),
      );
    });
  });

  describe("applyNoShow", () => {
    it("renter_no_show: 50% refund + owner transfer, deposit released, OPS_ALERT", async () => {
      mockGetRentalCancellationContext.mockResolvedValue({
        rentalRequestId: "req-1",
        rentalId: "rental-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "active",
        startDate: new Date(),
        rentalPrice: "100",
        serviceFee: "12",
        totalChargeAmount: "112",
        depositHoldStatus: "held",
        securityDepositAuthId: "pi_dep_1",
        rentalChargeId: "ch_1",
        paymentId: "pay-1",
        paymentStatus: "succeeded",
        ownerConnectedAccountId: "acct_1",
      });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockRecordRefund.mockResolvedValue(undefined);
      mockReleaseDepositHold.mockResolvedValue(undefined);
      mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
      mockCreateOwnerTransfer.mockResolvedValue({
        success: true,
        transferId: "tr_1",
      });
      mockUpdateOwnerTransferStatus.mockResolvedValue(undefined);
      mockCancelApprovedRental.mockResolvedValue(undefined);
      mockMarkCancelled.mockResolvedValue(undefined);
      mockSendOpsAlert.mockResolvedValue(undefined);

      const result = await applyNoShow("req-1", "renter_no_show", "admin-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.refundAmount).toBe(50);
        expect(result.ownerTransferAmount).toBe(30);
      }
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmountCents: 5000,
          reason: "renter_no_show",
        }),
      );
      expect(mockCreateOwnerTransfer).toHaveBeenCalled();
      expect(mockCancelApprovedRental).toHaveBeenCalledWith(
        "req-1",
        "admin-1",
        "renter_no_show",
      );
      expect(mockSendOpsAlert).toHaveBeenCalled();
    });

    it("owner_no_show: full charge refund, no owner transfer", async () => {
      mockGetRentalCancellationContext.mockResolvedValue({
        rentalRequestId: "req-1",
        rentalId: "rental-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        status: "active",
        startDate: new Date(),
        rentalPrice: "100",
        serviceFee: "12",
        totalChargeAmount: "112",
        depositHoldStatus: "scheduled",
        rentalChargeId: "ch_1",
        paymentId: "pay-1",
        paymentStatus: "succeeded",
        ownerConnectedAccountId: "acct_1",
      });
      mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
      mockRecordRefund.mockResolvedValue(undefined);
      mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
      mockCancelApprovedRental.mockResolvedValue(undefined);
      mockMarkCancelled.mockResolvedValue(undefined);
      mockSendOpsAlert.mockResolvedValue(undefined);

      const result = await applyNoShow("req-1", "owner_no_show", "admin-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.refundAmount).toBe(112);
      }
      expect(mockProcessRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmountCents: 11200,
          reason: "owner_no_show",
        }),
      );
      expect(mockCreateOwnerTransfer).not.toHaveBeenCalled();
    });

    it("rejects already cancelled rental", async () => {
      mockGetRentalCancellationContext.mockResolvedValue({
        rentalRequestId: "req-1",
        rentalId: "rental-1",
        status: "cancelled",
        rentalPrice: "100",
        serviceFee: "12",
        totalChargeAmount: "112",
        paymentStatus: "succeeded",
      });

      await expect(
        applyNoShow("req-1", "renter_no_show", "admin-1"),
      ).rejects.toThrow(ValidationError);

      expect(mockProcessRefund).not.toHaveBeenCalled();
    });
  });
});
