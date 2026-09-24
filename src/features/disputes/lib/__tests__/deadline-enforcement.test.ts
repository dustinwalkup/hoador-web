import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeadlineEnforcementService } from "../deadline-enforcement";
import { disputeDAL } from "@/dal";
import { sendEvidenceDeadlineExpired } from "@/features/disputes/notifications/deadline-notifications";
import type { DisputeWithRelations } from "@/dal/types";

// Mock dependencies
vi.mock("@/dal", () => ({
  disputeDAL: {
    getById: vi.fn(),
    checkEvidenceDeadline: vi.fn(),
    transitionIfStatus: vi.fn(),
    createAuditLog: vi.fn(),
  },
}));

vi.mock("@/features/disputes/notifications/deadline-notifications", () => ({
  sendEvidenceDeadlineExpired: vi.fn(),
}));

describe("DeadlineEnforcementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("checkAndEnforce", () => {
    const mockDisputeId = "dispute-123";
    const expired = new Date("2024-01-01T00:00:00Z");

    const createMockDispute = (
      status: DisputeWithRelations["status"],
      evidenceDeadline: Date | null,
      over: Partial<DisputeWithRelations> = {},
    ): DisputeWithRelations => ({
      id: mockDisputeId,
      referenceNumber: 42,
      rentalId: "rental-123",
      serviceBookingId: null,
      createdBy: "renter-123",
      createdByRole: "renter",
      reasonCode: "damage",
      description: "Test dispute",
      status,
      policyVersion: "v1.0",
      evidenceDeadline,
      additionalEvidenceDeadline: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionOutcome: null,
      resolutionReason: null,
      stripeChargebackId: null,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      rental: {
        id: "rental-123",
        requestId: null,
        listingId: "listing-123",
        renterId: "renter-123",
        ownerId: "owner-123",
      },
      ...over,
    });

    function arrangeExpired(
      dispute = createMockDispute("evidence_requested", expired),
    ) {
      vi.mocked(disputeDAL.getById).mockResolvedValue(dispute);
      vi.mocked(disputeDAL.checkEvidenceDeadline).mockResolvedValue({
        expired: true,
        deadline: expired,
        timeRemaining: 0,
      });
      vi.mocked(disputeDAL.transitionIfStatus).mockResolvedValue(true);
      vi.mocked(disputeDAL.createAuditLog).mockResolvedValue({} as never);
      vi.mocked(sendEvidenceDeadlineExpired).mockResolvedValue({
        sent: 2,
        failed: 0,
      });
      return dispute;
    }

    it("moves an expired evidence request to review, only if it is still evidence_requested", async () => {
      const dispute = arrangeExpired();

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result).toEqual({
        enforced: true,
        previousStatus: "evidence_requested",
        newStatus: "under_review",
      });
      // A compare-and-set, not a plain update: support may have resolved it
      // between the read and this write (P-E13-9).
      expect(disputeDAL.transitionIfStatus).toHaveBeenCalledWith(
        mockDisputeId,
        "evidence_requested",
        "under_review",
      );
      expect(disputeDAL.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: mockDisputeId,
          actionType: "state_change",
          previousState: "evidence_requested",
          newState: "under_review",
        }),
      );
      expect(sendEvidenceDeadlineExpired).toHaveBeenCalledWith(dispute);
    });

    it("does nothing, and notifies no one, when the dispute moved in between", async () => {
      arrangeExpired();
      vi.mocked(disputeDAL.transitionIfStatus).mockResolvedValue(false);

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result).toEqual({ enforced: false });
      expect(disputeDAL.createAuditLog).not.toHaveBeenCalled();
      expect(sendEvidenceDeadlineExpired).not.toHaveBeenCalled();
    });

    // The inline notice used to be `if (dispute.rental)` only.
    it("notifies a service dispute too", async () => {
      const service = createMockDispute("evidence_requested", expired, {
        rentalId: null,
        rental: null,
        serviceBookingId: "booking-1",
        serviceBooking: {
          id: "booking-1",
          requesterId: "req-1",
          providerId: "prov-1",
        },
      });
      arrangeExpired(service);

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result.enforced).toBe(true);
      expect(sendEvidenceDeadlineExpired).toHaveBeenCalledWith(service);
    });

    it("still enforces when the notice fails", async () => {
      arrangeExpired();
      vi.mocked(sendEvidenceDeadlineExpired).mockRejectedValue(
        new Error("mail down"),
      );

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result.enforced).toBe(true);
    });

    it("should not enforce when dispute is not in EVIDENCE_REQUESTED state", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(
        createMockDispute("under_review", expired),
      );

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result.enforced).toBe(false);
      expect(disputeDAL.checkEvidenceDeadline).not.toHaveBeenCalled();
      expect(disputeDAL.transitionIfStatus).not.toHaveBeenCalled();
    });

    it("should not enforce when deadline has not expired", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(
        createMockDispute(
          "evidence_requested",
          new Date(Date.now() + 86_400_000),
        ),
      );
      vi.mocked(disputeDAL.checkEvidenceDeadline).mockResolvedValue({
        expired: false,
        deadline: new Date(Date.now() + 86_400_000),
        timeRemaining: 86_400_000,
      });

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result.enforced).toBe(false);
      expect(disputeDAL.transitionIfStatus).not.toHaveBeenCalled();
    });

    it("should return error when dispute not found", async () => {
      vi.mocked(disputeDAL.getById).mockResolvedValue(null);

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result).toEqual({ enforced: false, error: "Dispute not found" });
      expect(disputeDAL.transitionIfStatus).not.toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      vi.mocked(disputeDAL.getById).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      expect(result).toEqual({
        enforced: false,
        error: "Database connection failed",
      });
    });
  });

  describe("isDeadlineExpired", () => {
    it("should return true when deadline has passed", () => {
      const pastDeadline = new Date("2024-01-01T00:00:00Z");
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "evidence_requested",
        policyVersion: "v1.0",
        evidenceDeadline: pastDeadline,
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(DeadlineEnforcementService.isDeadlineExpired(dispute)).toBe(true);
    });

    it("should return false when deadline is in the future", () => {
      const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "evidence_requested",
        policyVersion: "v1.0",
        evidenceDeadline: futureDeadline,
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(DeadlineEnforcementService.isDeadlineExpired(dispute)).toBe(false);
    });

    it("should return false when dispute is not in EVIDENCE_REQUESTED state", () => {
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "open",
        policyVersion: "v1.0",
        evidenceDeadline: new Date("2024-01-01T00:00:00Z"),
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(DeadlineEnforcementService.isDeadlineExpired(dispute)).toBe(false);
    });

    it("should return false when deadline is null", () => {
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "evidence_requested",
        policyVersion: "v1.0",
        evidenceDeadline: null,
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(DeadlineEnforcementService.isDeadlineExpired(dispute)).toBe(false);
    });
  });

  describe("getTimeRemaining", () => {
    it("should return time remaining when deadline is in the future", () => {
      const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "evidence_requested",
        policyVersion: "v1.0",
        evidenceDeadline: futureDeadline,
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const remaining = DeadlineEnforcementService.getTimeRemaining(dispute);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
    });

    it("should return 0 when deadline has passed", () => {
      const pastDeadline = new Date("2024-01-01T00:00:00Z");
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "evidence_requested",
        policyVersion: "v1.0",
        evidenceDeadline: pastDeadline,
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const remaining = DeadlineEnforcementService.getTimeRemaining(dispute);

      expect(remaining).toBe(0);
    });

    it("should return null when dispute is not in EVIDENCE_REQUESTED state", () => {
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "open",
        policyVersion: "v1.0",
        evidenceDeadline: new Date(),
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(DeadlineEnforcementService.getTimeRemaining(dispute)).toBeNull();
    });

    it("should return null when deadline is null", () => {
      const dispute: DisputeWithRelations = {
        id: "dispute-123",
        referenceNumber: 42,
        rentalId: "rental-123",
        serviceBookingId: null,
        createdBy: "user-123",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Test",
        status: "evidence_requested",
        policyVersion: "v1.0",
        evidenceDeadline: null,
        additionalEvidenceDeadline: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        resolutionReason: null,
        stripeChargebackId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(DeadlineEnforcementService.getTimeRemaining(dispute)).toBeNull();
    });
  });
});
