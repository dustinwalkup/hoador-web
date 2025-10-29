export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/features/auth/utils/session";
import { ExplorePageClient } from "@/features/listings/components/explore-page/explore-page-client";

export const metadata = {
  title: "Explore | Hoador",
  description: "Find listings available in your neighborhood",
};

export default async function ExplorePage() {
  const user = await getCurrentUser();

  return (
    <div className="container py-6">
      <PageHeader
        title="Explore Listings"
        description="Find listings available in your neighborhood"
      />
      <ExplorePageClient userId={user?.id} />
    </div>
  );
}
