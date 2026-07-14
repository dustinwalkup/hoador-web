export const dynamic = "force-dynamic";
import { listingDAL, legalDocumentDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { CreateListingClient } from "@/features/listings/components/listing-form/create-listing-client";
import { BackButton } from "@/components/back-button";
import { getCurrentUserId } from "@/features/auth/utils/session";
import type { CreateListingFormClientValues } from "@/features/listings/form-schema/listing.schema";

export const metadata = {
  title: "List an item",
  description: "List your tool to start earning money from your garage",
};

export default async function AddListingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const sp = await searchParams;

  const [categories, documentVersions] = await Promise.all([
    listingDAL.getListingCategories(),
    legalDocumentDAL.getAllCurrentVersions(),
  ]);

  const ownerPolicyDocuments = {
    safetyLiabilityPackage:
      documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE] ?? null,
    prohibitedItemsAndListingContent:
      documentVersions[
        LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT
      ] ?? null,
  };

  const needId =
    typeof sp.needId === "string" && sp.needId.trim()
      ? sp.needId.trim()
      : undefined;

  const prefillValues: Partial<CreateListingFormClientValues> | undefined =
    needId
      ? {
          neighborhoodNeedId: needId,
          name:
            typeof sp.title === "string"
              ? sp.title.trim() || undefined
              : undefined,
          description:
            typeof sp.description === "string"
              ? sp.description.trim() || undefined
              : undefined,
          categoryId:
            typeof sp.category === "string"
              ? sp.category.trim() || undefined
              : undefined,
        }
      : undefined;

  return (
    <>
      <div className="mb-6">
        <BackButton />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">List an item</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            List your tool to start earning money from your garage
          </p>
        </div>
      </div>
      <CreateListingClient
        categories={categories}
        ownerPolicyDocuments={ownerPolicyDocuments}
        initialValues={prefillValues}
      />
    </>
  );
}
