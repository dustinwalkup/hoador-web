import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createNeed,
  updateNeed,
  closeNeed,
  deleteNeed,
  linkListingToNeed,
  notifyRequesterListingLive,
  closeNeedsFulfilledByBooking,
} from "../neighborhood-needs-service";
import { ValidationError, ForbiddenError, ConflictError } from "@/dal/errors";

// ── mock DAL singletons ───────────────────────────────────────────────────────

const mockGetPrimary = vi.fn();
const mockGetVisibleCommunityIds = vi.fn();
const mockGetUserIdsVisibleInCommunity = vi.fn();
const mockIsVisibleInCommunity = vi.fn();
const mockCreateNeed = vi.fn();
const mockGetNeedById = vi.fn();
const mockGetNeedByIdIncludingDeleted = vi.fn();
const mockUpdateNeed = vi.fn();
const mockCloseNeed = vi.fn();
const mockSoftDeleteNeed = vi.fn();
const mockGetLinkByListing = vi.fn();
const mockFindOpenNeedsLinkedToListing = vi.fn();
const mockLinkListing = vi.fn();
const mockGetListingCategories = vi.fn();
const mockListCategories = vi.fn();
const mockSendNotification = vi.fn();
const mockCaptureError = vi.fn();
const mockAfter = vi.fn((fn: () => Promise<void>) => fn());
// Captures the fire-and-forget after() callback so tests can await the fan-out.
let afterPromise: Promise<void> | undefined;

vi.mock("@/dal", () => ({
  communityDAL: {
    getPrimaryMembershipForUser: (...a: unknown[]) => mockGetPrimary(...a),
    getVisibleCommunityIds: (...a: unknown[]) =>
      mockGetVisibleCommunityIds(...a),
    getUserIdsVisibleInCommunity: (...a: unknown[]) =>
      mockGetUserIdsVisibleInCommunity(...a),
    isVisibleInCommunity: (...a: unknown[]) => mockIsVisibleInCommunity(...a),
  },
  listingDAL: {
    getListingCategories: (...a: unknown[]) => mockGetListingCategories(...a),
  },
  neighborhoodNeedsDAL: {
    createNeed: (...a: unknown[]) => mockCreateNeed(...a),
    getNeedById: (...a: unknown[]) => mockGetNeedById(...a),
    getNeedByIdIncludingDeleted: (...a: unknown[]) =>
      mockGetNeedByIdIncludingDeleted(...a),
    updateNeed: (...a: unknown[]) => mockUpdateNeed(...a),
    closeNeed: (...a: unknown[]) => mockCloseNeed(...a),
    softDeleteNeed: (...a: unknown[]) => mockSoftDeleteNeed(...a),
    getLinkByListing: (...a: unknown[]) => mockGetLinkByListing(...a),
    findOpenNeedsLinkedToListing: (...a: unknown[]) =>
      mockFindOpenNeedsLinkedToListing(...a),
    linkListing: (...a: unknown[]) => mockLinkListing(...a),
  },
  serviceListingDAL: {
    listCategories: (...a: unknown[]) => mockListCategories(...a),
  },
}));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => mockAfter(fn),
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...a: unknown[]) => mockCaptureError(...a),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const PRIMARY = {
  community: { id: "comm-1", name: "Maplewood HOA" },
  membership: {
    id: "mem-1",
    userId: "user-1",
    communityId: "comm-1",
    isPrimary: true,
  },
};

const RENTAL_CAT = { id: "cat-1", name: "Tools" };
const SERVICE_CAT = { id: "cat-s1", name: "Cleaning" };

const OPEN_NEED = {
  id: "need-1",
  createdByUserId: "user-1",
  communityId: "comm-1",
  type: "rental" as const,
  categoryId: "cat-1",
  title: "Need a drill",
  description: "Something powerful",
  neededStartDate: null,
  neededEndDate: null,
  status: "open" as const,
  closeReason: null,
  closedAt: null,
  deletedAt: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const CLOSED_NEED = {
  ...OPEN_NEED,
  status: "closed" as const,
  closeReason: "manual" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSendNotification.mockResolvedValue({ inApp: true });
  mockAfter.mockImplementation((fn: () => Promise<void>) => {
    afterPromise = fn();
    return afterPromise;
  });
  mockGetUserIdsVisibleInCommunity.mockResolvedValue([
    "user-1",
    "user-2",
    "user-3",
  ]);
  mockIsVisibleInCommunity.mockResolvedValue(true);
});

// =============================================================================
// 6.1 createNeed
// =============================================================================

describe("createNeed", () => {
  const input = {
    type: "rental" as const,
    categoryId: "cat-1",
    title: "Need a drill",
    description: "Something powerful",
  };

  it("throws ValidationError when user has no primary community", async () => {
    mockGetPrimary.mockResolvedValue(null);
    await expect(createNeed("user-1", input)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for a rental need with a service category", async () => {
    mockGetPrimary.mockResolvedValue(PRIMARY);
    mockGetListingCategories.mockResolvedValue([]);
    await expect(
      createNeed("user-1", { ...input, categoryId: "wrong" }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when end date is before start date", async () => {
    mockGetPrimary.mockResolvedValue(PRIMARY);
    mockGetListingCategories.mockResolvedValue([RENTAL_CAT]);
    await expect(
      createNeed("user-1", {
        ...input,
        neededStartDate: "2025-06-10",
        neededEndDate: "2025-06-01",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("inserts the need and returns it on success", async () => {
    mockGetPrimary.mockResolvedValue(PRIMARY);
    mockGetListingCategories.mockResolvedValue([RENTAL_CAT]);
    mockCreateNeed.mockResolvedValue(OPEN_NEED);

    const result = await createNeed("user-1", input);

    expect(mockCreateNeed).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByUserId: "user-1",
        communityId: "comm-1",
        type: "rental",
        categoryId: "cat-1",
      }),
    );
    expect(result).toEqual(OPEN_NEED);
  });

  it("fan-out excludes the creator", async () => {
    mockGetPrimary.mockResolvedValue(PRIMARY);
    mockGetListingCategories.mockResolvedValue([RENTAL_CAT]);
    mockCreateNeed.mockResolvedValue(OPEN_NEED);

    await createNeed("user-1", input);
    await afterPromise; // fan-out runs in after(); wait for it to settle

    const calls = mockSendNotification.mock.calls;
    const recipientIds = calls.map((c) => (c[0] as { userId: string }).userId);
    expect(recipientIds).not.toContain("user-1");
    expect(recipientIds).toContain("user-2");
    expect(recipientIds).toContain("user-3");
  });

  it("fan-out is skipped entirely when the creator is not visible in the community", async () => {
    mockGetPrimary.mockResolvedValue(PRIMARY);
    mockGetListingCategories.mockResolvedValue([RENTAL_CAT]);
    mockCreateNeed.mockResolvedValue(OPEN_NEED);
    // Creator's community_visibility row is missing/false (e.g. stale after a
    // network move) → need is invisible to everyone → nobody is notified.
    mockIsVisibleInCommunity.mockResolvedValue(false);

    await createNeed("user-1", input);
    await afterPromise; // let the fan-out short-circuit settle

    expect(mockGetUserIdsVisibleInCommunity).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("validates service category against service_listing_categories", async () => {
    mockGetPrimary.mockResolvedValue(PRIMARY);
    mockListCategories.mockResolvedValue([SERVICE_CAT]);
    mockCreateNeed.mockResolvedValue({
      ...OPEN_NEED,
      type: "service" as const,
    });

    await createNeed("user-1", {
      type: "service",
      categoryId: SERVICE_CAT.id,
      title: "Need cleaning",
      description: "Weekly clean",
    });

    expect(mockGetListingCategories).not.toHaveBeenCalled();
    expect(mockListCategories).toHaveBeenCalled();
  });
});

// =============================================================================
// 6.2 updateNeed
// =============================================================================

describe("updateNeed", () => {
  it("throws ForbiddenError for non-owner non-admin", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    await expect(
      updateNeed("need-1", { title: "x" }, { userId: "other", isAdmin: false }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws ValidationError when need is closed", async () => {
    mockGetNeedById.mockResolvedValue(CLOSED_NEED);
    await expect(
      updateNeed(
        "need-1",
        { title: "x" },
        { userId: "user-1", isAdmin: false },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when need is soft-deleted", async () => {
    mockGetNeedById.mockResolvedValue({
      ...OPEN_NEED,
      deletedAt: new Date(),
    });
    await expect(
      updateNeed(
        "need-1",
        { title: "x" },
        { userId: "user-1", isAdmin: false },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("re-validates category when categoryId changes", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockGetListingCategories.mockResolvedValue([]);
    await expect(
      updateNeed(
        "need-1",
        { categoryId: "bad-cat" },
        { userId: "user-1", isAdmin: false },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("allows admin to update any need", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockGetListingCategories.mockResolvedValue([RENTAL_CAT]);
    mockUpdateNeed.mockResolvedValue({ ...OPEN_NEED, title: "Updated" });

    const result = await updateNeed(
      "need-1",
      { title: "Updated", categoryId: RENTAL_CAT.id },
      { userId: "admin-user", isAdmin: true },
    );

    expect(result.title).toBe("Updated");
  });

  it("calls DAL updateNeed with correct fields", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockUpdateNeed.mockResolvedValue({ ...OPEN_NEED, title: "New title" });

    await updateNeed(
      "need-1",
      { title: "New title" },
      { userId: "user-1", isAdmin: false },
    );

    expect(mockUpdateNeed).toHaveBeenCalledWith("need-1", {
      title: "New title",
    });
  });
});

// =============================================================================
// 6.2 closeNeed
// =============================================================================

describe("closeNeed", () => {
  it("throws ForbiddenError for non-owner non-admin", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    await expect(
      closeNeed("need-1", { userId: "other", isAdmin: false }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("is idempotent — already-closed returns need without calling DAL closeNeed", async () => {
    mockGetNeedById.mockResolvedValue(CLOSED_NEED);
    const result = await closeNeed("need-1", {
      userId: "user-1",
      isAdmin: false,
    });
    expect(mockCloseNeed).not.toHaveBeenCalled();
    expect(result).toEqual(CLOSED_NEED);
  });

  it("uses reason 'manual' for owner close", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockCloseNeed.mockResolvedValue(CLOSED_NEED);
    await closeNeed("need-1", { userId: "user-1", isAdmin: false });
    expect(mockCloseNeed).toHaveBeenCalledWith("need-1", "manual");
  });

  it("uses reason 'admin' when admin closes", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockCloseNeed.mockResolvedValue({ ...CLOSED_NEED, closeReason: "admin" });
    await closeNeed("need-1", { userId: "admin-user", isAdmin: true });
    expect(mockCloseNeed).toHaveBeenCalledWith("need-1", "admin");
  });
});

// =============================================================================
// 6.2 deleteNeed
// =============================================================================

describe("deleteNeed", () => {
  it("throws ForbiddenError for non-admin", async () => {
    await expect(deleteNeed("need-1", { isAdmin: false })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("calls softDeleteNeed for admin", async () => {
    mockGetNeedByIdIncludingDeleted.mockResolvedValue(OPEN_NEED);
    mockSoftDeleteNeed.mockResolvedValue(undefined);
    await deleteNeed("need-1", { isAdmin: true });
    expect(mockSoftDeleteNeed).toHaveBeenCalledWith("need-1");
  });

  it("is a no-op when already soft-deleted", async () => {
    mockGetNeedByIdIncludingDeleted.mockResolvedValue({
      ...OPEN_NEED,
      deletedAt: new Date(),
    });
    await deleteNeed("need-1", { isAdmin: true });
    expect(mockSoftDeleteNeed).not.toHaveBeenCalled();
  });

  it("throws ValidationError when need does not exist", async () => {
    mockGetNeedByIdIncludingDeleted.mockResolvedValue(null);
    await expect(deleteNeed("need-1", { isAdmin: true })).rejects.toThrow(
      ValidationError,
    );
  });
});

// =============================================================================
// 6.3 linkListingToNeed
// =============================================================================

describe("linkListingToNeed", () => {
  const args = {
    neighborhoodNeedId: "need-1",
    listingType: "rental" as const,
    listingId: "listing-1",
    creatorUserId: "user-2",
  };

  it("no-op when need does not exist", async () => {
    mockGetNeedById.mockResolvedValue(null);
    await linkListingToNeed(args);
    expect(mockLinkListing).not.toHaveBeenCalled();
  });

  it("no-op when need is closed", async () => {
    mockGetNeedById.mockResolvedValue(CLOSED_NEED);
    await linkListingToNeed(args);
    expect(mockLinkListing).not.toHaveBeenCalled();
  });

  it("no-op when listing type mismatches need type", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED); // type = 'rental'
    await linkListingToNeed({ ...args, listingType: "service" });
    expect(mockLinkListing).not.toHaveBeenCalled();
  });

  it("no-op when creator cannot see the need community", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED); // communityId = 'comm-1'
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-other"]);
    await linkListingToNeed(args);
    expect(mockLinkListing).not.toHaveBeenCalled();
  });

  it("no-op on UNIQUE conflict (swallows ConflictError)", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-1"]);
    mockLinkListing.mockRejectedValue(new ConflictError("already linked"));
    await expect(linkListingToNeed(args)).resolves.toBeUndefined();
  });

  it("re-throws non-conflict errors", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-1"]);
    mockLinkListing.mockRejectedValue(new Error("DB connection lost"));
    await expect(linkListingToNeed(args)).rejects.toThrow("DB connection lost");
  });

  it("creates the link row on success", async () => {
    mockGetNeedById.mockResolvedValue(OPEN_NEED);
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-1"]);
    mockLinkListing.mockResolvedValue({ id: "link-1" });

    await linkListingToNeed(args);

    expect(mockLinkListing).toHaveBeenCalledWith({
      neighborhoodNeedId: "need-1",
      listingType: "rental",
      listingId: "listing-1",
    });
  });
});

// =============================================================================
// 6.4 notifyRequesterListingLive
// =============================================================================

describe("notifyRequesterListingLive", () => {
  it("no-op when no link exists for the listing", async () => {
    mockGetLinkByListing.mockResolvedValue(null);
    await notifyRequesterListingLive("rental", "listing-1");
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("no-op when the linked need no longer exists", async () => {
    mockGetLinkByListing.mockResolvedValue({
      id: "link-1",
      neighborhoodNeedId: "need-1",
    });
    mockGetNeedById.mockResolvedValue(null);
    await notifyRequesterListingLive("rental", "listing-1");
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("notifies the need creator when a linked rental listing goes live", async () => {
    mockGetLinkByListing.mockResolvedValue({
      id: "link-1",
      neighborhoodNeedId: "need-1",
    });
    mockGetNeedById.mockResolvedValue(OPEN_NEED);

    await notifyRequesterListingLive("rental", "listing-1");

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "neighborhood_need_listing_created",
        linkUrl: expect.stringContaining("listings/listing-1"),
      }),
    );
  });

  it("notifies with a service listing deep-link when type is service", async () => {
    mockGetLinkByListing.mockResolvedValue({
      id: "link-2",
      neighborhoodNeedId: "need-1",
    });
    mockGetNeedById.mockResolvedValue(OPEN_NEED);

    await notifyRequesterListingLive("service", "svc-1");

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        linkUrl: expect.stringContaining("services/listings/svc-1"),
      }),
    );
  });
});

// =============================================================================
// 6.5 closeNeedsFulfilledByBooking
// =============================================================================

describe("closeNeedsFulfilledByBooking", () => {
  const args = {
    listingType: "rental" as const,
    listingId: "listing-1",
    bookerUserId: "user-1",
  };

  it("closes needs where the booker is the creator", async () => {
    mockFindOpenNeedsLinkedToListing.mockResolvedValue([OPEN_NEED]);
    mockCloseNeed.mockResolvedValue(CLOSED_NEED);

    await closeNeedsFulfilledByBooking(args);

    expect(mockCloseNeed).toHaveBeenCalledWith("need-1", "booking");
  });

  it("does not close needs where the booker is NOT the creator (stranger booking)", async () => {
    const strangerNeed = { ...OPEN_NEED, createdByUserId: "other-user" };
    mockFindOpenNeedsLinkedToListing.mockResolvedValue([strangerNeed]);

    await closeNeedsFulfilledByBooking(args);

    expect(mockCloseNeed).not.toHaveBeenCalled();
  });

  it("closes multiple needs when creator has several open needs linked to the same listing", async () => {
    const need2 = { ...OPEN_NEED, id: "need-2" };
    mockFindOpenNeedsLinkedToListing.mockResolvedValue([OPEN_NEED, need2]);
    mockCloseNeed.mockResolvedValue(CLOSED_NEED);

    await closeNeedsFulfilledByBooking(args);

    expect(mockCloseNeed).toHaveBeenCalledTimes(2);
    expect(mockCloseNeed).toHaveBeenCalledWith("need-1", "booking");
    expect(mockCloseNeed).toHaveBeenCalledWith("need-2", "booking");
  });

  it("no-op when no open needs are linked to the listing", async () => {
    mockFindOpenNeedsLinkedToListing.mockResolvedValue([]);
    await closeNeedsFulfilledByBooking(args);
    expect(mockCloseNeed).not.toHaveBeenCalled();
  });
});
