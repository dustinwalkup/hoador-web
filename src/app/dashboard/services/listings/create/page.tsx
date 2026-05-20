export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { communityDAL, serviceListingDAL } from "@/dal";
import { ServiceListingForm } from "@/features/services/components/service-listing-form";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "List a service",
};

export default async function CreateServiceListingPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const membership = await communityDAL.getMembershipForUser(userId);
  if (!membership) {
    return (
      <div className="container pb-6">
        <PageHeader
          title="List a service"
          description="Join a community first."
        />
      </div>
    );
  }

  const categories = await serviceListingDAL.listCategories();

  return (
    <div className="container max-w-2xl pb-10">
      <PageHeader
        title="List a service"
        description="Submit for admin approval. You can edit details later."
      />
      <ServiceListingForm
        mode="create"
        communityId={membership.community.id}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
