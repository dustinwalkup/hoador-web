export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { CronRunHistoryClient } from "@/features/admin/components/payments/cron-run-history-client";

export const metadata = {
  title: "Admin - Cron Run History",
  description: "Recent cron job runs for payment lifecycle and stale detection",
};

export default function CronRunHistoryPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Cron Run History"
        description="Recent runs for process-payouts, schedule-deposit-holds, monitor-deposit-expiry, and detect-stale-processing."
      />
      <CronRunHistoryClient />
    </div>
  );
}
