import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceListingService } from "../service-listing-service";
import type { CreateListingInput } from "../../types";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockAfter = vi.fn((fn: () => Promise<void>) => fn());
const mockLinkListingToNeed = vi.fn();
const mockNotifyRequesterListingLive = vi.fn();
const mockCaptureNonCriticalError = vi.fn();

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => mockAfter(fn),
}));

vi.mock(
  "@/features/neighborhood-needs/services/neighborhood-needs-service",
  () => ({
    linkListingToNeed: (...args: unknown[]) => mockLinkListingToNeed(...args),
    notifyRequesterListingLive: (...args: unknown[]) =>
      mockNotifyRequesterListingLive(...args),
  }),
);

vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...args: unknown[]) =>
    mockCaptureNonCriticalError(...args),
}));

const mockCreate = vi.fn();
const mockGetById = vi.fn();
const mockUpdate = vi.fn();
const mockGetUserById = vi.fn();
const mockAuditCreate = vi.fn();
const mockReviewEventCreate = vi.fn();
const mockSendPendingAdmin = vi.fn();

vi.mock("@/dal", () => ({
  serviceListingDAL: {
    create: (...args: unknown[]) => mockCreate(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  userDAL: {
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
  },
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
  reviewEventsDAL: {
    createEvent: (...args: unknown[]) => mockReviewEventCreate(...args),
  },
  serviceBookingDAL: {},
}));

vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendListingPendingAdminNotification: (...args: unknown[]) =>
    mockSendPendingAdmin(...args),
  sendListingApprovedNotification: vi.fn(),
  sendListingRejectedNotification: vi.fn(),
}));

vi.mock("@/features/payments/lib/payout-readiness", () => ({
  getPayoutReadiness: vi.fn().mockReturnValue({ onboardingStatus: "verified" }),
}));

vi.mock("@/features/payments/lib/log-events", () => ({
  logGatingEvent: vi.fn(),
}));

const mockUploadToBlob = vi.fn();
const mockDeleteFromBlob = vi.fn();
vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: (...args: unknown[]) => mockUploadToBlob(...args),
  deleteFromBlob: (...args: unknown[]) => mockDeleteFromBlob(...args),
}));

const mockValidateForProcessing = vi.fn();
const mockValidateMagicBytes = vi.fn();
const mockProcessImage = vi.fn();
vi.mock("@/lib/image/server", () => ({
  validateImageForProcessing: (...args: unknown[]) =>
    mockValidateForProcessing(...args),
  validateImageMagicBytes: (...args: unknown[]) =>
    mockValidateMagicBytes(...args),
  processImageForUpload: (...args: unknown[]) => mockProcessImage(...args),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_LISTING = {
  id: "listing-svc-1",
  communityId: "comm-1",
  providerId: "user-1",
  status: "pending_approval",
  title: "Dog walking",
};

const MINIMAL_INPUT: CreateListingInput = {
  communityId: "comm-1",
  categoryId: "cat-1",
  title: "Dog walking",
  description: "I walk dogs",
  pricingType: "hourly",
  price: 10,
  ownerPoliciesAcknowledged: true,
};

const CONTEXT = { ipAddress: null, userAgent: null };

// =============================================================================
// ServiceListingService.createListing — neighborhood need linking
// =============================================================================

describe("ServiceListingService.createListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAfter.mockImplementation((fn: () => Promise<void>) => fn());
    mockLinkListingToNeed.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(MOCK_LISTING);
    mockGetUserById.mockResolvedValue({
      id: "user-1",
      stripeConnectedAccountId: "acct_123",
      connectChargesEnabled: true,
      connectPayoutsEnabled: true,
      connectOnboardingComplete: true,
    });
    mockAuditCreate.mockResolvedValue(undefined);
    mockSendPendingAdmin.mockResolvedValue(undefined);
  });

  it("calls linkListingToNeed when neighborhoodNeedId is provided", async () => {
    const input: CreateListingInput = {
      ...MINIMAL_INPUT,
      neighborhoodNeedId: "00000000-0000-4000-a000-000000000099",
    };

    await ServiceListingService.createListing(input, "user-1", CONTEXT);

    expect(mockLinkListingToNeed).toHaveBeenCalledWith({
      neighborhoodNeedId: "00000000-0000-4000-a000-000000000099",
      listingType: "service",
      listingId: "listing-svc-1",
      creatorUserId: "user-1",
    });
  });

  it("does not call linkListingToNeed when neighborhoodNeedId is absent", async () => {
    await ServiceListingService.createListing(MINIMAL_INPUT, "user-1", CONTEXT);

    expect(mockLinkListingToNeed).not.toHaveBeenCalled();
  });

  it("returns the created listing on success", async () => {
    const result = await ServiceListingService.createListing(
      MINIMAL_INPUT,
      "user-1",
      CONTEXT,
    );

    expect(result.success).toBe(true);
    expect(result.listing.id).toBe("listing-svc-1");
  });
});

// =============================================================================
// ServiceListingService.approveListing — notify requester hook
// =============================================================================

describe("ServiceListingService.approveListing", () => {
  const PENDING_LISTING = {
    id: "listing-svc-1",
    providerId: "provider-1",
    status: "pending_approval",
    adminNote: null,
    title: "Dog walking",
  };

  const APPROVED_LISTING = { ...PENDING_LISTING, status: "active" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAfter.mockImplementation((fn: () => Promise<void>) => fn());
    mockNotifyRequesterListingLive.mockResolvedValue(undefined);
    mockGetById.mockResolvedValue(PENDING_LISTING);
    mockUpdate.mockResolvedValue(APPROVED_LISTING);
    mockAuditCreate.mockResolvedValue(undefined);
    mockReviewEventCreate.mockResolvedValue(undefined);
  });

  it("calls notifyRequesterListingLive with 'service' and listingId on approval", async () => {
    await ServiceListingService.approveListing("listing-svc-1", "admin-1");

    expect(mockNotifyRequesterListingLive).toHaveBeenCalledWith(
      "service",
      "listing-svc-1",
    );
  });

  it("does not fail the approval when notifyRequesterListingLive throws", async () => {
    mockNotifyRequesterListingLive.mockRejectedValue(
      new Error("notification failure"),
    );

    const result = await ServiceListingService.approveListing(
      "listing-svc-1",
      "admin-1",
    );

    expect(result.status).toBe("active");
    expect(mockCaptureNonCriticalError).toHaveBeenCalled();
  });
});

// ── photos (P-E10-4) ─────────────────────────────────────────────────────────

describe("ServiceListingService photos", () => {
  const file = () =>
    new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
  const ctx = { ipAddress: "1.1.1.1", userAgent: "test" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateForProcessing.mockReturnValue(null);
    mockValidateMagicBytes.mockReturnValue(true);
    mockProcessImage.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockUploadToBlob.mockResolvedValue({
      url: "https://cdn.test/new.jpg",
      pathname: "service-listings/x/new.jpg",
    });
    mockDeleteFromBlob.mockResolvedValue(undefined);
  });

  describe("addPhoto", () => {
    it("appends the uploaded URL to the array", async () => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "provider-1",
        photos: ["https://cdn.test/a.jpg"],
      });
      mockUpdate.mockResolvedValue({ ...MOCK_LISTING, photos: ["a", "b"] });

      await ServiceListingService.addPhoto(
        "listing-svc-1",
        "provider-1",
        file(),
        ctx,
      );

      expect(mockUpdate).toHaveBeenCalledWith("listing-svc-1", {
        photos: ["https://cdn.test/a.jpg", "https://cdn.test/new.jpg"],
      });
    });

    it("refuses a provider who does not own the listing", async () => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "someone-else",
      });

      await expect(
        ServiceListingService.addPhoto(
          "listing-svc-1",
          "provider-1",
          file(),
          ctx,
        ),
      ).rejects.toThrow(/do not own/i);
      expect(mockUploadToBlob).not.toHaveBeenCalled();
    });

    it("refuses past the cap, before touching blob storage", async () => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "provider-1",
        photos: Array.from(
          { length: 10 },
          (_, i) => `https://cdn.test/${i}.jpg`,
        ),
      });

      await expect(
        ServiceListingService.addPhoto(
          "listing-svc-1",
          "provider-1",
          file(),
          ctx,
        ),
      ).rejects.toThrow(/Maximum 10 photos/);
      expect(mockUploadToBlob).not.toHaveBeenCalled();
    });

    it("rejects a file whose magic bytes are not an image", async () => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "provider-1",
        photos: [],
      });
      mockValidateMagicBytes.mockReturnValue(false);

      await expect(
        ServiceListingService.addPhoto(
          "listing-svc-1",
          "provider-1",
          file(),
          ctx,
        ),
      ).rejects.toThrow(/Invalid image/);
      expect(mockUploadToBlob).not.toHaveBeenCalled();
    });

    it("re-encodes before storing, as the rental path does", async () => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "provider-1",
        photos: [],
      });
      mockUpdate.mockResolvedValue({ ...MOCK_LISTING, photos: [] });

      await ServiceListingService.addPhoto(
        "listing-svc-1",
        "provider-1",
        file(),
        ctx,
      );

      expect(mockProcessImage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ maxWidth: 2048, format: "jpeg" }),
      );
    });

    // Service moderation is unchanged by Req 2.7 — only RENTAL listings have the
    // images-only re-review rule, so an active service listing stays live.
    it("does not send an active listing back to review", async () => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "provider-1",
        status: "active",
        photos: [],
      });
      mockUpdate.mockResolvedValue({ ...MOCK_LISTING, photos: [] });

      await ServiceListingService.addPhoto(
        "listing-svc-1",
        "provider-1",
        file(),
        ctx,
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        "listing-svc-1",
        expect.not.objectContaining({ status: expect.anything() }),
      );
    });
  });

  describe("setPhotos", () => {
    const withPhotos = (photos: string[]) => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "provider-1",
        photos,
      });
      mockUpdate.mockResolvedValue({ ...MOCK_LISTING, photos });
    };

    it("reorders by replacing the array", async () => {
      withPhotos(["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"]);

      await ServiceListingService.setPhotos(
        "listing-svc-1",
        "provider-1",
        ["https://cdn.test/b.jpg", "https://cdn.test/a.jpg"],
        ctx,
      );

      expect(mockUpdate).toHaveBeenCalledWith("listing-svc-1", {
        photos: ["https://cdn.test/b.jpg", "https://cdn.test/a.jpg"],
      });
    });

    it("removes by omission, and cleans up the dropped blob", async () => {
      withPhotos(["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"]);

      await ServiceListingService.setPhotos(
        "listing-svc-1",
        "provider-1",
        ["https://cdn.test/a.jpg"],
        ctx,
      );

      expect(mockUpdate).toHaveBeenCalledWith("listing-svc-1", {
        photos: ["https://cdn.test/a.jpg"],
      });
      expect(mockDeleteFromBlob).toHaveBeenCalledWith("b.jpg");
    });

    // ⚠️ THE load-bearing guard. These URLs render as images in other members'
    // clients, so an unchecked array is an arbitrary-URL injection into someone
    // else's feed — with the request-time tracking that implies.
    it("REFUSES a URL the listing does not already own", async () => {
      withPhotos(["https://cdn.test/a.jpg"]);

      await expect(
        ServiceListingService.setPhotos(
          "listing-svc-1",
          "provider-1",
          ["https://cdn.test/a.jpg", "https://evil.test/tracker.gif"],
          ctx,
        ),
      ).rejects.toThrow(/only be reordered or removed/i);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("refuses duplicates", async () => {
      withPhotos(["https://cdn.test/a.jpg"]);

      await expect(
        ServiceListingService.setPhotos(
          "listing-svc-1",
          "provider-1",
          ["https://cdn.test/a.jpg", "https://cdn.test/a.jpg"],
          ctx,
        ),
      ).rejects.toThrow(/unique/i);
    });

    it("refuses a provider who does not own the listing", async () => {
      mockGetById.mockResolvedValue({
        ...MOCK_LISTING,
        providerId: "someone-else",
      });

      await expect(
        ServiceListingService.setPhotos("listing-svc-1", "provider-1", [], ctx),
      ).rejects.toThrow(/do not own/i);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});

// ── resubmission (mirrors the rental fix, P-E10-2) ───────────────────────────

describe("ServiceListingService.editListing resubmission", () => {
  const ctx = { ipAddress: "1.1.1.1", userAgent: "test" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(MOCK_LISTING);
    mockSendPendingAdmin.mockResolvedValue(undefined);
  });

  it("resubmits a denied listing AND clears the reason", async () => {
    mockGetById.mockResolvedValue({
      ...MOCK_LISTING,
      providerId: "provider-1",
      status: "denied",
      rejectionReason: "Photos are unclear",
    });

    await ServiceListingService.editListing(
      "listing-svc-1",
      "provider-1",
      { title: "Fixed title" },
      ctx,
    );

    // A reason surviving into `pending_approval` is stale by definition, and
    // every surface that renders it keys off the row rather than the status.
    expect(mockUpdate).toHaveBeenCalledWith("listing-svc-1", {
      title: "Fixed title",
      status: "pending_approval",
      rejectionReason: null,
    });
  });

  it("leaves an active listing's status and reason untouched", async () => {
    mockGetById.mockResolvedValue({
      ...MOCK_LISTING,
      providerId: "provider-1",
      status: "active",
    });

    await ServiceListingService.editListing(
      "listing-svc-1",
      "provider-1",
      { title: "New title" },
      ctx,
    );

    expect(mockUpdate).toHaveBeenCalledWith("listing-svc-1", {
      title: "New title",
    });
  });

  it("still records the resubmission and re-notifies admins", async () => {
    mockGetById.mockResolvedValue({
      ...MOCK_LISTING,
      providerId: "provider-1",
      status: "denied",
    });

    await ServiceListingService.editListing(
      "listing-svc-1",
      "provider-1",
      { title: "Fixed" },
      ctx,
    );

    // The durable history lives here — which is what makes clearing the scalar safe.
    expect(mockReviewEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityKind: "service_listing",
        eventType: "provider_resubmitted",
      }),
    );
    expect(mockSendPendingAdmin).toHaveBeenCalled();
  });
});
