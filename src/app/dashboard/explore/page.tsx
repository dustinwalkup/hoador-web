import { getCurrentUser } from "@/lib/auth/auth.utils";
import { PageHeader } from "@/components/page-header";
import { ExplorePageClient } from "./_components/explore-page-client";

export default async function ExplorePage() {
  const user = await getCurrentUser();

  return (
    <div className="container py-6">
      <PageHeader
        title="Explore Tools"
        description="Find tools available in your neighborhood"
      />

      <ExplorePageClient userId={user?.id} />
    </div>
  );
}
