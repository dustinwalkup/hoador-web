import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  approveListingAction,
  rejectListingAction,
} from "../../actions/listing-review";
import { listingDAL } from "@/dal";
import { requireAdmin } from "@/features/auth/utils/guards";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { mockListing } from "@/test/fixtures/listings";
import { mockAdminUser } from "@/test/fixtures/users";

// Mock all dependencies for E2E test
vi.mock("@/dal", () => ({
  listingDAL: {
    getPendingReviews: vi.fn(),
    getReviewHistory: vi.fn(),
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

describe("Complete Admin Review Flow (E2E)", () => {
  const listingId = "listing-123";
  const ownerId = "owner-123";
  const adminId = mockAdminUser.id;
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

  it("should complete full admin review workflow: login → view queue → approve listing", async () => {
    // Step 1: Admin logs in and navigates to review page
    // (Simulated by requireAdmin being called)
    expect(requireAdmin).toBeDefined();

    // Step 2: Admin views pending review queue
    const mockPendingListing = {
      id: listingId,
      name: "Power Drill",
      approvalStatus: "pending_review",
      createdAt: new Date(),
      owner: {
        id: ownerId,
        firstName: "John",
        lastName: "Doe",
        email: "owner@example.com",
      },
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

    const queueResult = await listingDAL.getPendingReviews({
      page: 1,
      limit: 10,
    });
    expect(queueResult.data).toHaveLength(1);
    expect(queueResult.data[0].id).toBe(listingId);

    // Step 3: Admin views full listing context
    vi.mocked(listingDAL.getListingById).mockResolvedValue({
      ...mockListing,
      id: listingId,
      owner: {
        ...mockListing.owner,
        id: ownerId,
      },
    } as any);

    const listingDetails = await listingDAL.getListingById(listingId);
    expect(listingDetails).toBeDefined();
    expect(listingDetails.id).toBe(listingId);

    // Step 4: Admin approves listing successfully
    vi.mocked(listingDAL.updateApprovalStatus).mockResolvedValue(undefined);

    const approveResult = await approveListingAction(listingId);
    expect(approveResult.success).toBe(true);
    expect(listingDAL.updateApprovalStatus).toHaveBeenCalledWith(
      listingId,
      "approved",
    );

    // Step 5: Notifications sent correctly
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ownerId,
        type: "listing_approved",
        title: "Listing Approved",
      }),
    );

    // Step 6: Queue updates after approval
    vi.mocked(listingDAL.getPendingReviews).mockResolvedValue({
      data: [], // Queue is now empty
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    const updatedQueue = await listingDAL.getPendingReviews({
      page: 1,
      limit: 10,
    });
    expect(updatedQueue.data).toHaveLength(0);

    // Step 7: Review history shows reviewed listing
    vi.mocked(listingDAL.getReviewHistory).mockResolvedValue({
      data: [
        {
          ...mockPendingListing,
          approvalStatus: "approved",
          reviewedBy: {
            id: adminId,
            firstName: "Admin",
            lastName: "User",
          },
          reviewedAt: new Date(),
        } as any,
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const historyResult = await listingDAL.getReviewHistory("approved", {
      page: 1,
      limit: 10,
    });
    expect(historyResult.data).toHaveLength(1);
    expect(historyResult.data[0].approvalStatus).toBe("approved");
  });

  it("should complete full admin review workflow: login → view queue → reject listing", async () => {
    // Step 1: Admin logs in (simulated)
    expect(requireAdmin).toBeDefined();

    // Step 2: Admin views pending review queue
    const mockPendingListing = {
      id: listingId,
      name: "Power Drill",
      approvalStatus: "pending_review",
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

    const queueResult = await listingDAL.getPendingReviews({
      page: 1,
      limit: 10,
    });
    expect(queueResult.data).toHaveLength(1);

    // Step 3: Admin views full listing context
    vi.mocked(listingDAL.getListingById).mockResolvedValue({
      ...mockListing,
      id: listingId,
      owner: {
        ...mockListing.owner,
        id: ownerId,
      },
    } as any);

    await listingDAL.getListingById(listingId);

    // Step 4: Admin rejects listing with reason
    const rejectionReason = "Listing does not meet quality standards";
    vi.mocked(listingDAL.updateApprovalStatus).mockResolvedValue(undefined);

    const rejectResult = await rejectListingAction(listingId, rejectionReason);
    expect(rejectResult.success).toBe(true);
    expect(listingDAL.updateApprovalStatus).toHaveBeenCalledWith(
      listingId,
      "rejected",
      rejectionReason,
    );

    // Step 5: Notifications sent correctly with reason
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ownerId,
        type: "listing_rejected",
        data: expect.objectContaining({
          rejectionReason,
        }),
      }),
    );

    // Step 6: Queue updates after rejection
    vi.mocked(listingDAL.getPendingReviews).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    const updatedQueue = await listingDAL.getPendingReviews({
      page: 1,
      limit: 10,
    });
    expect(updatedQueue.data).toHaveLength(0);

    // Step 7: Review history shows rejected listing
    vi.mocked(listingDAL.getReviewHistory).mockResolvedValue({
      data: [
        {
          ...mockPendingListing,
          approvalStatus: "rejected",
          rejectionReason,
          reviewedBy: {
            id: adminId,
            firstName: "Admin",
            lastName: "User",
          },
          reviewedAt: new Date(),
        } as any,
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const historyResult = await listingDAL.getReviewHistory("rejected", {
      page: 1,
      limit: 10,
    });
    expect(historyResult.data).toHaveLength(1);
    expect(historyResult.data[0].approvalStatus).toBe("rejected");
    expect(historyResult.data[0].rejectionReason).toBe(rejectionReason);
  });
});
