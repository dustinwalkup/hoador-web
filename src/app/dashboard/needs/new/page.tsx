export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/features/auth/utils/session";
import { listingDAL, serviceListingDAL } from "@/dal";
import { CreateNeedForm } from "@/features/neighborhood-needs/components/create-need-form";

export const metadata = {
  title: "Post a Neighborhood Need",
  description: "Let your neighbors know what you're looking for",
};

export default async function NewNeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [rentalCategories, serviceCategories] = await Promise.all([
    listingDAL.getListingCategories(),
    serviceListingDAL.listCategories(),
  ]);

  return (
    <div className="container max-w-2xl pb-10">
      <PageHeader
        title="Post a Neighborhood Need"
        description="Tell your neighbors what you're looking for"
      />
      <CreateNeedForm
        rentalCategories={rentalCategories}
        serviceCategories={serviceCategories}
      />
    </div>
  );
}
