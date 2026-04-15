import { Suspense } from "react";
import { getCurrentUser } from "@/features/auth/utils/session";
import { GarageClient } from "@/features/listings/components/garage-page/garage-client";
import { InitiateStripeOnboarding } from "@/features/payments/components/initiate-stripe-onboarding";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Listings – Rentals | Hoador",
  description: "Manage your rental listings, availability, and inventory.",
};

export default async function ListingsRentalsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <div>Loading...</div>;
  }

  const isOnboarded =
    user.connectChargesEnabled &&
    user.connectPayoutsEnabled &&
    user.connectOnboardingComplete;

  return (
    <div className="container pb-6">
      {!isOnboarded && (
        <>
          <div className="container pb-6">
            <PageHeader
              title="Your rental listings"
              description="Manage your rental listings in one place"
            />
            <InitiateStripeOnboarding />{" "}
          </div>{" "}
        </>
      )}

      {isOnboarded && (
        <Suspense fallback={null}>
          <GarageClient />
        </Suspense>
      )}
    </div>
  );
}
