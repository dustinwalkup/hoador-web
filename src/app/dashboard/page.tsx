export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { PageHeader } from "@/components/page-header";
import { ScrollToTop } from "@/components/scroll-to-top";
import { AnimatedSection } from "@/components/animation-section";
import { DASHBOARD_HEADER } from "@/constants/dashboard";

import { WidgetBoundary } from "./_widgets/widget-boundary";
import { QuickActionsWidget } from "./_widgets/quick-actions.widget";
import { DashboardPulseWidget } from "./_widgets/dashboard-pulse.widget";
import { AlertsRowWidget } from "./_widgets/alerts-row.widget";
import { PendingRequestsWidgetIsland } from "./_widgets/pending-requests.widget";
import { UnreadMessagesWidgetIsland } from "./_widgets/unread-messages.widget";
import { RecentActivityWidget } from "./_widgets/recent-activity.widget";
import { ActiveDisputesWidgetIsland } from "./_widgets/active-disputes.widget";
import {
  QuickActionsSkeleton,
  DashboardPulseSkeleton,
  AlertsRowSkeleton,
  PendingRequestsSkeleton,
  UnreadMessagesSkeleton,
  RecentActivitySkeleton,
  ActiveDisputesSkeleton,
} from "./_widgets/skeletons";

export const metadata = {
  title: "Dashboard",
  description: "Manage your rentals, listings, and community connections",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const userId = user.id;

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

      <AnimatedSection delay={0.1}>
        <WidgetBoundary skeleton={<QuickActionsSkeleton />}>
          <QuickActionsWidget userId={userId} />
        </WidgetBoundary>
      </AnimatedSection>

      <WidgetBoundary skeleton={<DashboardPulseSkeleton />}>
        <DashboardPulseWidget userId={userId} />
      </WidgetBoundary>

      <WidgetBoundary skeleton={<AlertsRowSkeleton />}>
        <AlertsRowWidget userId={userId} />
      </WidgetBoundary>

      <AnimatedSection delay={0.05}>
        <WidgetBoundary skeleton={<PendingRequestsSkeleton />}>
          <PendingRequestsWidgetIsland userId={userId} />
        </WidgetBoundary>
      </AnimatedSection>

      <AnimatedSection>
        <WidgetBoundary skeleton={<UnreadMessagesSkeleton />}>
          <UnreadMessagesWidgetIsland userId={userId} />
        </WidgetBoundary>
      </AnimatedSection>

      <AnimatedSection>
        <WidgetBoundary skeleton={<RecentActivitySkeleton />}>
          <RecentActivityWidget userId={userId} />
        </WidgetBoundary>
      </AnimatedSection>

      <AnimatedSection className="pb-4">
        <WidgetBoundary skeleton={<ActiveDisputesSkeleton />}>
          <ActiveDisputesWidgetIsland userId={userId} />
        </WidgetBoundary>
      </AnimatedSection>
    </div>
  );
}
