import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { DisputesList } from "@/features/disputes/components/disputes-list";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Disputes",
  description: "View and manage your disputes",
};

/**
 * Disputes list page
 * Server component that handles authentication and renders the client list component
 */
export default async function DisputesPage() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    redirect("/sign-in");
  }

  const { isAdmin } = auth;

  return (
    <div className="container pb-6">
      <PageHeader
        title="Disputes"
        description={
          isAdmin
            ? "Manage and resolve all disputes in the system"
            : "View and track your disputes as a renter or provider"
        }
      />
      <DisputesList isAdmin={isAdmin} />
    </div>
  );
}
