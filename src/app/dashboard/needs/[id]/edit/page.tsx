export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { listingDAL, neighborhoodNeedsDAL, serviceListingDAL } from "@/dal";
import { CreateNeedForm } from "@/features/neighborhood-needs/components/create-need-form";

export const metadata = {
  title: "Edit Neighborhood Need",
  description: "Update the details of your neighborhood need",
};

interface EditNeedPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditNeedPage({ params }: EditNeedPageProps) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/sign-in");

  const { id } = await params;
  const need = await neighborhoodNeedsDAL.getNeedById(id);

  // getNeedById already excludes soft-deleted rows.
  if (!need) notFound();

  // Only the owner or an admin may edit; closed needs are not editable.
  const isOwner = need.createdByUserId === auth.userId;
  if (!isOwner && !auth.isAdmin) notFound();
  if (need.status === "closed") redirect(`/dashboard/needs/${id}`);

  const [rentalCategories, serviceCategories] = await Promise.all([
    listingDAL.getListingCategories(),
    serviceListingDAL.listCategories(),
  ]);

  return (
    <div className="container max-w-2xl pb-10">
      <PageHeader
        title="Edit Neighborhood Need"
        description="Update the details of your need"
      />
      <CreateNeedForm
        need={need}
        rentalCategories={rentalCategories}
        serviceCategories={serviceCategories}
      />
    </div>
  );
}
