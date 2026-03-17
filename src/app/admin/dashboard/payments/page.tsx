export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { PaymentLifecycleListClient } from "@/features/admin/components/payments/payment-lifecycle-list-client";
import { PaymentMetricsCards } from "@/features/admin/components/payments/payment-metrics-cards";

export const metadata = {
  title: "Admin - Payment Lifecycle",
  description: "View and manage payment lifecycle, payouts, and deposit holds",
};

export default function AdminPaymentsPage() {
  return (
    <div className="">
      <PageHeader
        title="Payment Lifecycle"
        description="View payment metrics and lifecycle records. Use filters to find specific statuses."
      />
      <PaymentMetricsCards />
      <PaymentLifecycleListClient />
    </div>
  );
}
