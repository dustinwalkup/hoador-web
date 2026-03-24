import { Suspense } from "react";
import { userDAL, serviceListingDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import { InitiateStripeOnboarding } from "@/features/payments/components/initiate-stripe-onboarding";
import { PageHeader } from "@/components/page-header";
import { MyServiceListingsClient } from "@/features/services/components/my-listings-page/my-service-listings-client";

export const metadata = {
  title: "My Services",
  description: "Manage your service listings",
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
          title="My Services"
          description="Manage your service listings in one place"
        />
        <InitiateStripeOnboarding />
      </div>
    );
  }

  const categories = await serviceListingDAL.listCategories();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyServiceListingsClient categories={categories} />
    </Suspense>
  );
}
