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
