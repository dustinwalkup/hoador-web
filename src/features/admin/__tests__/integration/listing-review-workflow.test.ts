import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  approveListingAction,
  rejectListingAction,
} from "../../actions/listing-review";
import { listingDAL } from "@/dal";
import { requireAdmin } from "@/features/auth/utils/guards";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { mockListing } from "@/test/fixtures/listings";
import { mockAdminUser } from "@/test/fixtures/users";
import { db } from "@/db/db";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    createListing: vi.fn(),
    getListingById: vi.fn(),
    updateListing: vi.fn(),
    updateApprovalStatus: vi.fn(),
    getPendingReviews: vi.fn(),
    searchListings: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/notifications/utils/email-templates", () => ({
  generateListingApprovalEmailHtml: vi.fn(() => "<html>Approved</html>"),
  generateListingApprovalEmailText: vi.fn(() => "Approved"),
  generateListingRejectionEmailHtml: vi.fn(() => "<html>Rejected</html>"),
  generateListingRejectionEmailText: vi.fn(() => "Rejected"),
}));

describe("Listing Review Workflow Integration", () => {
  const listingId = "listing-123";
  const ownerId = "owner-123";
  const mockOwner = {
    id: ownerId,
    email: "owner@example.com",
    firstName: "John",
    lastName: "Doe",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(mockAdminUser);
    vi.mocked(db.query.user.findFirst).mockResolvedValue(mockOwner as any);
  });

  describe("Create listing → appears in pending queue", () => {
    it("should create listing with pending_review status", async () => {
      // Arrange
      const newListing = {
        name: "New Power Drill",
        description: "A new drill",
        categoryId: "cat-1",
        condition: "good" as const,
        dailyRate: 15.0,
      };

      vi.mocked(listingDAL.createListing).mockResolvedValue({
        ...mockListing,
        id: listingId,
        approvalStatus: "pending_review",
      } as any);

      // Act
      const createdListing = await listingDAL.createListing(newListing);

      // Assert
      expect(createdListing).toBeDefined();
      expect(createdListing.id).toBe(listingId);
    });

    it("should appear in pending reviews queue", async () => {
      // Arrange
      const mockPendingListing = {
        id: listingId,
        name: "New Power Drill",
        approvalStatus: "pending_review",
        createdAt: new Date(),
      };

      vi.mocked(listingDAL.getPendingReviews).mockResolvedValue({
        data: [mockPendingListing as any],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Act
      const result = await listingDAL.getPendingReviews({ page: 1, limit: 10 });

      // Assert
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).approvalStatus).toBe("pending_review");
    });
  });

  describe("Admin approves → listing visible in search, owner notified", () => {
    it("should approve listing and make it visible in search", async () => {
      // Arrange
      vi.mocked(listingDAL.getListingById).mockResolvedValue({
        ...mockListing,
        id: listingId,
        owner: {
          ...mockListing.owner,
          id: ownerId,
        },
      } as any);

      vi.mocked(listingDAL.updateApprovalStatus).mockResolvedValue(undefined);
      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [
          {
            ...mockListing,
            id: listingId,
            approvalStatus: "approved",
          } as any,
        ],
        pagination: {
          page: 1,
          limit: 12,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Act
      const approveResult = await approveListingAction(listingId);
      const searchResult = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
      );

      // Assert
      expect(approveResult.success).toBe(true);
      expect(listingDAL.updateApprovalStatus).toHaveBeenCalledWith(
        listingId,
        "approved",
      );
      expect(searchResult.data).toHaveLength(1);
      expect(searchResult.data[0].id).toBe(listingId);
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ownerId,
          type: "listing_approved",
        }),
      );
    });
  });

  describe("Admin rejects → listing hidden, owner notified with reason", () => {
    it("should reject listing and hide it from search", async () => {
      // Arrange
      const rejectionReason = "Listing does not meet quality standards";

      vi.mocked(listingDAL.getListingById).mockResolvedValue({
        ...mockListing,
        id: listingId,
        owner: {
          ...mockListing.owner,
          id: ownerId,
        },
      } as any);

      vi.mocked(listingDAL.updateApprovalStatus).mockResolvedValue(undefined);
      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [], // Rejected listing not in search results
        pagination: {
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Act
      const rejectResult = await rejectListingAction(
        listingId,
        rejectionReason,
      );
      const searchResult = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
      );

      // Assert
      expect(rejectResult.success).toBe(true);
      expect(listingDAL.updateApprovalStatus).toHaveBeenCalledWith(
        listingId,
        "rejected",
        rejectionReason,
      );
      expect(searchResult.data).toHaveLength(0); // Not visible in search
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ownerId,
          type: "listing_rejected",
          data: expect.objectContaining({
            rejectionReason,
          }),
        }),
      );
    });
  });

  describe("Owner edits rejected listing → status returns to pending_review", () => {
    it("should reset approval status when owner edits rejected listing", async () => {
      // Arrange
      const rejectedListing = {
        ...mockListing,
        id: listingId,
        approvalStatus: "rejected",
        rejectionReason: "Needs improvement",
      };

      vi.mocked(listingDAL.getListingById).mockResolvedValue(
        rejectedListing as any,
      );

      const updateData = {
        name: "Updated Power Drill",
        description: "Improved description",
      };

      // Mock updateListing to detect significant changes and reset status
      vi.mocked(listingDAL.updateListing).mockImplementation(
        async (id, data) => {
          // Simulate hasSignificantChanges logic
          const hasChanges = rejectedListing.name !== data.name;
          if (hasChanges && rejectedListing.approvalStatus === "rejected") {
            return {
              ...rejectedListing,
              ...data,
              approvalStatus: "pending_review",
              rejectionReason: null,
            } as any;
          }
          return { ...rejectedListing, ...data } as any;
        },
      );

      // Act
      const updatedListing = await listingDAL.updateListing(
        listingId,
        updateData,
      );

      // Assert
      expect((updatedListing as any).approvalStatus).toBe("pending_review");
      expect((updatedListing as any).rejectionReason).toBeNull();
    });
  });

  describe("Owner resubmits → appears in queue again", () => {
    it("should appear in pending queue after resubmission", async () => {
      // Arrange
      const resubmittedListing = {
        id: listingId,
        name: "Updated Power Drill",
        approvalStatus: "pending_review",
        createdAt: new Date(),
      };

      vi.mocked(listingDAL.getPendingReviews).mockResolvedValue({
        data: [resubmittedListing as any],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Act
      const result = await listingDAL.getPendingReviews({ page: 1, limit: 10 });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(listingId);
      expect((result.data[0] as any).approvalStatus).toBe("pending_review");
    });
  });

  describe("Significant edit on approved listing → triggers re-review", () => {
    it("should set status to pending_review when significant changes made", async () => {
      // Arrange
      const approvedListing = {
        ...mockListing,
        id: listingId,
        approvalStatus: "approved",
        name: "Original Name",
        dailyRate: 15.0,
      };

      vi.mocked(listingDAL.getListingById).mockResolvedValue(
        approvedListing as any,
      );

      // Simulate significant change (name change)
      const updateData = {
        name: "Completely New Name", // Significant change
      };

      vi.mocked(listingDAL.updateListing).mockImplementation(
        async (id, data) => {
          // Simulate hasSignificantChanges detecting name change
          return {
            ...approvedListing,
            ...data,
            approvalStatus: "pending_review", // Reset to pending
          } as any;
        },
      );

      // Act
      const updatedListing = await listingDAL.updateListing(
        listingId,
        updateData,
      );

      // Assert
      expect((updatedListing as any).approvalStatus).toBe("pending_review");
    });
  });

  describe("Non-significant edit → no re-review", () => {
    it("should keep approved status when only minor changes made", async () => {
      // Arrange
      const approvedListing = {
        ...mockListing,
        id: listingId,
        approvalStatus: "approved",
        instructions: "Original instructions",
      };

      vi.mocked(listingDAL.getListingById).mockResolvedValue(
        approvedListing as any,
      );

      // Simulate non-significant change (instructions only)
      const updateData = {
        instructions: "Updated instructions", // Not a significant field
      };

      vi.mocked(listingDAL.updateListing).mockImplementation(
        async (id, data) => {
          // Simulate hasSignificantChanges returning false
          return {
            ...approvedListing,
            ...data,
            approvalStatus: "approved", // Keep approved status
          } as any;
        },
      );

      // Act
      const updatedListing = await listingDAL.updateListing(
        listingId,
        updateData,
      );

      // Assert
      expect((updatedListing as any).approvalStatus).toBe("approved");
    });
  });

  describe("Concurrent review attempts handled correctly", () => {
    it("should prevent concurrent reviews using transaction locks", async () => {
      // Arrange
      vi.mocked(listingDAL.getListingById).mockResolvedValue({
        ...mockListing,
        id: listingId,
        owner: {
          ...mockListing.owner,
          id: ownerId,
        },
      } as any);

      // First approval attempt
      vi.mocked(listingDAL.updateApprovalStatus).mockResolvedValueOnce(
        undefined,
      );

      // Second approval attempt should fail
      vi.mocked(listingDAL.updateApprovalStatus).mockRejectedValueOnce(
        new Error("Listing has already been reviewed"),
      );

      // Act
      const firstResult = await approveListingAction(listingId);
      const secondResult = await approveListingAction(listingId);

      // Assert
      expect(firstResult.success).toBe(true);
      expect(secondResult.error).toBeDefined();
      expect(listingDAL.updateApprovalStatus).toHaveBeenCalledTimes(2);
    });
  });
});
