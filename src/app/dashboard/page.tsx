export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { PageHeader } from "@/components/page-header";
import { ScrollToTop } from "@/components/scroll-to-top";
import {
  QuickActionsBar,
  OverdueAlertsWidget,
  PendingRequestsWidget,
  UnreadMessagesWidget,
  RecentActivityFeed,
  UpcomingScheduleWidget,
  ActiveDisputesWidget,
} from "@/features/dashboard/components";
import { getLendingRequestDetailUrl } from "@/features/dashboard/lib/urls";
import {
  getUpcomingSchedule,
  getDashboardActivityFeed,
  getDashboardPulseData,
} from "@/features/dashboard/lib";
import { rentalDAL, messagesDAL, disputeDAL } from "@/dal";
import type { PendingRequestItem } from "@/features/dashboard/types";
import { DASHBOARD_HEADER } from "@/constants/dashboard";
import {
  AnimatedSection,
  StaggerGrid,
  StaggerItem,
} from "@/components/animation-section";
import { DashboardPulse } from "@/features/dashboard/components/dashboard-pulse";

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

  const [
    pendingLendingRequests,
    actionableAlerts,
    unreadMessageCount,
    recentConversations,
    upcomingSchedule,
    activityFeedItems,
    disputesResult,
    pulseData,
  ] = await Promise.all([
    safe(() => rentalDAL.getLendingRequestsByStatus("pending", userId), []),
    safe(() => rentalDAL.getActionableAlerts(userId), []),
    safe(() => messagesDAL.getUnreadMessageCount(userId), 0),
    safe(
      () => messagesDAL.getUserConversationsPaginated(userId, false, 0, 3),
      [],
    ),
    safe(() => getUpcomingSchedule(userId), []),
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
    safe(() => getDashboardPulseData(userId), {
      action: {
        pendingRequests: 0,
        overdueReturns: 0,
        overdueServices: 0,
        unconfirmedServices: 0,
      },
      active: { borrowing: 0, lending: 0, disputes: 0 },
      upcoming: { rentals: 0, services: 0 },
      listed: { tools: 0, services: 0 },
    }),
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

      <DashboardPulse data={pulseData} />

      {/* Alerts row - full width for schedule when no overdue items */}
      <StaggerGrid
        className={`grid gap-4 ${actionableAlerts.length > 0 ? "lg:grid-cols-2" : ""}`}
        delay={0.15}
      >
        <StaggerItem>
          <UpcomingScheduleWidget entries={upcomingSchedule} />
        </StaggerItem>
        {actionableAlerts.length > 0 && (
          <StaggerItem>
            <div id="needs-attention">
              <OverdueAlertsWidget alerts={actionableAlerts} />
            </div>
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

      <AnimatedSection className="pb-4">
        <ActiveDisputesWidget
          disputes={activeDisputesList}
          totalCount={activeDisputesCount}
        />
      </AnimatedSection>

      {/* <AnimatedSection>
        <MiniAnalyticsSection analytics={analytics} />
      </AnimatedSection>

      <StaggerGrid className=" ">
        {/* <StaggerItem className="self-start">
          <TopPerformingToolsWidget listings={topPerformingListings} />
        </StaggerItem>
        <StaggerItem className="self-start">
          <NeighborhoodActivityWidget listings={neighborhoodListings} />
        </StaggerItem> */}
      {/* <StaggerItem className="flex h-full min-h-0 flex-col self-start"></StaggerItem> */}
      {/* </StaggerGrid> */}
    </div>
  );
}
