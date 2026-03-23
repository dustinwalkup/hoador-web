export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { serviceListingDAL } from "@/dal";
import { ServiceListingForm } from "@/features/services/components/service-listing-form";
import { ServiceListingDeactivateButton } from "@/features/services/components/service-listing-deactivate-button";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Edit service listing",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditServiceListingPage({ params }: PageProps) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const listing = await serviceListingDAL.getById(id);
  if (!listing || listing.providerId !== userId) {
    redirect("/dashboard/services");
  }

  const categories = await serviceListingDAL.listCategories();

  const showDeactivate = listing.status !== "denied";

  return (
    <div className="container max-w-2xl pb-10">
      <PageHeader title="Edit listing" description={listing.title} />
      <div className="mb-6 flex flex-wrap gap-3">
        {showDeactivate ? (
          <ServiceListingDeactivateButton listingId={listing.id} />
        ) : null}
      </div>
      <ServiceListingForm
        mode="edit"
        listingId={listing.id}
        communityId={listing.communityId}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={listing}
      />
    </div>
  );
}
