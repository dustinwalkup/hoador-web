import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";
import { mockDispute } from "@/test/fixtures/disputes";

vi.mock("@/dal", () => ({
  disputeDAL: {
    getActiveByRentalId: vi.fn(),
    getAnyByRentalId: vi.fn().mockResolvedValue(null),
    getActiveByServiceBookingId: vi.fn().mockResolvedValue(null),
    getAnyByServiceBookingId: vi.fn().mockResolvedValue(null),
    validateFilingWindowUnified: vi.fn(),
    checkRateLimits: vi.fn(),
    create: vi.fn(),
    createAuditLog: vi.fn(),
  },
  rentalDAL: {
    getRentalDetailsById: vi.fn(),
    getRentalByRequestId: vi.fn(),
  },
  legalDocumentDAL: {
    getCurrentVersion: vi.fn(),
  },
  auditLogDAL: {
    create: vi.fn(),
  },
  paymentLifecycleDAL: {
    freezeForDispute: vi.fn(),
  },
  serviceBookingDAL: {
    getById: vi.fn(),
  },
  servicePaymentLifecycleDAL: {
    getByBookingId: vi.fn().mockResolvedValue(null),
    freezeForDispute: vi.fn(),
  },
}));

vi.mock("@/features/disputes/notifications/dispute-notifications", () => ({
  sendDisputeNotifications: vi.fn(),
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn().mockResolvedValue(undefined),
}));

import {
  disputeDAL,
  rentalDAL,
  legalDocumentDAL,
  auditLogDAL,
  paymentLifecycleDAL,
  serviceBookingDAL,
  servicePaymentLifecycleDAL,
} from "@/dal";
import { sendDisputeNotifications } from "@/features/disputes/notifications/dispute-notifications";
import { DisputeCreationService } from "../dispute-creation-service";

const mockRentalDetails = {
  id: "request-123",
  type: "request" as const,
  renterId: "user-renter",
  ownerId: "user-owner",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-01-07"),
};

describe("DisputeCreationService.createDispute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("34.1 Successful creation - dispute created, payout frozen, audit logs, notifications", async () => {
    const actualRentalId = "rental-actual-123";
    const createdDispute = {
      ...mockDispute,
      id: "dispute-new",
      rentalId: actualRentalId,
      createdBy: "user-renter",
      createdByRole: "renter" as const,
    };

    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: actualRentalId,
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
    vi.mocked(disputeDAL.validateFilingWindowUnified).mockResolvedValue({
      valid: true,
    });
    vi.mocked(disputeDAL.checkRateLimits).mockResolvedValue({
      withinLimits: true,
      monthlyCount: 1,
      yearlyCount: 2,
    });
    vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue({
      version: "v1.0",
      url: "https://example.com/policy",
    } as never);
    vi.mocked(disputeDAL.create).mockResolvedValue(createdDispute as never);
    vi.mocked(paymentLifecycleDAL.freezeForDispute).mockResolvedValue(
      undefined as never,
    );
    vi.mocked(auditLogDAL.create).mockResolvedValue(undefined as never);
    vi.mocked(disputeDAL.createAuditLog).mockResolvedValue(undefined as never);
    vi.mocked(sendDisputeNotifications).mockResolvedValue(undefined);

    const result = await DisputeCreationService.createDispute({
      rentalId: "request-123",
      reasonCode: "damage",
      description: "Tool was damaged",
      userId: "user-renter",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    expect(result.dispute).toEqual(createdDispute);
    expect(disputeDAL.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: actualRentalId,
        createdBy: "user-renter",
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Tool was damaged",
      }),
    );
    expect(paymentLifecycleDAL.freezeForDispute).toHaveBeenCalledWith(
      actualRentalId,
    );
    expect(auditLogDAL.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "dispute",
        entityId: "dispute-new",
        action: "dispute.opened",
        userId: "user-renter",
        metadata: { reasonCode: "damage", createdByRole: "renter" },
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      }),
    );
    expect(disputeDAL.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId: "dispute-new",
        actionType: "dispute_created",
        userId: "user-renter",
        details: { reasonCode: "damage", createdByRole: "renter" },
      }),
    );
    expect(sendDisputeNotifications).toHaveBeenCalledWith(
      createdDispute,
      "created",
    );
  });

  it("34.2 Authorization - user is neither renter nor owner → throws ForbiddenError", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: "rental-actual-123",
    });

    await expect(
      DisputeCreationService.createDispute({
        rentalId: "request-123",
        reasonCode: "damage",
        description: "Test",
        userId: "user-other",
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(disputeDAL.getActiveByRentalId).not.toHaveBeenCalled();
    expect(disputeDAL.create).not.toHaveBeenCalled();
  });

  // P-E13-3 retyped these three. They were `ValidationError` / `ConflictError`
  // — the same class, status and body as "description too short" — so a client
  // could only tell them apart by matching the prose, which mobile's rule #8
  // forbids. The assertions now pin the code AND the payload, because the
  // payload is the point: `disputeId` is what Req 19.1.3's "route to it" needs.
  it("34.3 Filing window expired → DISPUTE_WINDOW_CLOSED with the deadline", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: "rental-actual-123",
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
    const deadline = new Date("2026-03-01T00:00:00Z");
    vi.mocked(disputeDAL.validateFilingWindowUnified).mockResolvedValue({
      valid: false,
      deadline,
      message:
        "The dispute filing window closed 24 hours after the return was confirmed",
    });

    await expect(
      DisputeCreationService.createDispute({
        rentalId: "request-123",
        reasonCode: "damage",
        description: "Test",
        userId: "user-renter",
      }),
    ).rejects.toMatchObject({
      code: "DISPUTE_WINDOW_CLOSED",
      statusCode: 400,
      details: { deadline: deadline.toISOString(), reason: "closed" },
    });

    expect(disputeDAL.create).not.toHaveBeenCalled();
  });

  it("34.3b Filing window not open yet → DISPUTE_WINDOW_CLOSED with no deadline", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: "rental-actual-123",
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
    vi.mocked(disputeDAL.validateFilingWindowUnified).mockResolvedValue({
      valid: false,
      message: "Disputes cannot be filed before the rental start date",
    });

    await expect(
      DisputeCreationService.createDispute({
        rentalId: "request-123",
        reasonCode: "damage",
        description: "Test",
        userId: "user-renter",
      }),
    ).rejects.toMatchObject({
      code: "DISPUTE_WINDOW_CLOSED",
      details: { deadline: null, reason: "not_open_yet" },
    });
  });

  it("34.4 Active dispute exists → DISPUTE_ALREADY_EXISTS carrying its id", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: "rental-actual-123",
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(
      mockDispute as never,
    );

    await expect(
      DisputeCreationService.createDispute({
        rentalId: "request-123",
        reasonCode: "damage",
        description: "Test",
        userId: "user-renter",
      }),
    ).rejects.toMatchObject({
      code: "DISPUTE_ALREADY_EXISTS",
      statusCode: 409,
      details: { disputeId: mockDispute.id, resolved: false },
    });

    expect(disputeDAL.create).not.toHaveBeenCalled();
  });

  it("34.4b Resolved dispute exists → DISPUTE_ALREADY_EXISTS with resolved: true", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: "rental-actual-123",
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
    // `...Once`, not `...Value`: these mocks are configured per test and never
    // reset, so a persistent implementation here leaks a resolved prior dispute
    // into every test that follows and fails them all.
    vi.mocked(disputeDAL.getAnyByRentalId).mockResolvedValueOnce({
      ...mockDispute,
      id: "dispute-old",
      status: "resolved",
    } as never);

    // F19: the unique index makes this one dispute per rental *ever*, not one
    // at a time — so the client has to be able to say "this is finished", not
    // just "there is one open".
    await expect(
      DisputeCreationService.createDispute({
        rentalId: "request-123",
        reasonCode: "damage",
        description: "Test",
        userId: "user-renter",
      }),
    ).rejects.toMatchObject({
      code: "DISPUTE_ALREADY_EXISTS",
      details: { disputeId: "dispute-old", resolved: true },
    });
  });

  it("34.5 Rate limits exceeded → DISPUTE_RATE_LIMITED (429) with the counts", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: "rental-actual-123",
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
    vi.mocked(disputeDAL.validateFilingWindowUnified).mockResolvedValue({
      valid: true,
    });
    vi.mocked(disputeDAL.checkRateLimits).mockResolvedValue({
      withinLimits: false,
      monthlyCount: 4,
      yearlyCount: 5,
    });

    await expect(
      DisputeCreationService.createDispute({
        rentalId: "request-123",
        reasonCode: "damage",
        description: "Test",
        userId: "user-renter",
      }),
    ).rejects.toMatchObject({
      code: "DISPUTE_RATE_LIMITED",
      statusCode: 429,
      details: {
        monthlyCount: 4,
        monthlyLimit: 3,
        yearlyCount: 5,
        yearlyLimit: 10,
      },
    });

    expect(disputeDAL.create).not.toHaveBeenCalled();
  });

  it("34.6a Listing owner files dispute → createdByRole is owner", async () => {
    const actualRentalId = "rental-actual-owner";
    const createdDispute = {
      ...mockDispute,
      id: "dispute-owner",
      rentalId: actualRentalId,
      createdBy: "user-owner",
      createdByRole: "owner" as const,
    };

    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: actualRentalId,
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
    vi.mocked(disputeDAL.validateFilingWindowUnified).mockResolvedValue({
      valid: true,
    });
    vi.mocked(disputeDAL.checkRateLimits).mockResolvedValue({
      withinLimits: true,
      monthlyCount: 0,
      yearlyCount: 0,
    });
    vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue({
      version: "v1.0",
    } as never);
    vi.mocked(disputeDAL.create).mockResolvedValue(createdDispute as never);
    vi.mocked(paymentLifecycleDAL.freezeForDispute).mockResolvedValue(
      undefined as never,
    );
    vi.mocked(auditLogDAL.create).mockResolvedValue(undefined as never);
    vi.mocked(disputeDAL.createAuditLog).mockResolvedValue(undefined as never);
    vi.mocked(sendDisputeNotifications).mockResolvedValue(undefined);

    await DisputeCreationService.createDispute({
      rentalId: "request-123",
      reasonCode: "damage",
      description: "Renter did not return item",
      userId: "user-owner",
    });

    expect(disputeDAL.create).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: "user-owner",
        createdByRole: "owner",
        reasonCode: "damage",
      }),
    );
  });

  it("34.6 Lifecycle freeze edge case - freezeForDispute called with actual rental ID", async () => {
    const actualRentalId = "rental-actual-456";
    const createdDispute = {
      ...mockDispute,
      id: "dispute-freeze-test",
      rentalId: actualRentalId,
    };

    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue({
      id: actualRentalId,
    });
    vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
    vi.mocked(disputeDAL.validateFilingWindowUnified).mockResolvedValue({
      valid: true,
    });
    vi.mocked(disputeDAL.checkRateLimits).mockResolvedValue({
      withinLimits: true,
      monthlyCount: 0,
      yearlyCount: 0,
    });
    vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue({
      version: "v1.0",
    } as never);
    vi.mocked(disputeDAL.create).mockResolvedValue(createdDispute as never);
    vi.mocked(paymentLifecycleDAL.freezeForDispute).mockResolvedValue(
      undefined as never,
    );
    vi.mocked(auditLogDAL.create).mockResolvedValue(undefined as never);
    vi.mocked(disputeDAL.createAuditLog).mockResolvedValue(undefined as never);
    vi.mocked(sendDisputeNotifications).mockResolvedValue(undefined);

    await DisputeCreationService.createDispute({
      rentalId: "request-123",
      reasonCode: "damage",
      description: "Test",
      userId: "user-renter",
    });

    expect(paymentLifecycleDAL.freezeForDispute).toHaveBeenCalledWith(
      actualRentalId,
    );
    expect(paymentLifecycleDAL.freezeForDispute).not.toHaveBeenCalledWith(
      "request-123",
    );
  });

  it("throws NotFoundError when rental not found", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(null as never);

    await expect(
      DisputeCreationService.createDispute({
        rentalId: "missing-request",
        reasonCode: "damage",
        description: "Test",
        userId: "user-renter",
      }),
    ).rejects.toThrow(NotFoundError);

    expect(disputeDAL.create).not.toHaveBeenCalled();
  });

  it("throws ValidationError when request not yet approved (getRentalByRequestId returns null)", async () => {
    vi.mocked(rentalDAL.getRentalDetailsById).mockResolvedValue(
      mockRentalDetails as never,
    );
    vi.mocked(rentalDAL.getRentalByRequestId).mockResolvedValue(null);

    await expect(
      DisputeCreationService.createDispute({
        rentalId: "request-123",
        reasonCode: "damage",
        description: "Test",
        userId: "user-renter",
      }),
    ).rejects.toThrow(ValidationError);

    expect(disputeDAL.create).not.toHaveBeenCalled();
  });

  describe("service booking disputes", () => {
    const bookingDetail = {
      id: "booking-1",
      requesterId: "requester-1",
      providerId: "provider-1",
      status: "accepted" as const,
      proposedDate: "2024-01-01",
      proposedTime: "10:00",
      completedAt: null,
    };

    it("34.2s Authorization - user is neither requester nor provider → throws ForbiddenError", async () => {
      vi.mocked(serviceBookingDAL.getById).mockResolvedValue(
        bookingDetail as never,
      );

      await expect(
        DisputeCreationService.createDispute({
          serviceBookingId: "booking-1",
          reasonCode: "damage",
          description: "Test",
          userId: "stranger-1",
        }),
      ).rejects.toThrow(ForbiddenError);

      expect(
        servicePaymentLifecycleDAL.freezeForDispute,
      ).not.toHaveBeenCalled();
      expect(disputeDAL.create).not.toHaveBeenCalled();
    });

    it("lets the requester past the party check", async () => {
      vi.mocked(serviceBookingDAL.getById).mockResolvedValue(
        bookingDetail as never,
      );
      vi.mocked(disputeDAL.checkRateLimits).mockResolvedValue({
        withinLimits: true,
        monthlyCount: 0,
        yearlyCount: 0,
      });
      vi.mocked(disputeDAL.create).mockResolvedValue({
        ...mockDispute,
        id: "dispute-service-1",
        serviceBookingId: "booking-1",
        rentalId: null,
        createdBy: "requester-1",
        createdByRole: "requester" as const,
      } as never);

      await DisputeCreationService.createDispute({
        serviceBookingId: "booking-1",
        reasonCode: "damage",
        description: "Test",
        userId: "requester-1",
      });

      expect(servicePaymentLifecycleDAL.freezeForDispute).toHaveBeenCalledWith(
        "booking-1",
      );
      expect(disputeDAL.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceBookingId: "booking-1",
          createdBy: "requester-1",
          createdByRole: "requester",
        }),
      );
    });
  });
});
