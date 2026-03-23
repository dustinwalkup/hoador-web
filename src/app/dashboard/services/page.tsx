export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { communityDAL, serviceListingDAL, userDAL } from "@/dal";
import { ServiceBrowseClient } from "@/features/services/components/service-browse-client";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Services",
  description: "Browse HOA services in your community",
};

export default async function ServicesBrowsePage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  const membership = await communityDAL.getMembershipForUser(userId);
  if (!membership) {
    return (
      <div className="container pb-6">
        <PageHeader
          title="Services"
          description="Join a community to browse local services."
        />
        <p className="text-muted-foreground">
          You need to be a member of a community to use the services
          marketplace.
        </p>
      </div>
    );
  }

  const [listings, categories, profile] = await Promise.all([
    serviceListingDAL.findByCommunityForBrowse(membership.community.id),
    serviceListingDAL.listCategories(),
    userDAL.getUserById(userId),
  ]);

  const canCreateListing = Boolean(
    profile.stripeConnectedAccountId &&
    profile.connectChargesEnabled &&
    profile.connectPayoutsEnabled,
  );

  return (
    <div className="container pb-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Services"
          description="Book trusted help from neighbors in your community."
        />
        {canCreateListing && (
          <Button
            asChild
            variant="outline"
            className="shrink-0 self-start sm:self-center"
          >
            <Link href="/dashboard/services/listings/create">
              Create listing
            </Link>
          </Button>
        )}
      </div>
      <ServiceBrowseClient
        listings={listings}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        canCreateListing={canCreateListing}
      />
    </div>
  );
}
