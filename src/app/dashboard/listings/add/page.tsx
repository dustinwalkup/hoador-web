export const dynamic = "force-dynamic";
import { listingDAL } from "@/dal";
import { AddListingForm } from "@/features/listings/components/listing-form/add-listing-form";
import { BackButton } from "@/components/back-button";

export const metadata = {
  title: "Add Listing",
  description: "List your tool to start earning money from your garage",
};

export default async function AddListingPage() {
  const categories = await listingDAL.getListingCategories();

  return (
    <>
      <div className="mb-6">
        <BackButton />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Add New Listing</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            List your tool to start earning money from your garage
          </p>
        </div>
      </div>
      <AddListingForm categories={categories} />
    </>
  );
}
