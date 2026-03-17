import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError, ValidationError } from "@/dal/errors";

const mockGetByRentalId = vi.fn();
const mockUpdatePayoutStatus = vi.fn();
const mockUpdateOwnerTransferStatus = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();

vi.mock("@/dal", () => ({
  paymentLifecycleDAL: {
    getByRentalId: (...args: unknown[]) => mockGetByRentalId(...args),
    updatePayoutStatus: (...args: unknown[]) => mockUpdatePayoutStatus(...args),
    updateOwnerTransferStatus: (...args: unknown[]) =>
      mockUpdateOwnerTransferStatus(...args),
    updateDepositHoldStatus: (...args: unknown[]) =>
      mockUpdateDepositHoldStatus(...args),
  },
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditLogCreate(...args),
  },
  rentalDAL: {
    getRentalDepositReleaseContext: (...args: unknown[]) =>
      mockGetRentalDepositReleaseContext(...args),
  },
}));

const mockAuditLogCreate = vi.fn().mockResolvedValue(undefined);
const mockGetRentalDepositReleaseContext = vi.fn();

const mockPaymentIntentsCancel = vi.fn();
vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentIntents: {
      cancel: (...args: unknown[]) => mockPaymentIntentsCancel(...args),
    },
  },
}));

const mockSendOpsAlert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));

const mockSendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

import { PaymentLifecycleAdminService } from "../payment-lifecycle-admin-service";

describe("PaymentLifecycleAdminService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resetPayoutStatus", () => {
    it("resets payoutStatus from 'processing' to 'pending' and creates audit log", async () => {
      const rentalId = "rental-1";
      mockGetByRentalId.mockResolvedValue({
        rentalId,
        payoutStatus: "processing",
        ownerTransferStatus: "pending",
        depositHoldStatus: "held",
      });

      const result = await PaymentLifecycleAdminService.resetPayoutStatus(
        rentalId,
        { reason: "retry", adminId: "admin-1" },
      );

      expect(result).toEqual({ success: true });
      expect(mockUpdatePayoutStatus).toHaveBeenCalledWith(rentalId, "pending");
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "payment_lifecycle",
          entityId: rentalId,
          action: "payout_status_reset",
          userId: "admin-1",
          metadata: expect.objectContaining({
            previousStatus: "processing",
            newStatus: "pending",
            reason: "retry",
          }),
        }),
      );
    });

    it("resets payoutStatus from 'failed' to 'pending'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-2",
        payoutStatus: "failed",
        ownerTransferStatus: "pending",
        depositHoldStatus: "released",
      });

      const result = await PaymentLifecycleAdminService.resetPayoutStatus(
        "rental-2",
        {},
      );

      expect(result.success).toBe(true);
      expect(mockUpdatePayoutStatus).toHaveBeenCalledWith(
        "rental-2",
        "pending",
      );
    });

    it("throws ValidationError when payoutStatus is 'completed'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-3",
        payoutStatus: "completed",
        ownerTransferStatus: "completed",
        depositHoldStatus: "released",
      });

      await expect(
        PaymentLifecycleAdminService.resetPayoutStatus("rental-3", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockUpdatePayoutStatus).not.toHaveBeenCalled();
    });

    it("throws ValidationError when payoutStatus is 'pending'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-4",
        payoutStatus: "pending",
        ownerTransferStatus: "pending",
        depositHoldStatus: "scheduled",
      });

      await expect(
        PaymentLifecycleAdminService.resetPayoutStatus("rental-4", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockUpdatePayoutStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when lifecycle not found", async () => {
      mockGetByRentalId.mockResolvedValue(null);

      await expect(
        PaymentLifecycleAdminService.resetPayoutStatus("missing-rental", {}),
      ).rejects.toThrow(NotFoundError);

      expect(mockUpdatePayoutStatus).not.toHaveBeenCalled();
    });

    it("does not call Stripe API during reset", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-1",
        payoutStatus: "processing",
        ownerTransferStatus: "pending",
        depositHoldStatus: "held",
      });

      await PaymentLifecycleAdminService.resetPayoutStatus("rental-1", {});

      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
    });
  });

  describe("resetTransferStatus", () => {
    it("resets ownerTransferStatus from 'failed' to 'pending' and creates audit log", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-1",
        payoutStatus: "completed",
        ownerTransferStatus: "failed",
        depositHoldStatus: "released",
      });

      const result = await PaymentLifecycleAdminService.resetTransferStatus(
        "rental-1",
        { reason: "retry", adminId: "admin-1" },
      );

      expect(result).toEqual({ success: true });
      expect(mockUpdateOwnerTransferStatus).toHaveBeenCalledWith(
        "rental-1",
        "pending",
      );
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "owner_transfer_status_reset",
          metadata: expect.objectContaining({
            previousTransferStatus: "failed",
            previousPayoutStatus: "completed",
          }),
        }),
      );
    });

    it("resets both transfer and payout to pending when both are failed", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-2",
        payoutStatus: "failed",
        ownerTransferStatus: "failed",
        depositHoldStatus: "released",
      });

      await PaymentLifecycleAdminService.resetTransferStatus("rental-2", {});

      expect(mockUpdateOwnerTransferStatus).toHaveBeenCalledWith(
        "rental-2",
        "pending",
      );
      expect(mockUpdatePayoutStatus).toHaveBeenCalledWith(
        "rental-2",
        "pending",
      );
    });

    it("throws ValidationError when ownerTransferStatus is 'pending'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-3",
        payoutStatus: "pending",
        ownerTransferStatus: "pending",
        depositHoldStatus: "scheduled",
      });

      await expect(
        PaymentLifecycleAdminService.resetTransferStatus("rental-3", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockUpdateOwnerTransferStatus).not.toHaveBeenCalled();
    });

    it("resets only transfer when ownerTransferStatus is failed and payoutStatus is processing", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-4",
        payoutStatus: "processing",
        ownerTransferStatus: "failed",
        depositHoldStatus: "released",
      });

      await PaymentLifecycleAdminService.resetTransferStatus("rental-4", {});

      expect(mockUpdateOwnerTransferStatus).toHaveBeenCalledWith(
        "rental-4",
        "pending",
      );
      expect(mockUpdatePayoutStatus).not.toHaveBeenCalled();
    });

    it("throws ValidationError when ownerTransferStatus is 'frozen'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-5",
        payoutStatus: "completed",
        ownerTransferStatus: "frozen",
        depositHoldStatus: "released",
      });

      await expect(
        PaymentLifecycleAdminService.resetTransferStatus("rental-5", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockUpdateOwnerTransferStatus).not.toHaveBeenCalled();
    });

    it("throws ValidationError when ownerTransferStatus is 'completed'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-6",
        payoutStatus: "completed",
        ownerTransferStatus: "completed",
        depositHoldStatus: "released",
      });

      await expect(
        PaymentLifecycleAdminService.resetTransferStatus("rental-6", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockUpdateOwnerTransferStatus).not.toHaveBeenCalled();
    });

    it("does not call Stripe API during reset", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "rental-1",
        payoutStatus: "failed",
        ownerTransferStatus: "failed",
        depositHoldStatus: "released",
      });

      await PaymentLifecycleAdminService.resetTransferStatus("rental-1", {});

      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
    });
  });

  describe("releaseDeposit", () => {
    it("releases deposit when status is 'held': Stripe cancel succeeds, updates status, audit log, notifies renter", async () => {
      const rentalId = "rental-1";
      const renterId = "renter-1";
      const authId = "pi_abc";
      mockGetByRentalId.mockResolvedValue({
        rentalId,
        payoutStatus: "completed",
        ownerTransferStatus: "completed",
        depositHoldStatus: "held",
      });
      mockGetRentalDepositReleaseContext.mockResolvedValue({
        renterId,
        securityDepositAuthId: authId,
      });
      mockPaymentIntentsCancel.mockResolvedValue(undefined);

      const result = await PaymentLifecycleAdminService.releaseDeposit(
        rentalId,
        { adminId: "admin-1" },
      );

      expect(result).toEqual({ success: true });
      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith(authId);
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        rentalId,
        "released",
        expect.objectContaining({ depositReleasedAt: expect.any(Date) }),
      );
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "manual_deposit_release",
          metadata: { status: "succeeded" },
        }),
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: renterId,
          title: "Security deposit released",
        }),
      );
    });

    it("treats Stripe 'already canceled' as success and sets released", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r1",
        depositHoldStatus: "held",
      });
      mockGetRentalDepositReleaseContext.mockResolvedValue({
        renterId: "u1",
        securityDepositAuthId: "pi_xyz",
      });
      const stripeError = new Error(
        "payment_intent_unexpected_state: already canceled",
      ) as Error & { code?: string };
      stripeError.code = "payment_intent_unexpected_state";
      mockPaymentIntentsCancel.mockRejectedValue(stripeError);

      const result = await PaymentLifecycleAdminService.releaseDeposit(
        "r1",
        {},
      );

      expect(result.success).toBe(true);
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "r1",
        "released",
        expect.any(Object),
      );
      expect(mockAuditLogCreate).toHaveBeenCalled();
    });

    it("on Stripe error: logs audit with failed, sends ops alert, returns success false", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r2",
        depositHoldStatus: "held",
      });
      mockGetRentalDepositReleaseContext.mockResolvedValue({
        renterId: "u2",
        securityDepositAuthId: "pi_fail",
      });
      mockPaymentIntentsCancel.mockRejectedValue(
        new Error("Stripe API timeout"),
      );

      const result = await PaymentLifecycleAdminService.releaseDeposit(
        "r2",
        {},
      );

      expect(result).toEqual({
        success: false,
        error: "Stripe API timeout",
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "manual_deposit_release",
          metadata: expect.objectContaining({ status: "failed" }),
        }),
      );
      expect(mockSendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "manual_deposit_release_failed",
          rentalId: "r2",
        }),
      );
      expect(mockUpdateDepositHoldStatus).not.toHaveBeenCalled();
    });

    it("does not notify renter on Stripe failure", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r2",
        depositHoldStatus: "held",
      });
      mockGetRentalDepositReleaseContext.mockResolvedValue({
        renterId: "u2",
        securityDepositAuthId: "pi_fail",
      });
      mockPaymentIntentsCancel.mockRejectedValue(
        new Error("Stripe API timeout"),
      );

      await PaymentLifecycleAdminService.releaseDeposit("r2", {});

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("throws ValidationError when depositHoldStatus is 'released'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r3",
        depositHoldStatus: "released",
      });

      await expect(
        PaymentLifecycleAdminService.releaseDeposit("r3", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockGetRentalDepositReleaseContext).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
    });

    it("throws ValidationError when depositHoldStatus is 'expired'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r-exp",
        depositHoldStatus: "expired",
      });

      await expect(
        PaymentLifecycleAdminService.releaseDeposit("r-exp", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockGetRentalDepositReleaseContext).not.toHaveBeenCalled();
    });

    it("throws ValidationError when depositHoldStatus is 'not_applicable'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r-na",
        depositHoldStatus: "not_applicable",
      });

      await expect(
        PaymentLifecycleAdminService.releaseDeposit("r-na", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockGetRentalDepositReleaseContext).not.toHaveBeenCalled();
    });

    it("throws ValidationError when depositHoldStatus is 'scheduled'", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r-sched",
        depositHoldStatus: "scheduled",
      });

      await expect(
        PaymentLifecycleAdminService.releaseDeposit("r-sched", {}),
      ).rejects.toThrow(ValidationError);

      expect(mockGetRentalDepositReleaseContext).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when rental/deposit context missing", async () => {
      mockGetByRentalId.mockResolvedValue({
        rentalId: "r4",
        depositHoldStatus: "held",
      });
      mockGetRentalDepositReleaseContext.mockResolvedValue(null);

      await expect(
        PaymentLifecycleAdminService.releaseDeposit("r4", {}),
      ).rejects.toThrow(NotFoundError);

      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
    });
  });
});
