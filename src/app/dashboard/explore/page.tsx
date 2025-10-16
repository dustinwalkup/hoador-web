export const dynamic = "force-dynamic";
import { getCurrentUser } from "@/features/auth/utils/session";
import { PageHeader } from "@/components/page-header";
import { ExplorePageClient } from "./_components/explore-page-client";

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
