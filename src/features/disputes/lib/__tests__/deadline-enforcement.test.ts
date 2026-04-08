import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeadlineEnforcementService } from "../deadline-enforcement";
import { disputeDAL } from "@/dal";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import type { DisputeWithRelations } from "@/dal/types";

// Mock dependencies
vi.mock("@/dal", () => ({
  disputeDAL: {
    getById: vi.fn(),
    checkEvidenceDeadline: vi.fn(),
    updateState: vi.fn(),
    createAuditLog: vi.fn(),
  },
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
}));

describe("DeadlineEnforcementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("checkAndEnforce", () => {
    const mockDisputeId = "dispute-123";
    const mockRentalId = "rental-123";
    const mockRenterId = "renter-123";
    const mockOwnerId = "owner-123";

    const createMockDispute = (
      status: DisputeWithRelations["status"],
      evidenceDeadline: Date | null,
    ): DisputeWithRelations => ({
      id: mockDisputeId,
      referenceNumber: 42,
      rentalId: mockRentalId,
      serviceBookingId: null,
      createdBy: mockRenterId,
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
        id: mockRentalId,
        requestId: null,
        listingId: "listing-123",
        renterId: mockRenterId,
        ownerId: mockOwnerId,
      },
    });

    it("should enforce deadline and transition to UNDER_REVIEW when deadline expired", async () => {
      // Arrange
      const expiredDeadline = new Date("2024-01-01T00:00:00Z"); // Past date
      const mockDispute = createMockDispute(
        "evidence_requested",
        expiredDeadline,
      );

      const updatedDispute = {
        ...mockDispute,
        status: "under_review" as const,
        updatedAt: new Date(),
      };

      vi.mocked(disputeDAL.getById).mockResolvedValue(mockDispute);
      vi.mocked(disputeDAL.checkEvidenceDeadline).mockResolvedValue({
        expired: true,
        deadline: expiredDeadline,
        timeRemaining: 0,
      });
      vi.mocked(disputeDAL.updateState).mockResolvedValue(updatedDispute);
      vi.mocked(disputeDAL.createAuditLog).mockResolvedValue({
        id: "audit-123",
        disputeId: mockDisputeId,
        actionType: "state_change",
        userId: null,
        previousState: "evidence_requested",
        newState: "under_review",
        details: null,
        reason: "Evidence deadline expired - automatic transition",
        createdAt: new Date(),
      });
      vi.mocked(sendNotification).mockResolvedValue({
        success: true,
        notificationId: "notif-123",
      });

      // Act
      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(result.enforced).toBe(true);
      expect(result.previousStatus).toBe("evidence_requested");
      expect(result.newStatus).toBe("under_review");
      expect(disputeDAL.getById).toHaveBeenCalledWith(mockDisputeId);
      expect(disputeDAL.checkEvidenceDeadline).toHaveBeenCalledWith(
        mockDisputeId,
      );
      expect(disputeDAL.updateState).toHaveBeenCalledWith(
        mockDisputeId,
        "under_review",
        undefined,
        "Evidence deadline expired - automatically moved to review",
      );
      expect(disputeDAL.createAuditLog).toHaveBeenCalledWith({
        disputeId: mockDisputeId,
        actionType: "state_change",
        userId: undefined,
        previousState: "evidence_requested",
        newState: "under_review",
        reason: "Evidence deadline expired - automatic transition",
      });
      expect(sendNotification).toHaveBeenCalledTimes(2); // Both renter and owner
    });

    it("should not enforce when dispute is not in EVIDENCE_REQUESTED state", async () => {
      // Arrange
      const mockDispute = createMockDispute("open", new Date());

      vi.mocked(disputeDAL.getById).mockResolvedValue(mockDispute);

      // Act
      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(result.enforced).toBe(false);
      expect(disputeDAL.getById).toHaveBeenCalledWith(mockDisputeId);
      expect(disputeDAL.checkEvidenceDeadline).not.toHaveBeenCalled();
      expect(disputeDAL.updateState).not.toHaveBeenCalled();
    });

    it("should not enforce when deadline has not expired", async () => {
      // Arrange
      const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const mockDispute = createMockDispute(
        "evidence_requested",
        futureDeadline,
      );

      vi.mocked(disputeDAL.getById).mockResolvedValue(mockDispute);
      vi.mocked(disputeDAL.checkEvidenceDeadline).mockResolvedValue({
        expired: false,
        deadline: futureDeadline,
        timeRemaining: 7 * 24 * 60 * 60 * 1000,
      });

      // Act
      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(result.enforced).toBe(false);
      expect(disputeDAL.updateState).not.toHaveBeenCalled();
    });

    it("should return error when dispute not found", async () => {
      // Arrange
      vi.mocked(disputeDAL.getById).mockResolvedValue(null);

      // Act
      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(result.enforced).toBe(false);
      expect(result.error).toBe("Dispute not found");
      expect(disputeDAL.updateState).not.toHaveBeenCalled();
    });

    it("should handle notification errors gracefully", async () => {
      // Arrange
      const expiredDeadline = new Date("2024-01-01T00:00:00Z");
      const mockDispute = createMockDispute(
        "evidence_requested",
        expiredDeadline,
      );

      const updatedDispute = {
        ...mockDispute,
        status: "under_review" as const,
        updatedAt: new Date(),
      };

      vi.mocked(disputeDAL.getById).mockResolvedValue(mockDispute);
      vi.mocked(disputeDAL.checkEvidenceDeadline).mockResolvedValue({
        expired: true,
        deadline: expiredDeadline,
        timeRemaining: 0,
      });
      vi.mocked(disputeDAL.updateState).mockResolvedValue(updatedDispute);
      vi.mocked(disputeDAL.createAuditLog).mockResolvedValue({
        id: "audit-123",
        disputeId: mockDisputeId,
        actionType: "state_change",
        userId: null,
        previousState: "evidence_requested",
        newState: "under_review",
        details: null,
        reason: "Evidence deadline expired - automatic transition",
        createdAt: new Date(),
      });
      vi.mocked(sendNotification).mockRejectedValue(
        new Error("Notification service unavailable"),
      );

      // Act
      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(result.enforced).toBe(true); // Enforcement still succeeds
      expect(disputeDAL.updateState).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "Failed to send deadline expiration notifications:",
        expect.any(Error),
      );
    });

    it("should handle database errors", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      vi.mocked(disputeDAL.getById).mockRejectedValue(dbError);

      // Act
      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(result.enforced).toBe(false);
      expect(result.error).toBe("Database connection failed");
      expect(console.error).toHaveBeenCalledWith(
        "Deadline enforcement failed:",
        dbError,
      );
    });

    it("should send notifications to both renter and owner", async () => {
      // Arrange
      const expiredDeadline = new Date("2024-01-01T00:00:00Z");
      const mockDispute = createMockDispute(
        "evidence_requested",
        expiredDeadline,
      );

      const updatedDispute = {
        ...mockDispute,
        status: "under_review" as const,
        updatedAt: new Date(),
      };

      vi.mocked(disputeDAL.getById).mockResolvedValue(mockDispute);
      vi.mocked(disputeDAL.checkEvidenceDeadline).mockResolvedValue({
        expired: true,
        deadline: expiredDeadline,
        timeRemaining: 0,
      });
      vi.mocked(disputeDAL.updateState).mockResolvedValue(updatedDispute);
      vi.mocked(disputeDAL.createAuditLog).mockResolvedValue({
        id: "audit-123",
        disputeId: mockDisputeId,
        actionType: "state_change",
        userId: null,
        previousState: "evidence_requested",
        newState: "under_review",
        details: null,
        reason: "Evidence deadline expired - automatic transition",
        createdAt: new Date(),
      });
      vi.mocked(sendNotification).mockResolvedValue({
        success: true,
        notificationId: "notif-123",
      });

      // Act
      await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(sendNotification).toHaveBeenCalledWith({
        userId: mockRenterId,
        type: "dispute_evidence_deadline_expired",
        title: "Evidence Deadline Expired",
        message: expect.stringContaining(mockDisputeId),
        data: {
          disputeId: mockDisputeId,
          rentalId: mockRentalId,
        },
        linkUrl: `/dashboard/disputes/${mockDisputeId}`,
      });

      expect(sendNotification).toHaveBeenCalledWith({
        userId: mockOwnerId,
        type: "dispute_evidence_deadline_expired",
        title: "Evidence Deadline Expired",
        message: expect.stringContaining(mockDisputeId),
        data: {
          disputeId: mockDisputeId,
          rentalId: mockRentalId,
        },
        linkUrl: `/dashboard/disputes/${mockDisputeId}`,
      });
    });

    it("should not send notifications when rental is missing", async () => {
      // Arrange
      const expiredDeadline = new Date("2024-01-01T00:00:00Z");
      const mockDispute = {
        ...createMockDispute("evidence_requested", expiredDeadline),
        rental: undefined,
      };

      const updatedDispute = {
        ...mockDispute,
        status: "under_review" as const,
        updatedAt: new Date(),
      };

      vi.mocked(disputeDAL.getById).mockResolvedValue(mockDispute);
      vi.mocked(disputeDAL.checkEvidenceDeadline).mockResolvedValue({
        expired: true,
        deadline: expiredDeadline,
        timeRemaining: 0,
      });
      vi.mocked(disputeDAL.updateState).mockResolvedValue(updatedDispute);
      vi.mocked(disputeDAL.createAuditLog).mockResolvedValue({
        id: "audit-123",
        disputeId: mockDisputeId,
        actionType: "state_change",
        userId: null,
        previousState: "evidence_requested",
        newState: "under_review",
        details: null,
        reason: "Evidence deadline expired - automatic transition",
        createdAt: new Date(),
      });

      // Act
      const result =
        await DeadlineEnforcementService.checkAndEnforce(mockDisputeId);

      // Assert
      expect(result.enforced).toBe(true);
      expect(sendNotification).not.toHaveBeenCalled();
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
