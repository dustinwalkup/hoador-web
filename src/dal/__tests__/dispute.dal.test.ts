import { describe, it, expect, vi, beforeEach } from "vitest";
import { DisputeDAL } from "../dispute.dal";
import { NotFoundError, ValidationError } from "../errors";
import { db } from "@/db/db";
import { mockDispute } from "@/test/fixtures/disputes";
import type { DisputeStatus, DisputeReasonCode } from "../types";

// Mock database
vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    query: {
      disputes: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      rentals: {
        findFirst: vi.fn(),
      },
      rentalRequests: {
        findFirst: vi.fn(),
      },
      disputeEvidence: {
        findMany: vi.fn(),
      },
      disputeAuditLogs: {
        findMany: vi.fn(),
      },
      disputeInternalNotes: {
        findMany: vi.fn(),
      },
      disputeFinancialOperations: {
        findMany: vi.fn(),
      },
    },
  },
}));

describe("DisputeDAL", () => {
  let disputeDAL: DisputeDAL;

  beforeEach(() => {
    vi.clearAllMocks();
    disputeDAL = new DisputeDAL();
  });

  describe("create", () => {
    const validDisputeData = {
      rentalId: "rental-123",
      createdBy: "user-123",
      createdByRole: "renter" as const,
      reasonCode: "damage" as DisputeReasonCode,
      description: "Tool was damaged during rental period",
      policyVersion: "v1.0",
    };

    it("should create dispute with valid data", async () => {
      // Arrange
      const mockReturning = vi.fn().mockResolvedValue([mockDispute]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Mock getById to return the created dispute
      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(
        mockDispute as any,
      );

      // Act
      const result = await disputeDAL.create(validDisputeData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockDispute.id);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          rentalId: validDisputeData.rentalId,
          createdBy: validDisputeData.createdBy,
          createdByRole: validDisputeData.createdByRole,
          reasonCode: validDisputeData.reasonCode,
          description: validDisputeData.description,
          status: "open",
        }),
      );
    });

    it("should calculate evidence deadline if not provided", async () => {
      // Arrange
      const beforeCreate = new Date();
      const mockReturning = vi.fn().mockResolvedValue([mockDispute]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(
        mockDispute as any,
      );

      // Act
      await disputeDAL.create(validDisputeData);
      const afterCreate = new Date();

      // Assert
      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.evidenceDeadline).toBeInstanceOf(Date);
      const deadline = valuesCall.evidenceDeadline as Date;
      const expectedDeadline = new Date(beforeCreate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 7);
      expect(deadline.getTime()).toBeGreaterThanOrEqual(
        expectedDeadline.getTime() - 1000,
      );
      expect(deadline.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime() + 7 * 24 * 60 * 60 * 1000 + 1000,
      );
    });

    it("should use provided evidence deadline if provided", async () => {
      // Arrange
      const customDeadline = new Date("2024-02-01");
      const mockReturning = vi.fn().mockResolvedValue([mockDispute]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(
        mockDispute as any,
      );

      // Act
      await disputeDAL.create({
        ...validDisputeData,
        evidenceDeadline: customDeadline,
      });

      // Assert
      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.evidenceDeadline).toEqual(customDeadline);
    });
  });

  describe("getById", () => {
    it("should return dispute with all relations", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(
        mockDispute as any,
      );

      // Act
      const result = await disputeDAL.getById("dispute-123");

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockDispute.id);
      expect(db.query.disputes.findFirst).toHaveBeenCalled();
    });

    it("should return null when dispute not found", async () => {
      // Arrange
      // Drizzle's findFirst returns undefined when not found
      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);

      // Act
      const result = await disputeDAL.getById("non-existent");

      // Assert
      // The DAL method now converts undefined to null
      expect(result).toBeNull();
    });
  });

  describe("getActiveByRentalId", () => {
    it("should return active dispute when exists", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(
        mockDispute as any,
      );

      // Act
      const result = await disputeDAL.getActiveByRentalId("rental-123");

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockDispute.id);
    });

    it("should return null when no active dispute exists", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(null as any);

      // Act
      const result = await disputeDAL.getActiveByRentalId("rental-123");

      // Assert
      expect(result).toBeNull();
    });

    it("should exclude closed disputes", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);

      // Act
      await disputeDAL.getActiveByRentalId("rental-123");

      // Assert
      // The query should use ne(disputes.status, "closed")
      expect(db.query.disputes.findFirst).toHaveBeenCalled();
    });
  });

  describe("getUserDisputes", () => {
    it("should return paginated disputes for user", async () => {
      // Arrange
      const mockDisputes = [mockDispute];
      vi.mocked(db.query.disputes.findMany).mockResolvedValue(
        mockDisputes as any,
      );
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);

      // Act
      const result = await disputeDAL.getUserDisputes("user-123", {
        page: 1,
        limit: 12,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(12);
    });

    it("should filter by role when provided", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findMany).mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);

      // Act
      await disputeDAL.getUserDisputes("user-123", {
        role: "renter",
        page: 1,
        limit: 12,
      });

      // Assert
      expect(db.query.disputes.findMany).toHaveBeenCalled();
    });

    it("should filter by status when provided", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findMany).mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);

      // Act
      await disputeDAL.getUserDisputes("user-123", {
        status: "open",
        page: 1,
        limit: 12,
      });

      // Assert
      expect(db.query.disputes.findMany).toHaveBeenCalled();
    });

    it("should apply default pagination values", async () => {
      // Arrange
      // Note: The implementation applies defaults (page || 1, limit || 12) before validation
      // So page: 0 becomes 1, and limit: 0 becomes 12, which then pass validation
      // This test verifies that defaults are applied correctly
      vi.mocked(db.query.disputes.findMany).mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);

      // Act - page: 0 should default to 1
      const result1 = await disputeDAL.getUserDisputes("user-123", {
        page: 0,
        limit: 12,
      });

      // Assert - should use default page of 1
      expect(result1.pagination.page).toBe(1);
    });

    it("should throw error for invalid limit values", async () => {
      // Arrange
      // Limit validation happens after defaults, so limit: 0 becomes 12 (default)
      // But limit: 101 should still fail validation
      vi.mocked(db.query.disputes.findMany).mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);

      // Act & Assert - limit > 100 should throw
      await expect(
        disputeDAL.getUserDisputes("user-123", { page: 1, limit: 101 }),
      ).rejects.toThrow();
    });
  });

  describe("getAdminDisputes", () => {
    it("should return paginated disputes with filters", async () => {
      // Arrange
      const mockDisputes = [mockDispute];
      vi.mocked(db.query.disputes.findMany).mockResolvedValue(
        mockDisputes as any,
      );
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);

      // Act
      const result = await disputeDAL.getAdminDisputes({
        status: "open",
        reasonCode: "damage",
        page: 1,
        limit: 12,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
    });

    it("should handle empty filters", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findMany).mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);

      // Act
      const result = await disputeDAL.getAdminDisputes({});

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(0);
    });
  });

  describe("updateState", () => {
    it("should update dispute status", async () => {
      // Arrange
      const updatedDispute = { ...mockDispute, status: "under_review" };
      const mockReturning = vi.fn().mockResolvedValue([updatedDispute]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(
        updatedDispute as any,
      );

      // Act
      const result = await disputeDAL.updateState(
        "dispute-123",
        "under_review",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("under_review");
    });

    it("should throw NotFoundError when dispute not found", async () => {
      // Arrange
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act & Assert
      await expect(
        disputeDAL.updateState("non-existent", "under_review"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("resolve", () => {
    it("should resolve dispute with outcome and reason", async () => {
      // Arrange
      const resolvedDispute = {
        ...mockDispute,
        status: "resolved" as DisputeStatus,
        resolvedAt: new Date(),
        resolvedBy: "admin-123",
        resolutionOutcome: "favor_renter" as const,
        resolutionReason: "Evidence clearly shows damage",
      };

      const mockReturning = vi.fn().mockResolvedValue([resolvedDispute]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(
        resolvedDispute as any,
      );

      // Act
      const result = await disputeDAL.resolve(
        "dispute-123",
        "favor_renter",
        "Evidence clearly shows damage",
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("resolved");
      expect(result.resolvedBy).toBe("admin-123");
    });

    it("should throw ValidationError when reason exceeds 1000 characters", async () => {
      // Arrange
      const longReason = "a".repeat(1001);

      // Act & Assert
      await expect(
        disputeDAL.resolve(
          "dispute-123",
          "favor_renter",
          longReason,
          "admin-123",
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when dispute not found", async () => {
      // Arrange
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act & Assert
      await expect(
        disputeDAL.resolve(
          "non-existent",
          "favor_renter",
          "Reason",
          "admin-123",
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("checkRateLimits", () => {
    it("should return rate limit information", async () => {
      // Arrange
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      } as any);

      // Act
      const result = await disputeDAL.checkRateLimits("user-123");

      // Assert
      expect(result).toBeDefined();
      expect(result.monthlyCount).toBe(2);
      expect(result.yearlyCount).toBe(2);
      expect(result.withinLimits).toBe(true);
    });

    it("should return false for withinLimits when monthly limit exceeded", async () => {
      // Arrange
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any);

      // Act
      const result = await disputeDAL.checkRateLimits("user-123");

      // Assert
      expect(result.withinLimits).toBe(false);
    });

    it("should return false for withinLimits when yearly limit exceeded", async () => {
      // Arrange
      // Mock monthly count < 3, but yearly count >= 10
      let callCount = 0;
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve([{ count: callCount === 1 ? 2 : 10 }]);
          }),
        }),
      } as any);

      // Act
      const result = await disputeDAL.checkRateLimits("user-123");

      // Assert
      expect(result.withinLimits).toBe(false);
    });
  });

  describe("validateTimeWindow", () => {
    it("should validate time window for damage reason code", async () => {
      // Arrange
      const rental = {
        id: "rental-123",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-05"),
      };

      vi.mocked(db.query.rentals.findFirst).mockResolvedValue(rental as any);

      // Act
      const result = await disputeDAL.validateTimeWindow(
        "rental-123",
        "damage",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      // Damage: 7 days after endDate = 2024-01-12
      // If current date is before 2024-01-12, valid should be true
    });

    it("should validate time window for non_delivery reason code", async () => {
      // Arrange
      const rental = {
        id: "rental-123",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-05"),
      };

      vi.mocked(db.query.rentals.findFirst).mockResolvedValue(rental as any);

      // Act
      const result = await disputeDAL.validateTimeWindow(
        "rental-123",
        "non_delivery",
      );

      // Assert
      expect(result).toBeDefined();
      // Non-delivery: 3 days after startDate = 2024-01-04
    });

    it("should return invalid when rental not found", async () => {
      // Arrange
      vi.mocked(db.query.rentals.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.rentalRequests.findFirst).mockResolvedValue(undefined);

      // Act
      const result = await disputeDAL.validateTimeWindow(
        "non-existent",
        "damage",
      );

      // Assert
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Rental not found");
    });

    it("should check rental_requests table when rental not found", async () => {
      // Arrange
      const rentalRequest = {
        id: "rental-123",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-05"),
      };

      vi.mocked(db.query.rentals.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.rentalRequests.findFirst).mockResolvedValue(
        rentalRequest as any,
      );

      // Act
      const result = await disputeDAL.validateTimeWindow(
        "rental-123",
        "damage",
      );

      // Assert
      expect(result).toBeDefined();
      expect(db.query.rentalRequests.findFirst).toHaveBeenCalled();
    });
  });

  describe("evidence management", () => {
    it("should create evidence record", async () => {
      // Arrange
      const mockEvidence = {
        id: "evidence-123",
        disputeId: "dispute-123",
        uploadedBy: "user-123",
        uploadedByRole: "renter" as const,
        evidenceType: "image" as const,
        content: "https://example.com/image.jpg",
        uploadedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockEvidence]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await disputeDAL.createEvidence({
        disputeId: "dispute-123",
        uploadedBy: "user-123",
        uploadedByRole: "renter",
        evidenceType: "image",
        content: "https://example.com/image.jpg",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockEvidence.id);
    });

    it("should get evidence by dispute ID", async () => {
      // Arrange
      const mockEvidenceList = [
        {
          id: "evidence-1",
          disputeId: "dispute-123",
          uploadedBy: "user-123",
          uploadedByRole: "renter",
          evidenceType: "image",
          content: "https://example.com/image1.jpg",
          uploadedAt: new Date("2024-01-01"),
        },
        {
          id: "evidence-2",
          disputeId: "dispute-123",
          uploadedBy: "user-123",
          uploadedByRole: "renter",
          evidenceType: "text",
          content: "Text evidence",
          uploadedAt: new Date("2024-01-02"),
        },
      ];

      vi.mocked(db.query.disputeEvidence.findMany).mockResolvedValue(
        mockEvidenceList as any,
      );

      // Act
      const result = await disputeDAL.getEvidenceByDisputeId("dispute-123");

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("evidence-1");
      expect(result[1].id).toBe("evidence-2");
    });

    it("should check evidence deadline", async () => {
      // Arrange
      const dispute = {
        id: "dispute-123",
        status: "evidence_requested" as DisputeStatus,
        evidenceDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        additionalEvidenceDeadline: null,
      };

      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(dispute as any);

      // Act
      const result = await disputeDAL.checkEvidenceDeadline("dispute-123");

      // Assert
      expect(result).toBeDefined();
      expect(result.expired).toBe(false);
      expect(result.deadline).toBeDefined();
      expect(result.timeRemaining).toBeGreaterThan(0);
    });

    it("should return expired true when deadline passed", async () => {
      // Arrange
      const dispute = {
        id: "dispute-123",
        status: "evidence_requested" as DisputeStatus,
        evidenceDeadline: new Date("2024-01-01"),
        additionalEvidenceDeadline: null,
      };

      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(dispute as any);

      // Act
      const result = await disputeDAL.checkEvidenceDeadline("dispute-123");

      // Assert
      expect(result.expired).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it("should throw NotFoundError when dispute not found", async () => {
      // Arrange
      vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        disputeDAL.checkEvidenceDeadline("non-existent"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("audit log management", () => {
    it("should create audit log", async () => {
      // Arrange
      const mockAuditLog = {
        id: "audit-123",
        disputeId: "dispute-123",
        actionType: "state_change" as const,
        userId: "user-123",
        previousState: "open" as DisputeStatus,
        newState: "under_review" as DisputeStatus,
        details: null,
        reason: "Admin requested evidence",
        createdAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockAuditLog]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await disputeDAL.createAuditLog({
        disputeId: "dispute-123",
        actionType: "state_change",
        userId: "user-123",
        previousState: "open",
        newState: "under_review",
        reason: "Admin requested evidence",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockAuditLog.id);
    });

    it("should get audit logs by dispute ID", async () => {
      // Arrange
      const mockAuditLogs = [
        {
          id: "audit-1",
          disputeId: "dispute-123",
          actionType: "dispute_created",
          userId: "user-123",
          previousState: null,
          newState: null,
          details: null,
          reason: null,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "audit-2",
          disputeId: "dispute-123",
          actionType: "state_change",
          userId: "admin-123",
          previousState: "open",
          newState: "under_review",
          details: null,
          reason: "Requesting evidence",
          createdAt: new Date("2024-01-02"),
        },
      ];

      vi.mocked(db.query.disputeAuditLogs.findMany).mockResolvedValue(
        mockAuditLogs as any,
      );

      // Act
      const result = await disputeDAL.getAuditLogsByDisputeId("dispute-123");

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("audit-1");
      expect(result[1].id).toBe("audit-2");
    });
  });

  describe("internal notes management", () => {
    it("should create internal note", async () => {
      // Arrange
      const mockNote = {
        id: "note-123",
        disputeId: "dispute-123",
        adminId: "admin-123",
        content: "Internal note content",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockNote]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await disputeDAL.createInternalNote({
        disputeId: "dispute-123",
        adminId: "admin-123",
        content: "Internal note content",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockNote.id);
    });

    it("should get internal notes by dispute ID (newest first)", async () => {
      // Arrange
      const mockNotes = [
        {
          id: "note-2",
          disputeId: "dispute-123",
          adminId: "admin-123",
          content: "Newer note",
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "note-1",
          disputeId: "dispute-123",
          adminId: "admin-123",
          content: "Older note",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ];

      vi.mocked(db.query.disputeInternalNotes.findMany).mockResolvedValue(
        mockNotes as any,
      );

      // Act
      const result =
        await disputeDAL.getInternalNotesByDisputeId("dispute-123");

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("note-2"); // Newest first
      expect(result[1].id).toBe("note-1");
    });

    it("should update internal note", async () => {
      // Arrange
      const updatedNote = {
        id: "note-123",
        disputeId: "dispute-123",
        adminId: "admin-123",
        content: "Updated content",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([updatedNote]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      const result = await disputeDAL.updateInternalNote(
        "note-123",
        "Updated content",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBe("Updated content");
    });

    it("should throw NotFoundError when updating non-existent note", async () => {
      // Arrange
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act & Assert
      await expect(
        disputeDAL.updateInternalNote("non-existent", "Content"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should delete internal note", async () => {
      // Arrange
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act
      await disputeDAL.deleteInternalNote("note-123");

      // Assert
      expect(db.delete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe("financial operations management", () => {
    it("should create financial operation", async () => {
      // Arrange
      const mockOperation = {
        id: "financial-123",
        disputeId: "dispute-123",
        operationType: "refund_full" as const,
        amount: "150.00",
        stripeOperationId: "refund_123",
        stripePaymentIntentId: "pi_123",
        stripeTransferId: null,
        status: "succeeded" as const,
        errorMessage: null,
        performedBy: "admin-123",
        performedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockOperation]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await disputeDAL.createFinancialOperation({
        disputeId: "dispute-123",
        operationType: "refund_full",
        amount: "150.00",
        stripeOperationId: "refund_123",
        stripePaymentIntentId: "pi_123",
        status: "succeeded",
        performedBy: "admin-123",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockOperation.id);
    });

    it("should get financial operations by dispute ID", async () => {
      // Arrange
      const mockOperations = [
        {
          id: "financial-2",
          disputeId: "dispute-123",
          operationType: "refund_full",
          amount: "150.00",
          stripeOperationId: "refund_123",
          stripePaymentIntentId: "pi_123",
          stripeTransferId: null,
          status: "succeeded",
          errorMessage: null,
          performedBy: "admin-123",
          performedAt: new Date("2024-01-02"),
        },
        {
          id: "financial-1",
          disputeId: "dispute-123",
          operationType: "hold_payout",
          amount: null,
          stripeOperationId: null,
          stripePaymentIntentId: "pi_123",
          stripeTransferId: null,
          status: "succeeded",
          errorMessage: null,
          performedBy: "admin-123",
          performedAt: new Date("2024-01-01"),
        },
      ];

      vi.mocked(db.query.disputeFinancialOperations.findMany).mockResolvedValue(
        mockOperations as any,
      );

      // Act
      const result =
        await disputeDAL.getFinancialOperationsByDisputeId("dispute-123");

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("financial-2"); // Newest first
      expect(result[1].id).toBe("financial-1");
    });
  });
});
