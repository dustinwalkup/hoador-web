import type {
  DisputeWithRelations,
  DisputeStatus,
  DisputeReasonCode,
  DisputeResolutionOutcome,
} from "@/dal/types";
import type { PaginatedResult } from "@/dal/types";

export const mockDispute: DisputeWithRelations = {
  id: "dispute-123",
  rentalId: "rental-123",
  createdBy: "user-123",
  createdByRole: "renter",
  reasonCode: "damage",
  description: "Tool was damaged during rental period",
  status: "open",
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
    renterId: "user-123",
    ownerId: "user-456",
  },
  createdByUser: {
    id: "user-123",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
  },
  resolvedByUser: null,
  evidence: [],
  auditLogs: [
    {
      id: "audit-1",
      disputeId: "dispute-123",
      actionType: "dispute_created",
      userId: "user-123",
      previousState: null,
      newState: null,
      details: {
        reasonCode: "damage",
        createdByRole: "renter",
      },
      reason: null,
      createdAt: new Date("2024-01-08"),
    },
  ],
  internalNotes: [],
  financialOperations: [],
};

export const mockDisputeWithEvidence: DisputeWithRelations = {
  ...mockDispute,
  id: "dispute-456",
  status: "evidence_requested",
  evidence: [
    {
      id: "evidence-1",
      disputeId: "dispute-456",
      uploadedBy: "user-123",
      uploadedByRole: "renter",
      evidenceType: "image",
      content: "https://example.com/evidence1.jpg",
      uploadedAt: new Date("2024-01-09"),
    },
    {
      id: "evidence-2",
      disputeId: "dispute-456",
      uploadedBy: "user-123",
      uploadedByRole: "renter",
      evidenceType: "text",
      content: "Additional context about the damage",
      uploadedAt: new Date("2024-01-09"),
    },
  ],
};

export const mockResolvedDispute: DisputeWithRelations = {
  ...mockDispute,
  id: "dispute-789",
  status: "resolved",
  resolvedAt: new Date("2024-01-10"),
  resolvedBy: "admin-123",
  resolutionOutcome: "favor_renter",
  resolutionReason: "Evidence clearly shows damage occurred during rental",
  resolvedByUser: {
    id: "admin-123",
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
  },
  financialOperations: [
    {
      id: "financial-1",
      disputeId: "dispute-789",
      operationType: "refund_full",
      amount: "150.00",
      stripeOperationId: "refund_123",
      stripePaymentIntentId: "pi_123",
      stripeTransferId: null,
      status: "succeeded",
      errorMessage: null,
      performedBy: "admin-123",
      performedAt: new Date("2024-01-10"),
    },
  ],
};

export const mockPaginatedDisputes: PaginatedResult<DisputeWithRelations> = {
  data: [mockDispute, mockDisputeWithEvidence],
  pagination: {
    page: 1,
    limit: 12,
    total: 2,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

export const mockCreateDisputeData = {
  rentalId: "rental-123",
  reasonCode: "damage" as DisputeReasonCode,
  description: "Tool was damaged during rental period",
};

export const mockUploadEvidenceData = {
  file: new File(["test"], "test.jpg", { type: "image/jpeg" }),
};

export const mockUploadTextEvidenceData = {
  text: "This is text evidence describing the issue",
};

export const mockResolveDisputeData = {
  outcome: "favor_renter" as DisputeResolutionOutcome,
  reason: "Evidence clearly shows damage occurred during rental",
  financialOperations: [
    {
      type: "refund_full" as const,
    },
  ],
};

export const mockUpdateStateData = {
  newState: "evidence_requested" as DisputeStatus,
  reason: "Requesting additional evidence from both parties",
};
