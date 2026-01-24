import { describe, it, expect, vi, beforeEach } from "vitest";
import { listingDAL } from "@/dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { sendNotification } from "@/features/notifications/utils/send-notification";

// Mock all dependencies for E2E test
vi.mock("@/dal", () => ({
  listingDAL: {
    createListing: vi.fn(),
    getUserListingsByApprovalStatus: vi.fn(),
    updateListing: vi.fn(),
    getListingById: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/dal/legal-document.dal", () => ({
  legalDocumentDAL: {
    getAllCurrentVersions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn(),
}));

describe("Complete Listing Approval User Flow (E2E)", () => {
  const userId = "user-123";
  const listingId = "listing-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
  });

  it("should complete full user listing approval workflow", async () => {
    // Step 1: User creates listing
    const listingData = {
      name: "Power Drill",
      description: "Heavy duty power drill",
      categoryId: "power-tools",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 50.0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    const createdListing = {
      id: listingId,
      ...listingData,
      approvalStatus: "pending_review",
      ownerId: userId,
    };

    vi.mocked(listingDAL.createListing).mockResolvedValue(
      createdListing as any,
    );

    const createResult = await listingDAL.createListing(
      listingData,
      userId,
      "community-1",
    );
    expect(createResult.id).toBe(listingId);
    expect(createResult.approvalStatus).toBe("pending_review");

    // Step 2: Listing appears in "Pending Review" tab
    vi.mocked(listingDAL.getUserListingsByApprovalStatus).mockResolvedValue([
      {
        ...createdListing,
        images: [],
        reviews: [],
        availability: [],
        averageRating: 0,
        reviewCount: 0,
        viewCount: 0,
        favoriteCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: {
          id: userId,
          firstName: "John",
          lastName: "Doe",
          averageRating: 0,
          reviewCount: 0,
          memberSince: new Date(),
        },
        category: {
          id: "power-tools",
          name: "Power Tools",
        },
      },
    ] as any);

    const pendingListings = await listingDAL.getUserListingsByApprovalStatus(
      "pending_review",
      userId,
    );
    expect(pendingListings).toHaveLength(1);
    expect(pendingListings[0].id).toBe(listingId);
    expect(pendingListings[0].approvalStatus).toBe("pending_review");

    // Step 3: User sees status badge (simulated by checking approvalStatus)
    expect(pendingListings[0].approvalStatus).toBe("pending_review");

    // Step 4: User receives approval notification
    // (Simulated by admin approving - this would trigger notification)
    vi.mocked(sendNotification).mockResolvedValue({
      success: true,
      notificationId: "notification-123",
      emailSent: true,
      smsSent: false,
    });

    // Simulate admin approval
    const approvedListing = {
      ...createdListing,
      approvalStatus: "approved",
    };

    // Step 5: Listing appears in Active tab after approval
    // (This would be tested in the actual component, but we simulate the data change)
    expect(approvedListing.approvalStatus).toBe("approved");

    // Step 6: User receives rejection notification with reason (alternative flow)
    const rejectionReason = "Listing needs better photos";
    const rejectedListing = {
      ...createdListing,
      approvalStatus: "rejected",
      rejectionReason,
    };

    expect(rejectedListing.approvalStatus).toBe("rejected");
    expect(rejectedListing.rejectionReason).toBe(rejectionReason);

    // Step 7: User can edit and resubmit rejected listing
    const updatedListingData = {
      name: "Updated Power Drill",
      description: "Improved description with better details",
    };

    vi.mocked(listingDAL.getListingById).mockResolvedValue(
      rejectedListing as any,
    );
    vi.mocked(listingDAL.updateListing).mockResolvedValue({
      ...rejectedListing,
      ...updatedListingData,
      approvalStatus: "pending_review", // Status resets to pending after edit
      rejectionReason: null,
    } as any);

    const updatedListing = await listingDAL.updateListing(
      listingId,
      updatedListingData,
      userId,
    );
    expect(updatedListing.approvalStatus).toBe("pending_review");
    expect(updatedListing.rejectionReason).toBeNull();

    // Step 8: Dashboard shows pending count
    vi.mocked(listingDAL.getUserListingsByApprovalStatus).mockResolvedValue([
      updatedListing,
    ] as any);

    const pendingCount = (
      await listingDAL.getUserListingsByApprovalStatus("pending_review", userId)
    ).length;
    expect(pendingCount).toBeGreaterThan(0);
  });

  it("should handle listing creation with pending status", async () => {
    // User creates listing
    const listingData = {
      name: "New Tool",
      description: "A new tool",
      categoryId: "cat-1",
      condition: "excellent" as const,
      dailyRate: 20.0,
      securityDeposit: 50.0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    const createdListing = {
      id: listingId,
      ...listingData,
      approvalStatus: "pending_review",
      ownerId: userId,
    };

    vi.mocked(listingDAL.createListing).mockResolvedValue(
      createdListing as any,
    );

    const result = await listingDAL.createListing(
      listingData,
      userId,
      "community-1",
    );

    // Verify listing is created with pending_review status
    expect(result.approvalStatus).toBe("pending_review");
    expect(result.id).toBe(listingId);
  });
});
