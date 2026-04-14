export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";

import { listingDAL, legalDocumentDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import type { ListingDetails } from "@/dal/types";
import type { CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

import { BackButton } from "@/components/back-button";
import { AddListingForm } from "@/features/listings/components/listing-form/add-listing-form";

export const metadata = {
  title: "Edit listing",
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
    condition: listing.condition as "new" | "good" | "fair" | "poor",
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
    ownerPoliciesAcknowledged: true, // User already acknowledged when creating the listing
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

  const [listing, categories, documentVersions] = await Promise.all([
    listingDAL.getListingById(id, currentUser.id),
    listingDAL.getListingCategories(),
    legalDocumentDAL.getAllCurrentVersions(),
  ]);

  if (!listing) return notFound();

  const ownerPolicyDocuments = {
    safetyLiabilityPackage:
      documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE] ?? null,
    prohibitedItemsAndListingContent:
      documentVersions[
        LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT
      ] ?? null,
  };

  const initialValues = mapListingToFormData(listing);

  return (
    <>
      <div className="mb-6">
        <BackButton />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Edit listing</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            List your tool to start earning money from your garage
          </p>
        </div>
      </div>
      <AddListingForm
        categories={categories}
        initialValues={initialValues}
        ownerPolicyDocuments={ownerPolicyDocuments}
        isEdit
        listingId={id}
      />
    </>
  );
}
