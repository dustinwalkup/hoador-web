export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/auth/utils/guards";
import { PageHeader } from "@/components/page-header";
import { ListingReviewTabs } from "@/features/admin/components/listing-review/listing-review-tabs";

export const metadata = {
  title: "Listing Review | Admin Dashboard",
  description: "Review and approve listings submitted by users",
};

export default async function ListingReviewPage() {
  // Require admin authentication
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listing Review"
        description="Review and approve listings submitted by users"
      />
      <ListingReviewTabs />
    </div>
  );
}
