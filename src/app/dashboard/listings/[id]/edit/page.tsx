export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";

import { listingDAL } from "@/dal";
import { updateListing } from "@/features/listings/actions/update-listing";
import { getCurrentUser } from "@/features/auth/utils/session";
import type { ListingDetails } from "@/dal/types";
import type { CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";

import { BackButton } from "@/components/back-button";
import { AddListingForm } from "../../add/_components/add-listing-form";

export const metadata = {
  title: "Edit Listing | Hoador",
  description: "Update your listing information",
};

function mapListingToFormData(
  listing: ListingDetails,
): CreateListingFormDataClientType {
  return {
    name: listing.name,
    description: listing.description,
    categoryId: listing.category.id,
    brand: listing.brand,
    model: listing.model,
    condition: listing.condition as "excellent" | "good" | "fair" | "poor",
    dailyRate: listing.dailyRate,
    weeklyRate: listing.weeklyRate,
    monthlyRate: listing.monthlyRate,
    securityDeposit: listing.securityDeposit,
    images: [], // Images will be loaded by the useListingImages hook
    specifications: listing.specifications,
    instructions: listing.instructions,
    safetyNotes: listing.safetyNotes,
    minimumRentalPeriod: listing.minimumRentalPeriod,
    maximumRentalPeriod: listing.maximumRentalPeriod,
    deliveryMode: listing.deliveryMode,
    deliveryFee: listing.deliveryFee,
    deliveryRadius: listing.deliveryRadius,
    setupAvailable: listing.setupAvailable,
    setupFee: listing.setupFee,
  };
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return notFound();
  const { id } = await params;
  const listing = await listingDAL.getListingById(id, currentUser.id);
  if (!listing) return notFound();
  const categories = await listingDAL.getListingCategories();

  const initialValues = mapListingToFormData(listing);

  async function onSubmit(
    data: Omit<CreateListingFormDataClientType, "images">,
  ) {
    "use server";
    // Call updateListing action
    return updateListing(id, data);
  }

  return (
    <>
      <div className="mb-6">
        <BackButton />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Edit Listing</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            List your tool to start earning money from your garage
          </p>
        </div>
      </div>
      <AddListingForm
        categories={categories}
        initialValues={initialValues}
        onSubmit={onSubmit}
        isEdit
        listingId={id}
      />
    </>
  );
}
