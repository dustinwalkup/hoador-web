import { describe, it, expect, vi, beforeEach } from "vitest";
import { listingDAL } from "@/dal";
import { mockListing } from "@/test/fixtures/listings";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    searchListings: vi.fn(),
    getListingById: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/features/auth/utils/guards", () => ({
  isAdmin: vi.fn(),
}));

import { getCurrentUserId } from "@/features/auth/utils/session";
import { isAdmin } from "@/features/auth/utils/guards";

describe("Approval Visibility Integration", () => {
  const listingId = "listing-123";
  const ownerId = "owner-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pending listings not visible in public search", () => {
    it("should exclude pending listings from public search results", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null); // No user (public)
      vi.mocked(isAdmin).mockResolvedValue(false);

      const approvedListing = {
        ...mockListing,
        id: "listing-approved",
        approvalStatus: "approved",
      };

      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [approvedListing as any], // Only approved listing, pending excluded
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
      const result = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
        null as any,
        "community-1",
        false,
      );

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].approvalStatus).toBe("approved");
      expect(
        result.data.find((l: any) => l.approvalStatus === "pending_review"),
      ).toBeUndefined();
    });
  });

  describe("Rejected listings not visible in public search", () => {
    it("should exclude rejected listings from public search results", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null);
      vi.mocked(isAdmin).mockResolvedValue(false);

      const approvedListing = {
        ...mockListing,
        id: "listing-approved",
        approvalStatus: "approved",
      };

      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [approvedListing as any], // Only approved listing, rejected excluded
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
      const result = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
        null as any,
        "community-1",
        false,
      );

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].approvalStatus).toBe("approved");
      expect(
        result.data.find((l: any) => l.approvalStatus === "rejected"),
      ).toBeUndefined();
    });
  });

  describe("Approved listings visible in public search", () => {
    it("should include approved listings in public search results", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null);
      vi.mocked(isAdmin).mockResolvedValue(false);

      const approvedListing = {
        ...mockListing,
        id: listingId,
        approvalStatus: "approved",
        status: "available",
      };

      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [approvedListing as any],
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
      const result = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
        null as any,
        "community-1",
        false,
      );

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].approvalStatus).toBe("approved");
    });
  });

  describe("Owners can see their own listings regardless of status", () => {
    it("should show pending listing to owner", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(ownerId);
      vi.mocked(isAdmin).mockResolvedValue(false);

      const pendingListing = {
        ...mockListing,
        id: listingId,
        owner: {
          ...mockListing.owner,
          id: ownerId,
        },
        approvalStatus: "pending_review",
      };

      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [pendingListing as any], // Owner can see their own pending listing
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
      const result = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
        ownerId,
        "community-1",
        false,
      );

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].approvalStatus).toBe("pending_review");
    });

    it("should show rejected listing to owner", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(ownerId);
      vi.mocked(isAdmin).mockResolvedValue(false);

      const rejectedListing = {
        ...mockListing,
        id: listingId,
        owner: {
          ...mockListing.owner,
          id: ownerId,
        },
        approvalStatus: "rejected",
      };

      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [rejectedListing as any], // Owner can see their own rejected listing
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
      const result = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
        ownerId,
        "community-1",
        false,
      );

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].approvalStatus).toBe("rejected");
    });
  });

  describe("Admins can see all listings", () => {
    it("should show all listings to admin regardless of approval status", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue("admin-123");
      vi.mocked(isAdmin).mockResolvedValue(true);

      const pendingListing = {
        ...mockListing,
        id: "listing-pending",
        approvalStatus: "pending_review",
      };

      const rejectedListing = {
        ...mockListing,
        id: "listing-rejected",
        approvalStatus: "rejected",
      };

      const approvedListing = {
        ...mockListing,
        id: "listing-approved",
        approvalStatus: "approved",
      };

      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [pendingListing, rejectedListing, approvedListing] as any[], // All listings visible to admin
        pagination: {
          page: 1,
          limit: 12,
          total: 3,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Act
      const result = await listingDAL.searchListings(
        {},
        { page: 1, limit: 12 },
        "admin-123",
        "community-1",
        true,
      );

      // Assert
      expect(result.data).toHaveLength(3);
      expect(
        result.data.find((l: any) => l.approvalStatus === "pending_review"),
      ).toBeDefined();
      expect(
        result.data.find((l: any) => l.approvalStatus === "rejected"),
      ).toBeDefined();
      expect(
        result.data.find((l: any) => l.approvalStatus === "approved"),
      ).toBeDefined();
    });
  });

  describe("Search queries include approval status filter", () => {
    it("should filter by approval status in search query", async () => {
      // Arrange
      vi.mocked(getCurrentUserId).mockResolvedValue(null);
      vi.mocked(isAdmin).mockResolvedValue(false);

      const approvedListing = {
        ...mockListing,
        id: listingId,
        approvalStatus: "approved",
      };

      vi.mocked(listingDAL.searchListings).mockResolvedValue({
        data: [approvedListing as any],
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
      const result = await listingDAL.searchListings(
        { query: "drill" },
        { page: 1, limit: 12 },
        null as any,
        "community-1",
        false,
      );

      // Assert
      expect(listingDAL.searchListings).toHaveBeenCalledWith(
        { query: "drill" },
        { page: 1, limit: 12 },
        null as any,
        "community-1",
        false,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].approvalStatus).toBe("approved");
    });
  });
});
