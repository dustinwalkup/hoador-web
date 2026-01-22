import { describe, it, expect, vi, beforeEach } from "vitest";
import { approveListingAction, rejectListingAction } from "../listing-review";
import { rejectionReasonSchema } from "@/features/admin/schemas/listing-review.schema";
import { listingDAL } from "@/dal";
import { requireAdmin } from "@/features/auth/utils/guards";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { mockListing } from "@/test/fixtures/listings";
import { mockAdminUser } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    getListingById: vi.fn(),
    updateApprovalStatus: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/db/db", () => ({
  db: {
    query: {
      user: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/features/notifications/utils/email-templates", () => ({
  generateListingApprovalEmailHtml: vi.fn(() => "<html>Approved</html>"),
  generateListingApprovalEmailText: vi.fn(() => "Approved"),
  generateListingRejectionEmailHtml: vi.fn(() => "<html>Rejected</html>"),
  generateListingRejectionEmailText: vi.fn(() => "Rejected"),
}));

describe("listing-review actions", () => {
  const listingId = "listing-123";
  const mockOwner = {
    id: "owner-123",
    email: "owner@example.com",
    firstName: "John",
    lastName: "Doe",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(mockAdminUser);
    vi.mocked(listingDAL.getListingById).mockResolvedValue({
      ...mockListing,
      owner: {
        ...mockListing.owner,
        id: mockOwner.id,
      },
    } as any);
    vi.mocked(db.query.user.findFirst).mockResolvedValue(mockOwner as any);
    vi.mocked(listingDAL.updateApprovalStatus).mockResolvedValue(undefined);
    vi.mocked(sendNotification).mockResolvedValue({
      success: true,
      notificationId: "notification-123",
    });
  });

  describe("approveListingAction", () => {
    it("should approve listing successfully when admin is authenticated", async () => {
      // Act
      const result = await approveListingAction(listingId);

      // Assert
      expect(result.success).toBe(true);
      expect(requireAdmin).toHaveBeenCalled();
      expect(listingDAL.getListingById).toHaveBeenCalledWith(listingId);
      expect(listingDAL.updateApprovalStatus).toHaveBeenCalledWith(
        listingId,
        "approved",
      );
      expect(sendNotification).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith(
        "/admin/dashboard/listings/review",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
    });

    it("should send notification with correct data", async () => {
      // Act
      await approveListingAction(listingId);

      // Assert
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockOwner.id,
          type: "listing_approved",
          title: "Listing Approved",
          message: expect.stringContaining("has been approved"),
          data: {
            listingId: listingId,
            listingName: mockListing.name,
          },
        }),
      );
    });

    it("should return error when admin authentication fails", async () => {
      // Arrange
      vi.mocked(requireAdmin).mockRejectedValue(
        new Error("Admin access required"),
      );

      // Act
      const result = await approveListingAction(listingId);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.success).toBeUndefined();
    });

    it("should return error when listing not found", async () => {
      // Arrange
      vi.mocked(listingDAL.getListingById).mockRejectedValue(
        new Error("Listing not found"),
      );

      // Act
      const result = await approveListingAction(listingId);

      // Assert
      expect(result.error).toBeDefined();
    });

    it("should return error when update fails", async () => {
      // Arrange
      vi.mocked(listingDAL.updateApprovalStatus).mockRejectedValue(
        new Error("Update failed"),
      );

      // Act
      const result = await approveListingAction(listingId);

      // Assert
      expect(result.error).toBeDefined();
    });

    it("should handle revalidation failure gracefully", async () => {
      // Arrange
      vi.mocked(revalidatePath).mockImplementation(() => {
        throw new Error("Revalidation failed");
      });

      // Act
      const result = await approveListingAction(listingId);

      // Assert
      // Should still succeed even if revalidation fails
      expect(result.success).toBe(true);
      expect(sendNotification).toHaveBeenCalled(); // Notification should still be sent
    });
  });

  describe("rejectListingAction", () => {
    const rejectionReason = "Listing does not meet quality standards";

    it("should reject listing successfully with valid reason", async () => {
      // Act
      const result = await rejectListingAction(listingId, rejectionReason);

      // Assert
      expect(result.success).toBe(true);
      expect(requireAdmin).toHaveBeenCalled();
      expect(listingDAL.updateApprovalStatus).toHaveBeenCalledWith(
        listingId,
        "rejected",
        rejectionReason,
      );
      expect(sendNotification).toHaveBeenCalled();
    });

    it("should send rejection notification with reason", async () => {
      // Act
      await rejectListingAction(listingId, rejectionReason);

      // Assert
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "listing_rejected",
          title: "Listing Needs Changes",
          message: expect.stringContaining("requires changes"),
          data: {
            listingId: listingId,
            listingName: mockListing.name,
            rejectionReason: rejectionReason,
          },
        }),
      );
    });

    it("should return error when rejection reason is too short", async () => {
      // Arrange
      const shortReason = "Too short";

      // Act
      const result = await rejectListingAction(listingId, shortReason);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.success).toBeUndefined();
      expect(listingDAL.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("should return error when rejection reason is empty", async () => {
      // Arrange
      const emptyReason = "   ";

      // Act
      const result = await rejectListingAction(listingId, emptyReason);

      // Assert
      expect(result.error).toBeDefined();
      expect(listingDAL.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("should return error when rejection reason exceeds max length", async () => {
      // Arrange
      const longReason = "x".repeat(1001); // Exceeds 1000 character limit

      // Act
      const result = await rejectListingAction(listingId, longReason);

      // Assert
      expect(result.error).toBeDefined();
      expect(listingDAL.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("should return error when admin authentication fails", async () => {
      // Arrange
      vi.mocked(requireAdmin).mockRejectedValue(
        new Error("Admin access required"),
      );

      // Act
      const result = await rejectListingAction(listingId, rejectionReason);

      // Assert
      expect(result.error).toBeDefined();
    });

    it("should handle revalidation failure gracefully", async () => {
      // Arrange
      vi.mocked(revalidatePath).mockImplementation(() => {
        throw new Error("Revalidation failed");
      });

      // Act
      const result = await rejectListingAction(listingId, rejectionReason);

      // Assert
      expect(result.success).toBe(true);
      expect(sendNotification).toHaveBeenCalled();
    });
  });

  describe("rejectionReasonSchema", () => {
    it("should validate rejection reason with minimum length", () => {
      const result = rejectionReasonSchema.safeParse(
        "This is a valid reason that meets the minimum length requirement",
      );
      expect(result.success).toBe(true);
    });

    it("should reject reason that is too short", () => {
      const result = rejectionReasonSchema.safeParse("Short");
      expect(result.success).toBe(false);
    });

    it("should reject reason that is too long", () => {
      const result = rejectionReasonSchema.safeParse("x".repeat(1001));
      expect(result.success).toBe(false);
    });

    it("should trim whitespace", () => {
      const result = rejectionReasonSchema.safeParse(
        "   Valid reason with enough characters   ",
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Valid reason with enough characters");
      }
    });
  });
});
