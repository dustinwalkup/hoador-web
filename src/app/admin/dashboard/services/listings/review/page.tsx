export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { serviceListingDAL } from "@/dal";
import { requireAdmin } from "@/features/auth/utils/guards";
import { AdminServiceListingsReview } from "@/features/services/components/admin-service-listings-review";

export const metadata = {
  title: "Service listings review",
};

export default async function AdminServiceListingsReviewPage() {
  await requireAdmin();
  const pending = await serviceListingDAL.findPendingApproval();

  return (
    <div className="container pb-10">
      <PageHeader
        title="Service listings"
        description="Approve or reject HOA service listings."
      />
      <AdminServiceListingsReview listings={pending} />
    </div>
  );
}
