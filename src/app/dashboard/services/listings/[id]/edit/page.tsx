export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { serviceListingDAL } from "@/dal";
import { ServiceListingForm } from "@/features/services/components/service-listing-form";
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

  return (
    <div className="container max-w-2xl pb-10">
      <div className="mb-6">
        <BackButton />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Edit Listing</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {listing.title}
          </p>
        </div>
      </div>
      {listing.status === "denied" ? (
        <div className="mb-6">
          <Alert variant="destructive">
            <AlertDescription>
              Your listing was denied by an admin. Update it and click Save and
              resubmit for review to send it back for approval.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

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
