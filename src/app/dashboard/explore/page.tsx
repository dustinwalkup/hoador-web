export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/features/auth/utils/session";
import { ExplorePageClient } from "@/features/listings/components/explore-page/explore-page-client";

const PAGE_TITLE = "Browse nearby rentals";
const PAGE_DESCRIPTION = "Find listings available in your neighborhood";

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
};

export default async function ExplorePage() {
  const user = await getCurrentUser();

  return (
    <div className="container pb-6">
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <ExplorePageClient userId={user?.id} />
    </div>
  );
}
