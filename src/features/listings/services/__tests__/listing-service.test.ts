import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListingService } from "../listing-service";
import { NotFoundError, ForbiddenError, ValidationError } from "@/dal/errors";

const mockGetListingById = vi.fn();
const mockUpdateListing = vi.fn();
const mockDeleteListing = vi.fn();
const mockTrackActivity = vi.fn();
const mockUploadToBlob = vi.fn();
const mockValidateImageForProcessing = vi.fn();
const mockValidateImageMagicBytes = vi.fn();
const mockGetImageMetadata = vi.fn();
const mockProcessImageForUpload = vi.fn();

// Mock db for raw queries (image count + order index)
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/dal", () => ({
  listingDAL: {
    getListingById: (...args: unknown[]) => mockGetListingById(...args),
    updateListing: (...args: unknown[]) => mockUpdateListing(...args),
    deleteListing: (...args: unknown[]) => mockDeleteListing(...args),
  },
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: (...args: unknown[]) => mockTrackActivity(...args),
}));

vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: (...args: unknown[]) => mockUploadToBlob(...args),
}));

vi.mock("@/lib/image/server", () => ({
  validateImageForProcessing: (...args: unknown[]) =>
    mockValidateImageForProcessing(...args),
  validateImageMagicBytes: (...args: unknown[]) =>
    mockValidateImageMagicBytes(...args),
  getImageMetadata: (...args: unknown[]) => mockGetImageMetadata(...args),
  processImageForUpload: (...args: unknown[]) =>
    mockProcessImageForUpload(...args),
}));

vi.mock("@/db/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/db/schemas/listings.schema", () => ({
  listingImages: {
    listingId: "listingId",
    orderIndex: "orderIndex",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  max: vi.fn((...args: unknown[]) => ({ type: "max", args })),
  count: vi.fn(() => ({ type: "count" })),
}));

const mockListing = {
  id: "listing-123",
  owner: { id: "owner-123" },
  name: "Test Listing",
};

function setupDbChain(result: unknown[]) {
  mockWhere.mockResolvedValue(result);
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

function setupInsertChain(result: unknown[]) {
  mockReturning.mockResolvedValue(result);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockInsert.mockReturnValue({ values: mockValues });
}

function createMockFile(name = "test.jpg", size = 1024): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type: "image/jpeg" });
}

describe("ListingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetListingById.mockResolvedValue(mockListing);
  });

  describe("uploadListingImage", () => {
    beforeEach(() => {
      // Default happy path mocks
      setupDbChain([{ count: 0 }]); // image count
      mockValidateImageForProcessing.mockReturnValue(null);
      mockValidateImageMagicBytes.mockReturnValue(true);
      mockGetImageMetadata.mockResolvedValue({
        size: 1024,
        width: 800,
        height: 600,
        format: "jpeg",
      });
      mockProcessImageForUpload.mockResolvedValue(Buffer.from("processed"));
      mockUploadToBlob.mockResolvedValue({
        url: "https://blob.test/image.jpg",
        pathname: "listings/listing-123/image.jpg",
      });
    });

    it("throws NotFoundError when listing not found", async () => {
      mockGetListingById.mockResolvedValue(null);

      await expect(
        ListingService.uploadListingImage(
          { listingId: "listing-123", file: createMockFile() },
          "owner-123",
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when user does not own listing", async () => {
      await expect(
        ListingService.uploadListingImage(
          { listingId: "listing-123", file: createMockFile() },
          "other-user",
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ValidationError when max images reached", async () => {
      setupDbChain([{ count: 10 }]);

      await expect(
        ListingService.uploadListingImage(
          { listingId: "listing-123", file: createMockFile() },
          "owner-123",
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when file validation fails", async () => {
      setupDbChain([{ count: 0 }]);
      mockValidateImageForProcessing.mockReturnValue("File too large");

      await expect(
        ListingService.uploadListingImage(
          { listingId: "listing-123", file: createMockFile() },
          "owner-123",
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when magic bytes invalid", async () => {
      setupDbChain([{ count: 0 }]);
      mockValidateImageMagicBytes.mockReturnValue(false);

      await expect(
        ListingService.uploadListingImage(
          { listingId: "listing-123", file: createMockFile() },
          "owner-123",
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("processes, uploads, and saves image on success", async () => {
      // Set up order index query (second db.select call)
      const mockOrderWhere = vi.fn().mockResolvedValue([{ max: 2 }]);
      const mockOrderFrom = vi.fn().mockReturnValue({ where: mockOrderWhere });

      // First call returns count, second returns max order
      mockSelect
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockOrderFrom });
      mockFrom.mockReturnValue({ where: mockWhere });
      mockWhere.mockResolvedValue([{ count: 0 }]);
      mockOrderWhere.mockResolvedValue([{ max: 2 }]);

      const savedImage = {
        id: "img-1",
        listingId: "listing-123",
        imageUrl: "https://blob.test/image.jpg",
        blobPathname: "listings/listing-123/image.jpg",
        orderIndex: 3,
        createdAt: new Date(),
      };
      setupInsertChain([savedImage]);

      const result = await ListingService.uploadListingImage(
        { listingId: "listing-123", file: createMockFile() },
        "owner-123",
      );

      expect(result.image).toEqual(savedImage);
      expect(mockProcessImageForUpload).toHaveBeenCalled();
      expect(mockUploadToBlob).toHaveBeenCalled();
    });
  });

  describe("updateListing", () => {
    it("throws NotFoundError when listing not found", async () => {
      mockGetListingById.mockResolvedValue(null);

      await expect(
        ListingService.updateListing("listing-123", {} as never, "owner-123"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when user does not own listing", async () => {
      await expect(
        ListingService.updateListing("listing-123", {} as never, "other-user"),
      ).rejects.toThrow(ForbiddenError);
    });

    it("updates listing and tracks activity on success", async () => {
      mockUpdateListing.mockResolvedValue({ id: "listing-123" });

      const result = await ListingService.updateListing(
        "listing-123",
        {} as never,
        "owner-123",
      );

      expect(result.listingId).toBe("listing-123");
      expect(mockUpdateListing).toHaveBeenCalledWith(
        "listing-123",
        {},
        "owner-123",
      );
      expect(mockTrackActivity).toHaveBeenCalledWith(
        "owner-123",
        "listing_updated",
        { listingId: "listing-123" },
      );
    });
  });

  describe("deleteListing", () => {
    it("throws NotFoundError when listing not found", async () => {
      mockGetListingById.mockResolvedValue(null);

      await expect(
        ListingService.deleteListing("listing-123", "owner-123"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when user does not own listing", async () => {
      await expect(
        ListingService.deleteListing("listing-123", "other-user"),
      ).rejects.toThrow(ForbiddenError);
    });

    it("deletes listing and tracks activity on success", async () => {
      mockDeleteListing.mockResolvedValue(undefined);

      await ListingService.deleteListing("listing-123", "owner-123");

      expect(mockDeleteListing).toHaveBeenCalledWith("listing-123");
      expect(mockTrackActivity).toHaveBeenCalledWith(
        "owner-123",
        "listing_deleted",
        { listingId: "listing-123" },
      );
    });
  });
});
