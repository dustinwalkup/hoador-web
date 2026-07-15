import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── next/server mocks ─────────────────────────────────────────────────────────

const mockAfter = vi.fn((fn: () => Promise<void>) => fn());
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => Promise<void>) => mockAfter(fn) };
});

// ── route-helpers mock ────────────────────────────────────────────────────────

const mockRequireAdminResponse = vi.fn();
const mockGetCurrentUserId = vi.fn();
const mockHandleApiError = vi.fn();
const mockCaptureNonCriticalError = vi.fn();

vi.mock("@/lib/api/route-helpers", () => ({
  requireAdminResponse: (...a: unknown[]) => mockRequireAdminResponse(...a),
  getCurrentUserId: (...a: unknown[]) => mockGetCurrentUserId(...a),
  handleApiError: (...a: unknown[]) => mockHandleApiError(...a),
  captureNonCriticalError: (...a: unknown[]) =>
    mockCaptureNonCriticalError(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

// ── DAL / DB mocks ────────────────────────────────────────────────────────────

const mockGetListingById = vi.fn();
const mockUpdateApprovalStatus = vi.fn();
const mockDbQueryUserFindFirst = vi.fn();

vi.mock("@/dal", () => ({
  listingDAL: {
    getListingById: (...a: unknown[]) => mockGetListingById(...a),
    updateApprovalStatus: (...a: unknown[]) => mockUpdateApprovalStatus(...a),
  },
}));

vi.mock("@/db/db", () => ({
  db: {
    query: {
      user: {
        findFirst: (...a: unknown[]) => mockDbQueryUserFindFirst(...a),
      },
    },
  },
}));

// ── other deps ────────────────────────────────────────────────────────────────

const mockSendNotification = vi.fn();
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

const mockTrackActivity = vi.fn();
vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: (...a: unknown[]) => mockTrackActivity(...a),
}));

const mockNotifyRequesterListingLive = vi.fn();
vi.mock(
  "@/features/neighborhood-needs/services/neighborhood-needs-service",
  () => ({
    notifyRequesterListingLive: (...a: unknown[]) =>
      mockNotifyRequesterListingLive(...a),
  }),
);

vi.mock("@/features/notifications/utils/email-templates", () => ({
  generateListingApprovalEmailHtml: vi.fn().mockReturnValue("<html/>"),
  generateListingApprovalEmailText: vi.fn().mockReturnValue("text"),
}));

vi.mock("@/db/schemas/user.schema", () => ({ user: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

// ── fixtures ──────────────────────────────────────────────────────────────────

const LISTING = {
  id: "listing-1",
  name: "Power Drill",
  owner: { id: "owner-1" },
};

const OWNER_USER = {
  email: "owner@example.com",
  firstName: "Alice",
  lastName: "Smith",
};

function makeReq(listingId = "listing-1") {
  return new NextRequest(
    `http://localhost/api/admin/listings/${listingId}/approve`,
    { method: "POST" },
  );
}

function makeParams(listingId = "listing-1") {
  return { params: Promise.resolve({ listingId }) };
}

// =============================================================================
// POST /api/admin/listings/[listingId]/approve
// =============================================================================

describe("POST /api/admin/listings/[listingId]/approve", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAfter.mockImplementation((fn: () => Promise<void>) => fn());
    mockRequireAdminResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("admin-1");
    mockGetListingById.mockResolvedValue(LISTING);
    mockDbQueryUserFindFirst.mockResolvedValue(OWNER_USER);
    mockUpdateApprovalStatus.mockResolvedValue({ updated: true });
    mockSendNotification.mockResolvedValue(undefined);
    mockNotifyRequesterListingLive.mockResolvedValue(undefined);
    mockHandleApiError.mockImplementation((err: unknown) => {
      const e = err as { statusCode?: number; message?: string };
      return NextResponse.json(
        { error: e.message ?? "error" },
        { status: e.statusCode ?? 500 },
      );
    });
  });

  it("returns 403 when not admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );

    const { POST } = await import("../route");
    const res = await POST(makeReq(), makeParams());

    expect(res.status).toBe(403);
    expect(mockNotifyRequesterListingLive).not.toHaveBeenCalled();
  });

  it("returns 404 when listing not found", async () => {
    mockGetListingById.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(makeReq(), makeParams());

    expect(res.status).toBe(404);
    expect(mockNotifyRequesterListingLive).not.toHaveBeenCalled();
  });

  it("returns 200 without notifying when already approved (idempotent)", async () => {
    mockUpdateApprovalStatus.mockResolvedValue({ updated: false });

    const { POST } = await import("../route");
    const res = await POST(makeReq(), makeParams());

    expect(res.status).toBe(200);
    expect(mockNotifyRequesterListingLive).not.toHaveBeenCalled();
  });

  it("calls notifyRequesterListingLive with 'rental' and listingId on approval", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq("listing-1"), makeParams("listing-1"));

    expect(res.status).toBe(200);
    expect(mockNotifyRequesterListingLive).toHaveBeenCalledWith(
      "rental",
      "listing-1",
    );
  });

  it("does not fail the approval when notifyRequesterListingLive throws", async () => {
    mockNotifyRequesterListingLive.mockRejectedValue(
      new Error("notification failure"),
    );

    const { POST } = await import("../route");
    const res = await POST(makeReq(), makeParams());

    expect(res.status).toBe(200);
    expect(mockCaptureNonCriticalError).toHaveBeenCalled();
  });
});
