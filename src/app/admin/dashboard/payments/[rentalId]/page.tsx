export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { PaymentLifecycleDetailClient } from "@/features/admin/components/payments/payment-lifecycle-detail-client";

export const metadata = {
  title: "Admin - Payment Lifecycle Detail",
  description: "View payment lifecycle detail and override actions",
};

export default async function PaymentLifecycleDetailPage({
  params,
}: {
  params: Promise<{ rentalId: string }>;
}) {
  const { rentalId } = await params;

  return (
    <div className="page-container">
      <PageHeader
        title="Payment Lifecycle Detail"
        description={`Rental ${rentalId} — status, timeline, and override actions`}
      />
      <PaymentLifecycleDetailClient rentalId={rentalId} />
    </div>
  );
}
