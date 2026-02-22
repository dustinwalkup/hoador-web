import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserId = "test-dashboard-user-id";
const mockUser = {
  id: mockUserId,
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  name: "Test User",
} as any;

const mockGetLendingRequestDetailUrl = vi.fn(
  (id: string) => `/dashboard/rental/${id}?view=lending`,
);

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/features/dashboard/lib/urls", () => ({
  getLendingRequestDetailUrl: (id: string) =>
    mockGetLendingRequestDetailUrl(id),
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/dal", () => ({
  rentalDAL: {
    countBorrowedListings: vi.fn().mockResolvedValue(0),
    countSharedListings: vi.fn().mockResolvedValue(0),
    getLendingRequestsByStatus: vi.fn().mockResolvedValue([]),
    getOverdueItemsForUser: vi.fn().mockResolvedValue([]),
    getRentalsPerMonth: vi.fn().mockResolvedValue([]),
  },
  listingDAL: {
    getTopPerformingListings: vi.fn().mockResolvedValue([]),
    getRecentListingsNearUser: vi.fn().mockResolvedValue([]),
    getInventoryUsage: vi.fn().mockResolvedValue({
      activeCount: 0,
      totalCount: 0,
      usagePercent: 0,
    }),
  },
  paymentDAL: {
    getUserEarningsForMonth: vi.fn().mockResolvedValue(0),
    getUserEarningsByMonthRange: vi.fn().mockResolvedValue([]),
  },
  messagesDAL: {
    getUnreadMessageCount: vi.fn().mockResolvedValue(0),
    getUserConversationsPaginated: vi.fn().mockResolvedValue([]),
  },
  disputeDAL: {
    getUserDisputes: vi.fn().mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
  },
}));

vi.mock("@/features/dashboard/lib", () => ({
  getUpcomingSchedule: vi.fn().mockResolvedValue([]),
  getDashboardActivityFeed: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/dashboard/components", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@/features/dashboard/components")>();
  return { ...mod };
});

// Minimal mocks for other dashboard components so the page can render
vi.mock("@/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/scroll-to-top", () => ({ ScrollToTop: () => null }));
vi.mock(
  "@/features/listings/components/dashboard/pending-review-widget",
  () => ({
    PendingReviewWidget: () => null,
  }),
);

describe("Dashboard page (RSC integration)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetLendingRequestDetailUrl.mockImplementation(
      (id: string) => `/dashboard/rental/${id}?view=lending`,
    );
    const { getCurrentUser } = await import("@/features/auth/utils/session");
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    vi.mocked(
      (await import("@/dal")).rentalDAL.getLendingRequestsByStatus,
    ).mockResolvedValue([]);
  });

  it("should call getCurrentUser and DALs with correct userId", async () => {
    const { getCurrentUser } = await import("@/features/auth/utils/session");
    const { rentalDAL, messagesDAL, disputeDAL } = await import("@/dal");
    const { getUpcomingSchedule, getDashboardActivityFeed } =
      await import("@/features/dashboard/lib");

    const Page = (await import("@/app/dashboard/page")).default;
    await Page();

    expect(getCurrentUser).toHaveBeenCalled();
    expect(rentalDAL.countBorrowedListings).toHaveBeenCalledWith(mockUserId);
    expect(rentalDAL.countSharedListings).toHaveBeenCalledWith(mockUserId);
    expect(rentalDAL.getLendingRequestsByStatus).toHaveBeenCalledWith(
      "pending",
      mockUserId,
    );
    expect(rentalDAL.getOverdueItemsForUser).toHaveBeenCalledWith(mockUserId);
    expect(messagesDAL.getUnreadMessageCount).toHaveBeenCalledWith(mockUserId);
    expect(getUpcomingSchedule).toHaveBeenCalledWith(mockUserId);
    expect(getDashboardActivityFeed).toHaveBeenCalledWith(mockUserId, 10);
    expect(disputeDAL.getUserDisputes).toHaveBeenCalledWith(mockUserId, {
      limit: 20,
    });
  });

  it("should build request detail URLs for pending requests via getLendingRequestDetailUrl", async () => {
    const { rentalDAL } = await import("@/dal");
    vi.mocked(rentalDAL.getLendingRequestsByStatus).mockResolvedValue([
      {
        id: "req-123",
        listingName: "Power Drill",
        renterName: "Jane Doe",
      } as any,
    ]);

    const Page = (await import("@/app/dashboard/page")).default;
    await Page();

    expect(mockGetLendingRequestDetailUrl).toHaveBeenCalledWith("req-123");
    expect(mockGetLendingRequestDetailUrl).toHaveReturnedWith(
      "/dashboard/rental/req-123?view=lending",
    );
    // Page uses getLendingRequestDetailUrl for requestDetailUrl only; no Accept/Decline in widget (per design).
  });

  it("should use DAL for alerts and pending requests (no hardcoded data)", async () => {
    const Page = (await import("@/app/dashboard/page")).default;
    await Page();

    const { rentalDAL } = await import("@/dal");
    expect(rentalDAL.getOverdueItemsForUser).toHaveBeenCalledWith(mockUserId);
    expect(rentalDAL.getLendingRequestsByStatus).toHaveBeenCalledWith(
      "pending",
      mockUserId,
    );
    // Data for OverdueAlertsWidget and PendingRequestsWidget comes from these DAL calls,
    // not from DASHBOARD_PAGE.alerts or pendingRequests (removed in phase 7).
  });

  it("should redirect to sign-in when unauthenticated", async () => {
    const { getCurrentUser } = await import("@/features/auth/utils/session");
    const { redirect } = await import("next/navigation");
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    const Page = (await import("@/app/dashboard/page")).default;
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("should still render when one DAL call fails (per-widget failure isolation)", async () => {
    const { rentalDAL, listingDAL } = await import("@/dal");
    vi.mocked(rentalDAL.countBorrowedListings).mockRejectedValue(
      new Error("DB error"),
    );

    const Page = (await import("@/app/dashboard/page")).default;
    const result = await Page();

    // Page uses safe() so failed DAL returns fallback; page still renders.
    expect(result).toBeDefined();
    // Other DALs still called
    expect(rentalDAL.countSharedListings).toHaveBeenCalledWith(mockUserId);
    expect(listingDAL.getTopPerformingListings).toHaveBeenCalledWith(
      mockUserId,
      5,
    );
  });
});
