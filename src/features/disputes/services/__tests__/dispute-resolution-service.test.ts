import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDepositOperationForOutcome,
  DisputeResolutionService,
} from "../dispute-resolution-service";
import { disputeDAL, paymentLifecycleDAL, rentalDAL } from "@/dal";
import { releaseSecurityDeposit } from "@/services/stripe/rental-payments";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import { ValidationError } from "@/dal/errors";

vi.mock("@/dal", () => ({
  disputeDAL: {
    getById: vi.fn(),
    resolve: vi.fn(),
    createFinancialOperation: vi.fn(),
    createAuditLog: vi.fn(),
  },
  auditLogDAL: { create: vi.fn() },
  paymentLifecycleDAL: {
    getByRentalId: vi.fn(),
    unfreezeAfterResolution: vi.fn(),
    markDepositCaptured: vi.fn(),
    updateDepositHoldStatus: vi.fn(),
  },
  rentalDAL: {
    getSecurityDepositAuthId: vi.fn(),
  },
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  releaseSecurityDeposit: vi.fn(),
}));

vi.mock("@/features/disputes/notifications/dispute-notifications", () => ({
  sendDisputeNotifications: vi.fn(),
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentIntents: {
      capture: vi.fn(),
    },
  },
}));

const baseMockDispute = {
  id: "dispute-123",
  referenceNumber: 42,
  rentalId: "rental-123",
  createdBy: "user-renter",
  createdByRole: "renter" as const,
  reasonCode: "damage" as const,
  description: "Tool damaged",
  status: "open" as const,
  policyVersion: "v1.0",
  evidenceDeadline: new Date("2024-01-15"),
  additionalEvidenceDeadline: null,
  resolvedAt: null,
  resolvedBy: null,
  resolutionOutcome: null,
  resolutionReason: null,
  stripeChargebackId: null,
  createdAt: new Date("2024-01-08"),
  updatedAt: new Date("2024-01-08"),
  rental: {
    id: "rental-123",
    requestId: "request-123",
    listingId: "listing-123",
    renterId: "user-renter",
    ownerId: "user-owner",
  },
  createdByUser: {
    id: "user-renter",
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
  },
  resolvedByUser: null,
  evidence: [],
  auditLogs: [],
  internalNotes: [],
  financialOperations: [],
};

const mockResolvedDispute = {
  ...baseMockDispute,
  status: "resolved" as const,
  resolvedAt: new Date(),
  resolvedBy: "admin-1",
  resolutionOutcome: "favor_provider" as const,
  resolutionReason: "Evidence shows damage",
};

describe("getDepositOperationForOutcome", () => {
  it("returns skip when depositHoldStatus is not held", () => {
    expect(getDepositOperationForOutcome("favor_provider", "expired")).toEqual({
      action: "skip",
    });
    expect(getDepositOperationForOutcome("favor_provider", "released")).toEqual(
      {
        action: "skip",
      },
    );
    expect(getDepositOperationForOutcome("favor_provider", "captured")).toEqual(
      {
        action: "skip",
      },
    );
  });

  it("returns capture_full for favor_provider when held", () => {
    expect(getDepositOperationForOutcome("favor_provider", "held")).toEqual({
      action: "capture_full",
    });
  });

  it("returns release for favor_renter when held", () => {
    expect(getDepositOperationForOutcome("favor_renter", "held")).toEqual({
      action: "release",
    });
  });

  it("returns capture_partial with amount for partial_provider when held", () => {
    expect(
      getDepositOperationForOutcome("partial_provider", "held", 50),
    ).toEqual({ action: "capture_partial", partialAmountDollars: 50 });
  });

  it("returns release for dismissed when held", () => {
    expect(getDepositOperationForOutcome("dismissed", "held")).toEqual({
      action: "release",
    });
  });
});

describe("DisputeResolutionService.resolveDispute", () => {
  const adminId = "admin-1";
  const reason = "Evidence shows damage";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("35.1 favor_provider", () => {
    it("captures full deposit, marks captured, unfreezes, and resolves", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(baseMockDispute as never);
      vi.mocked(paymentLifecycleDAL.getByRentalId).mockResolvedValue({
        depositHoldStatus: "held",
      } as never);
      vi.mocked(rentalDAL.getSecurityDepositAuthId).mockResolvedValue(
        "pi_dep_123",
      );
      vi.mocked(
        PAYMENT_SERVER_INSTANCE.paymentIntents.capture,
      ).mockResolvedValue({ id: "pi_dep_123" } as never);
      vi.mocked(disputeDAL.resolve).mockResolvedValue(
        mockResolvedDispute as never,
      );

      const result = await DisputeResolutionService.resolveDispute({
        disputeId: "dispute-123",
        outcome: "favor_provider",
        reason,
        adminId,
      });

      expect(result.depositOperationStatus).toBe("captured");
      expect(result.dispute.status).toBe("resolved");
      expect(
        PAYMENT_SERVER_INSTANCE.paymentIntents.capture,
      ).toHaveBeenCalledWith(
        "pi_dep_123",
        {},
        { idempotencyKey: "deposit-capture-dispute-123" },
      );
      expect(paymentLifecycleDAL.markDepositCaptured).toHaveBeenCalledWith(
        "rental-123",
      );
      expect(paymentLifecycleDAL.unfreezeAfterResolution).toHaveBeenCalledWith(
        "rental-123",
      );
      expect(disputeDAL.resolve).toHaveBeenCalledWith(
        "dispute-123",
        "favor_provider",
        reason,
        adminId,
      );
    });
  });

  describe("35.2 favor_renter", () => {
    it("releases deposit, updates hold status, and unfreezes", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(baseMockDispute as never);
      vi.mocked(paymentLifecycleDAL.getByRentalId).mockResolvedValue({
        depositHoldStatus: "held",
      } as never);
      vi.mocked(rentalDAL.getSecurityDepositAuthId).mockResolvedValue(
        "pi_dep_123",
      );
      vi.mocked(releaseSecurityDeposit).mockResolvedValue({
        id: "pi_dep_123",
      } as never);
      vi.mocked(disputeDAL.resolve).mockResolvedValue({
        ...mockResolvedDispute,
        resolutionOutcome: "favor_renter",
      } as never);

      await DisputeResolutionService.resolveDispute({
        disputeId: "dispute-123",
        outcome: "favor_renter",
        reason,
        adminId,
      });

      expect(releaseSecurityDeposit).toHaveBeenCalledWith("pi_dep_123");
      expect(paymentLifecycleDAL.updateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-123",
        "released",
        expect.objectContaining({ depositReleasedAt: expect.any(Date) }),
      );
      expect(paymentLifecycleDAL.unfreezeAfterResolution).toHaveBeenCalledWith(
        "rental-123",
      );
    });
  });

  describe("35.3 partial_provider", () => {
    it("captures partial amount (50 dollars = 5000 cents)", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(baseMockDispute as never);
      vi.mocked(paymentLifecycleDAL.getByRentalId).mockResolvedValue({
        depositHoldStatus: "held",
      } as never);
      vi.mocked(rentalDAL.getSecurityDepositAuthId).mockResolvedValue(
        "pi_dep_123",
      );
      vi.mocked(
        PAYMENT_SERVER_INSTANCE.paymentIntents.capture,
      ).mockResolvedValue({ id: "pi_dep_123" } as never);
      vi.mocked(disputeDAL.resolve).mockResolvedValue({
        ...mockResolvedDispute,
        resolutionOutcome: "partial_provider",
      } as never);

      await DisputeResolutionService.resolveDispute({
        disputeId: "dispute-123",
        outcome: "partial_provider",
        reason,
        adminId,
        partialAmount: 50,
      });

      expect(
        PAYMENT_SERVER_INSTANCE.paymentIntents.capture,
      ).toHaveBeenCalledWith(
        "pi_dep_123",
        { amount_to_capture: 5000 },
        { idempotencyKey: "deposit-capture-dispute-123" },
      );
    });
  });

  describe("35.4 dismissed", () => {
    it("releases deposit like favor_renter", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(baseMockDispute as never);
      vi.mocked(paymentLifecycleDAL.getByRentalId).mockResolvedValue({
        depositHoldStatus: "held",
      } as never);
      vi.mocked(rentalDAL.getSecurityDepositAuthId).mockResolvedValue(
        "pi_dep_123",
      );
      vi.mocked(releaseSecurityDeposit).mockResolvedValue({
        id: "pi_dep_123",
      } as never);
      vi.mocked(disputeDAL.resolve).mockResolvedValue({
        ...mockResolvedDispute,
        resolutionOutcome: "dismissed",
      } as never);

      await DisputeResolutionService.resolveDispute({
        disputeId: "dispute-123",
        outcome: "dismissed",
        reason,
        adminId,
      });

      expect(releaseSecurityDeposit).toHaveBeenCalledWith("pi_dep_123");
      expect(paymentLifecycleDAL.updateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-123",
        "released",
        expect.any(Object),
      );
    });
  });

  describe("35.5 deposit expired", () => {
    it("records financial op as failed/skip, still resolves and unfreezes", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(baseMockDispute as never);
      vi.mocked(paymentLifecycleDAL.getByRentalId).mockResolvedValue({
        depositHoldStatus: "expired",
      } as never);
      vi.mocked(disputeDAL.resolve).mockResolvedValue({
        ...mockResolvedDispute,
        resolutionOutcome: "favor_provider",
      } as never);

      const result = await DisputeResolutionService.resolveDispute({
        disputeId: "dispute-123",
        outcome: "favor_provider",
        reason,
        adminId,
      });

      expect(result.depositOperationStatus).toBe("skipped");
      expect(disputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: "dispute-123",
          operationType: "capture_deposit",
          status: "failed",
          errorMessage: expect.stringContaining("'expired'"),
          performedBy: adminId,
        }),
      );
      expect(paymentLifecycleDAL.unfreezeAfterResolution).toHaveBeenCalledWith(
        "rental-123",
      );
      expect(disputeDAL.resolve).toHaveBeenCalled();
    });
  });

  describe("35.6 deposit capture failure", () => {
    it("throws ValidationError, does not unfreeze or resolve", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(baseMockDispute as never);
      vi.mocked(paymentLifecycleDAL.getByRentalId).mockResolvedValue({
        depositHoldStatus: "held",
      } as never);
      vi.mocked(rentalDAL.getSecurityDepositAuthId).mockResolvedValue(
        "pi_dep_123",
      );
      vi.mocked(
        PAYMENT_SERVER_INSTANCE.paymentIntents.capture,
      ).mockRejectedValue(new Error("Card declined"));

      await expect(
        DisputeResolutionService.resolveDispute({
          disputeId: "dispute-123",
          outcome: "favor_provider",
          reason,
          adminId,
        }),
      ).rejects.toThrow(ValidationError);

      expect(
        paymentLifecycleDAL.unfreezeAfterResolution,
      ).not.toHaveBeenCalled();
      expect(disputeDAL.resolve).not.toHaveBeenCalled();
    });
  });

  describe("35.7 already resolved", () => {
    it("throws ValidationError when dispute is already resolved", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue({
        ...baseMockDispute,
        status: "resolved",
      } as never);

      await expect(
        DisputeResolutionService.resolveDispute({
          disputeId: "dispute-123",
          outcome: "favor_provider",
          reason,
          adminId,
        }),
      ).rejects.toThrow(ValidationError);

      expect(disputeDAL.resolve).not.toHaveBeenCalled();
    });
  });
});
