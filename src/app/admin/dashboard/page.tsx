export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { AdminMetricsCards } from "@/features/admin/components/admin-metrics-cards";
import { AdminRecentActivityWidget } from "@/features/admin/components/admin-recent-activity-widget";
import { DisputeStatsWidget } from "@/features/admin/components/dispute-stats-widget";

export const metadata = {
  title: "Admin - Dashboard",
  description: "Overview of platform metrics and recent activity",
};

export default function AdminDashboardPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Admin Dashboard"
        description="Overview of platform metrics and recent activity"
      />

      <AdminMetricsCards />

      <DisputeStatsWidget />

      <AdminRecentActivityWidget />
    </div>
  );
}
