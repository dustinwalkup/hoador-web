import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceListingService } from "../services/service-listing-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";

const mockGetUserById = vi.fn();
const mockListingCreate = vi.fn();
const mockListingGetById = vi.fn();
const mockListingUpdate = vi.fn();
const mockListingDelete = vi.fn();
const mockBookingCountByListing = vi.fn();
const mockAuditCreate = vi.fn();
const mockReviewEventsCreate = vi.fn();
const mockReviewEventsDelete = vi.fn();
const mockSendPending = vi.fn();
const mockSendApproved = vi.fn();
const mockSendRejected = vi.fn();

vi.mock("@/dal", () => ({
  userDAL: { getUserById: (...a: unknown[]) => mockGetUserById(...a) },
  serviceListingDAL: {
    create: (...a: unknown[]) => mockListingCreate(...a),
    getById: (...a: unknown[]) => mockListingGetById(...a),
    update: (...a: unknown[]) => mockListingUpdate(...a),
    delete: (...a: unknown[]) => mockListingDelete(...a),
  },
  serviceBookingDAL: {
    countByListingId: (...a: unknown[]) => mockBookingCountByListing(...a),
  },
  auditLogDAL: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  reviewEventsDAL: {
    createEvent: (...a: unknown[]) => mockReviewEventsCreate(...a),
    deleteEventsForEntity: (...a: unknown[]) => mockReviewEventsDelete(...a),
  },
}));

vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendListingPendingAdminNotification: (...a: unknown[]) =>
    mockSendPending(...a),
  sendListingApprovedNotification: (...a: unknown[]) => mockSendApproved(...a),
  sendListingRejectedNotification: (...a: unknown[]) => mockSendRejected(...a),
}));

const ctx = { ipAddress: "127.0.0.1", userAgent: "vitest" };

const connectUser = {
  id: "prov-1",
  stripeConnectedAccountId: "acct_1",
  connectChargesEnabled: true,
  connectPayoutsEnabled: true,
};

const listing = {
  id: "list-1",
  communityId: "comm-1",
  providerId: "prov-1",
  categoryId: "cat-1",
  title: "T",
  description: "D",
  pricingType: "fixed" as const,
  price: "50.00",
  photos: [] as string[],
  ownerPoliciesAcknowledged: true,
  serviceNotes: null as string | null,
  status: "pending_approval" as const,
  adminNote: null as string | null,
  rejectionReason: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ServiceListingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createListing", () => {
    const form = {
      communityId: "comm-1",
      categoryId: "cat-1",
      title: "T",
      description: "D",
      pricingType: "fixed" as const,
      price: 50,
      ownerPoliciesAcknowledged: true,
    };

    it("returns stripe_connect_required when Connect is not ready", async () => {
      mockGetUserById.mockResolvedValue({
        ...connectUser,
        connectChargesEnabled: false,
      });

      const result = await ServiceListingService.createListing(
        form,
        "prov-1",
        ctx,
      );

      expect(result).toEqual({
        success: false,
        error: "stripe_connect_required",
      });
      expect(mockListingCreate).not.toHaveBeenCalled();
    });

    it("creates listing and sends admin notification when Connect is active", async () => {
      mockGetUserById.mockResolvedValue(connectUser);
      mockListingCreate.mockResolvedValue(listing);

      const result = await ServiceListingService.createListing(
        form,
        "prov-1",
        ctx,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.listing.id).toBe("list-1");
      }
      expect(mockSendPending).toHaveBeenCalledWith(listing);
      expect(mockAuditCreate).toHaveBeenCalled();
    });

    it("passes status pending_approval to DAL create", async () => {
      mockGetUserById.mockResolvedValue(connectUser);
      mockListingCreate.mockResolvedValue(listing);

      await ServiceListingService.createListing(form, "prov-1", ctx);

      expect(mockListingCreate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending_approval" }),
      );
    });
  });

  describe("editListing", () => {
    it("rejects when user is not the owner", async () => {
      mockListingGetById.mockResolvedValue({ ...listing, providerId: "other" });

      await expect(
        ServiceListingService.editListing(
          "list-1",
          "prov-1",
          { title: "New" },
          ctx,
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("updates fields without changing status in normal edit", async () => {
      mockListingGetById.mockResolvedValue(listing);
      mockListingUpdate.mockResolvedValue({ ...listing, title: "New title" });

      await ServiceListingService.editListing(
        "list-1",
        "prov-1",
        { title: "New title" },
        ctx,
      );

      expect(mockListingUpdate).toHaveBeenCalledWith(
        "list-1",
        expect.objectContaining({ title: "New title" }),
      );
      expect(mockListingUpdate.mock.calls[0][1]).not.toHaveProperty("status");
    });

    it("resubmits denied listing to pending_approval on edit", async () => {
      const denied = {
        ...listing,
        status: "denied" as const,
        rejectionReason: "bad",
      };
      const resubmitted = {
        ...denied,
        status: "pending_approval" as const,
        title: "New title",
      };

      mockListingGetById.mockResolvedValue(denied);
      mockListingUpdate.mockResolvedValue(resubmitted);

      await ServiceListingService.editListing(
        "list-1",
        "prov-1",
        { title: "New title" },
        ctx,
      );

      expect(mockListingUpdate).toHaveBeenCalledWith(
        "list-1",
        expect.objectContaining({
          title: "New title",
          status: "pending_approval",
        }),
      );
      expect(mockReviewEventsCreate).toHaveBeenCalledWith({
        entityKind: "service_listing",
        entityId: "list-1",
        eventType: "provider_resubmitted",
        actorUserId: "prov-1",
        note: null,
      });
      expect(mockSendPending).toHaveBeenCalledWith(resubmitted);
    });
  });

  describe("approveListing", () => {
    it("sets status active and notifies provider", async () => {
      const active = { ...listing, status: "active" as const };
      mockListingGetById.mockResolvedValue(listing);
      mockListingUpdate.mockResolvedValue(active);

      const out = await ServiceListingService.approveListing(
        "list-1",
        "admin-1",
        "ok",
      );

      expect(out.status).toBe("active");
      expect(mockSendApproved).toHaveBeenCalledWith("prov-1", active);
      expect(mockReviewEventsCreate).toHaveBeenCalledWith({
        entityKind: "service_listing",
        entityId: "list-1",
        eventType: "approved",
        actorUserId: "admin-1",
        note: "ok",
      });
    });

    it("throws when listing is not pending_approval", async () => {
      mockListingGetById.mockResolvedValue({
        ...listing,
        status: "active" as const,
      });

      await expect(
        ServiceListingService.approveListing("list-1", "admin-1"),
      ).rejects.toThrow("Only pending listings can be approved");
    });

    it("persists optional admin note on approve", async () => {
      const active = { ...listing, status: "active" as const, adminNote: "ok" };
      mockListingGetById.mockResolvedValue(listing);
      mockListingUpdate.mockResolvedValue(active);

      await ServiceListingService.approveListing(
        "list-1",
        "admin-1",
        "reviewed",
      );

      expect(mockListingUpdate).toHaveBeenCalledWith(
        "list-1",
        expect.objectContaining({
          status: "active",
          adminNote: expect.stringContaining("reviewed"),
        }),
      );
      expect(mockReviewEventsCreate).toHaveBeenCalledWith({
        entityKind: "service_listing",
        entityId: "list-1",
        eventType: "approved",
        actorUserId: "admin-1",
        note: "reviewed",
      });
    });
  });

  describe("rejectListing", () => {
    it("requires a non-empty reason", async () => {
      mockListingGetById.mockResolvedValue(listing);

      await expect(
        ServiceListingService.rejectListing("list-1", "admin-1", "   "),
      ).rejects.toThrow(ValidationError);
    });

    it("sets denied status and sends notification with reason", async () => {
      const denied = {
        ...listing,
        status: "denied" as const,
        rejectionReason: "bad",
      };
      mockListingGetById.mockResolvedValue(listing);
      mockListingUpdate.mockResolvedValue(denied);

      const out = await ServiceListingService.rejectListing(
        "list-1",
        "admin-1",
        "policy",
      );

      expect(out.status).toBe("denied");
      expect(mockSendRejected).toHaveBeenCalledWith("prov-1", denied, "policy");
      expect(mockReviewEventsCreate).toHaveBeenCalledWith({
        entityKind: "service_listing",
        entityId: "list-1",
        eventType: "rejected",
        actorUserId: "admin-1",
        note: "policy",
      });
    });

    it("throws when listing is not pending_approval", async () => {
      mockListingGetById.mockResolvedValue({
        ...listing,
        status: "denied" as const,
      });

      await expect(
        ServiceListingService.rejectListing("list-1", "admin-1", "policy"),
      ).rejects.toThrow("Only pending listings can be rejected");
    });
  });

  describe("deactivateListing", () => {
    it("enforces ownership", async () => {
      mockListingGetById.mockResolvedValue({ ...listing, providerId: "other" });

      await expect(
        ServiceListingService.deactivateListing("list-1", "prov-1", ctx),
      ).rejects.toThrow(ForbiddenError);
    });

    it("sets inactive for owner", async () => {
      mockListingGetById.mockResolvedValue(listing);
      mockListingUpdate.mockResolvedValue({ ...listing, status: "inactive" });

      await ServiceListingService.deactivateListing("list-1", "prov-1", ctx);

      expect(mockListingUpdate).toHaveBeenCalledWith("list-1", {
        status: "inactive",
      });
    });
  });

  describe("deleteListing", () => {
    it("enforces ownership", async () => {
      mockListingGetById.mockResolvedValue({ ...listing, providerId: "other" });

      await expect(
        ServiceListingService.deleteListing("list-1", "prov-1", ctx),
      ).rejects.toThrow(ForbiddenError);
    });

    it("blocks deletion when bookings exist", async () => {
      mockListingGetById.mockResolvedValue(listing);
      mockBookingCountByListing.mockResolvedValue(2);

      await expect(
        ServiceListingService.deleteListing("list-1", "prov-1", ctx),
      ).rejects.toThrow(ValidationError);

      expect(mockListingDelete).not.toHaveBeenCalled();
    });

    it("deletes review events and listing when no bookings exist", async () => {
      mockListingGetById.mockResolvedValue(listing);
      mockBookingCountByListing.mockResolvedValue(0);
      mockReviewEventsDelete.mockResolvedValue(undefined);
      mockListingDelete.mockResolvedValue(undefined);

      await ServiceListingService.deleteListing("list-1", "prov-1", ctx);

      expect(mockReviewEventsDelete).toHaveBeenCalledWith(
        "service_listing",
        "list-1",
      );
      expect(mockListingDelete).toHaveBeenCalledWith("list-1");
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "service_listing.deleted",
          entityId: "list-1",
          userId: "prov-1",
        }),
      );
    });
  });

  describe("approveListing not found", () => {
    it("throws NotFoundError", async () => {
      mockListingGetById.mockResolvedValue(null);

      await expect(
        ServiceListingService.approveListing("missing", "admin-1"),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
