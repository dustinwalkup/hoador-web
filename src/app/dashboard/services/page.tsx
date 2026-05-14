export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { serviceListingDAL } from "@/dal";
import { ServiceBrowseClient } from "@/features/services/components/service-browse-client";
import { getCurrentUser } from "@/features/auth/utils/session";
import { getCurrentUserVisibleCommunityIds } from "@/features/community/utils/membership";

const PAGE_TITLE = "Explore nearby services";
const PAGE_DESCRIPTION = "Browse services available in your community";

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
};

export default async function ServicesBrowsePage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const visibleCommunityIds = await getCurrentUserVisibleCommunityIds();
  if (visibleCommunityIds.length === 0) {
    return (
      <div className="container pb-6">
        <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        <p className="text-muted-foreground">
          You need to be a member of a community to use the services
          marketplace.
        </p>
      </div>
    );
  }

  const [listings, categories] = await Promise.all([
    serviceListingDAL.findByCommunityForBrowse(visibleCommunityIds, {
      excludeProviderId: user.id,
    }),
    serviceListingDAL.listCategories(),
  ]);

  const canCreateListing = Boolean(
    user.stripeConnectedAccountId &&
    user.connectChargesEnabled &&
    user.connectPayoutsEnabled,
  );

  return (
    <div className="container pb-6">
      <div className="mb-6 flex flex-col gap-4 sm:mb-0 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        {canCreateListing && (
          <Button
            asChild
            variant="outline"
            className="shrink-0 self-start sm:self-center"
          >
            <Link href="/dashboard/services/listings/create">
              List a service
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
