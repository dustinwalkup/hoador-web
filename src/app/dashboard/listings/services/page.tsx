import { Suspense } from "react";
import { userDAL, serviceListingDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import { InitiateStripeOnboarding } from "@/features/payments/components/initiate-stripe-onboarding";
import { PageHeader } from "@/components/page-header";
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

  const isOnboarded = await userDAL.isConnectOnboardingComplete(user.id);

  if (!isOnboarded) {
    return (
      <div className="container pb-6">
        <PageHeader
          title="Your service listings"
          description="Manage your services and availability"
        />
        <InitiateStripeOnboarding />
      </div>
    );
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
