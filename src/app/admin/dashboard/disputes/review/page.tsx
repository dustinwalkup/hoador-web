export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/auth/utils/guards";
import { PageHeader } from "@/components/page-header";
import { DisputeReviewTabs } from "@/features/admin/components/dispute-review/dispute-review-tabs";

export const metadata = {
  title: "Admin - Dispute Review",
  description: "Review and resolve disputes submitted by users",
};

export default async function DisputeReviewPage() {
  // Require admin authentication
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Dispute Review"
        description="Review and resolve disputes submitted by users"
      />
      <DisputeReviewTabs />
    </div>
  );
}
