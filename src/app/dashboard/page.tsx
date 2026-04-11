export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { PageHeader } from "@/components/page-header";
import { ScrollToTop } from "@/components/scroll-to-top";
import {
  QuickActionsBar,
  DashboardSummaryCards,
  OverdueAlertsWidget,
  PendingRequestsWidget,
  UnreadMessagesWidget,
  MiniAnalyticsSection,
  RecentActivityFeed,
  UpcomingScheduleWidget,
  TopPerformingToolsWidget,
  NeighborhoodActivityWidget,
  ActiveDisputesWidget,
} from "@/features/dashboard/components";
import { getLendingRequestDetailUrl } from "@/features/dashboard/lib/urls";
import {
  getUpcomingSchedule,
  getDashboardActivityFeed,
} from "@/features/dashboard/lib";
import {
  rentalDAL,
  listingDAL,
  paymentDAL,
  messagesDAL,
  disputeDAL,
} from "@/dal";
import type { PendingRequestItem } from "@/features/dashboard/types";
import type { DashboardAnalytics } from "@/features/dashboard/types";
import { DASHBOARD_HEADER } from "@/constants/dashboard";
import {
  AnimatedSection,
  StaggerGrid,
  StaggerItem,
} from "@/components/animation-section";

export const metadata = {
  title: "Dashboard",
  description: "Manage your rentals, listings, and community connections",
};

/** Defaults when a fetch group fails so the rest of the page can render. */
function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((err) => {
    console.error("[Dashboard] Widget data fetch failed:", err);
    return fallback;
  });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const userId = user.id;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const [
    activeRentalsCount,
    toolsLentCount,
    pendingLendingRequests,
    overdueItems,
    earningsThisMonth,
    unreadMessageCount,
    recentConversations,
    upcomingSchedule,
    topPerformingListings,
    neighborhoodListings,
    activityFeedItems,
    disputesResult,
    analytics,
  ] = await Promise.all([
    safe(() => rentalDAL.countBorrowedListings(userId), 0),
    safe(() => rentalDAL.countSharedListings(userId), 0),
    safe(() => rentalDAL.getLendingRequestsByStatus("pending", userId), []),
    safe(() => rentalDAL.getOverdueItemsForUser(userId), []),
    safe(
      () =>
        paymentDAL.getUserEarningsForMonth(userId, startOfMonth, endOfMonth),
      0,
    ),

    safe(() => messagesDAL.getUnreadMessageCount(userId), 0),
    safe(
      () => messagesDAL.getUserConversationsPaginated(userId, false, 0, 3),
      [],
    ),
    safe(() => getUpcomingSchedule(userId), []),
    safe(() => listingDAL.getTopPerformingListings(userId, 5), []),
    safe(() => listingDAL.getRecentListingsNearUser(userId, 5), []),
    safe(() => getDashboardActivityFeed(userId, 10), []),
    safe(() => disputeDAL.getUserDisputes(userId, { limit: 20 }), {
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
    safe(
      async (): Promise<DashboardAnalytics> => {
        const [rentalsPerMonth, earningsByMonth, inventoryUsage] =
          await Promise.all([
            rentalDAL.getRentalsPerMonth(userId, 6),
            paymentDAL.getUserEarningsByMonthRange(userId, 6),
            listingDAL.getInventoryUsage(userId),
          ]);
        return {
          rentalsPerMonth,
          earningsByMonth,
          inventoryUsage,
        };
      },
      {
        rentalsPerMonth: [],
        earningsByMonth: [],
        inventoryUsage: {
          activeCount: 0,
          totalCount: 0,
          usagePercent: 0,
        },
      },
    ),
  ]);

  const pendingRequestItems: PendingRequestItem[] = pendingLendingRequests
    .slice(0, 5)
    .map((req) => ({
      id: req.id,
      listingName: req.listingName,
      requesterName: req.renterName,
      statusText: "Awaiting your response",
      requestDetailUrl: getLendingRequestDetailUrl(req.id),
    }));

  const activeDisputes = disputesResult.data.filter(
    (d) => d.status !== "closed",
  );
  const activeDisputesList = activeDisputes.slice(0, 5);
  const activeDisputesCount = activeDisputes.length;

  return (
    <div className="container min-w-0 space-y-6">
      <ScrollToTop />
      <AnimatedSection delay={0}>
        <PageHeader
          title={DASHBOARD_HEADER.titleFor(user.firstName ?? "User")}
          description={DASHBOARD_HEADER.description}
          className="mb-6"
        />
      </AnimatedSection>

      {/* Quick Actions - has its own internal stagger */}
      <AnimatedSection delay={0.1}>
        <QuickActionsBar unreadCount={unreadMessageCount} />
      </AnimatedSection>

      {/* Alerts row - full width for schedule when no overdue items */}
      <StaggerGrid
        className={`grid gap-4 ${overdueItems.length > 0 ? "lg:grid-cols-2" : ""}`}
        delay={0.15}
      >
        <StaggerItem>
          <UpcomingScheduleWidget entries={upcomingSchedule} />
        </StaggerItem>
        {overdueItems.length > 0 && (
          <StaggerItem>
            <OverdueAlertsWidget items={overdueItems} />
          </StaggerItem>
        )}
      </StaggerGrid>

      {/* Pending Requests */}
      <AnimatedSection delay={0.05}>
        <PendingRequestsWidget
          items={pendingRequestItems}
          totalCount={pendingLendingRequests.length}
        />
      </AnimatedSection>

      {/* Summary Cards - has its own internal stagger */}
      <AnimatedSection delay={0.05}>
        <DashboardSummaryCards
          activeRentalsCount={activeRentalsCount}
          toolsLentCount={toolsLentCount}
          pendingRequestsCount={pendingLendingRequests.length}
          earningsThisMonth={earningsThisMonth}
        />
      </AnimatedSection>

      <AnimatedSection>
        <UnreadMessagesWidget
          unreadCount={unreadMessageCount}
          recentConversations={recentConversations}
        />
      </AnimatedSection>

      {/* Activity Feed + Upcoming Schedule */}
      <AnimatedSection>
        <RecentActivityFeed items={activityFeedItems} />
      </AnimatedSection>

      <AnimatedSection>
        <MiniAnalyticsSection analytics={analytics} />
      </AnimatedSection>

      <StaggerGrid className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StaggerItem className="self-start">
          <TopPerformingToolsWidget listings={topPerformingListings} />
        </StaggerItem>
        <StaggerItem className="self-start">
          <NeighborhoodActivityWidget listings={neighborhoodListings} />
        </StaggerItem>
        <StaggerItem className="flex h-full min-h-0 flex-col self-start">
          <ActiveDisputesWidget
            disputes={activeDisputesList}
            totalCount={activeDisputesCount}
          />
        </StaggerItem>
      </StaggerGrid>
    </div>
  );
}
