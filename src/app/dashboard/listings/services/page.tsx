import { Suspense } from "react";
import { serviceListingDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import { MyServiceListingsClient } from "@/features/services/components/my-listings-page/my-service-listings-client";
import { getServerQueryClient, HydrateClient } from "@/lib/react-query/server";
import { myServiceListingsKeys } from "@/features/services/hooks/use-service-listings";

export const metadata = {
  title: "Listings – Services | Hoador",
  description: "Manage your service listings, availability, and offerings.",
};

export default async function ListingsServicesPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <div>Loading...</div>;
  }

  const qc = getServerQueryClient();

  const [allListings, categories] = await Promise.all([
    serviceListingDAL.findByProvider(user.id),
    serviceListingDAL.listCategories(),
  ]);

  // Populate all tabs from a single DAL call (mirrors API route filtering)
  const statuses = [
    "active",
    "inactive",
    "pending_approval",
    "denied",
  ] as const;
  for (const status of statuses) {
    const filtered = allListings.filter((l) => l.status === status);
    qc.setQueryData(myServiceListingsKeys.byStatus(status), filtered);
  }

  return (
    <Suspense fallback={null}>
      <HydrateClient>
        <MyServiceListingsClient categories={categories} />
      </HydrateClient>
    </Suspense>
  );
}
