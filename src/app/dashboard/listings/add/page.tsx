export const dynamic = "force-dynamic";
import Link from "next/link";
import { listingDAL, legalDocumentDAL, userDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { AddListingForm } from "@/features/listings/components/listing-form/add-listing-form";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "List an item",
  description: "List your tool to start earning money from your garage",
};

export default async function AddListingPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const user = await userDAL.getUserById(userId);

  const connectOk = Boolean(
    user.stripeConnectedAccountId &&
    user.connectChargesEnabled &&
    user.connectPayoutsEnabled,
  );

  if (!connectOk) {
    return (
      <div className="max-w-2xl">
        <BackButton />
        <div className="mt-4 space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Stripe Connect required
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Complete payouts onboarding before listing your tools.
          </p>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          We use Stripe Connect to pay you safely when your tools are rented.
          Finish onboarding, then return here to create your listing.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/payments/earnings-and-payouts">
            Set up payouts
          </Link>
        </Button>
      </div>
    );
  }

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
      <AddListingForm
        categories={categories}
        ownerPolicyDocuments={ownerPolicyDocuments}
      />
    </>
  );
}
