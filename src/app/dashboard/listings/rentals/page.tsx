import { Suspense } from "react";
import { userDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import { GarageClient } from "@/features/listings/components/garage-page/garage-client";
import { InitiateStripeOnboarding } from "@/features/payments/components/initiate-stripe-onboarding";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "My Rentals",
  description: "Manage your tool listings and inventory",
};

export default async function ListingsRentalsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <div>Loading...</div>;
  }

  // Check onboarding status
  const isOnboarded = await userDAL.isConnectOnboardingComplete(user.id);

  return (
    <div className="container pb-6">
      {!isOnboarded && (
        <>
          <div className="container pb-6">
            <PageHeader
              title="My Rentals"
              description="Manage your rental listings in one place"
            />
            <InitiateStripeOnboarding />{" "}
          </div>{" "}
        </>
      )}

      {isOnboarded && (
        <Suspense fallback={<div>Loading...</div>}>
          <GarageClient />
        </Suspense>
      )}
    </div>
  );
}
