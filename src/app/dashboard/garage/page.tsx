export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { userDAL, listingDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";
import { GarageClient } from "@/features/listings/components/garage-page/garage-client";
import { OnboardingBanner } from "@/features/users/components/onboarding-banner";

export const metadata = {
  title: "Garage | Hoador",
  description: "Manage your tool listings and inventory",
};

export default async function GaragePage() {
  const user = await getCurrentUser();
  if (!user) {
    return <div>Loading...</div>;
  }

  // Check onboarding status and listing count
  const [isOnboarded, listingCount] = await Promise.all([
    userDAL.isConnectOnboardingComplete(user.id),
    listingDAL.countUserListings(user.id),
  ]);

  return (
    <div className="container py-6">
      <OnboardingBanner
        hasListings={listingCount > 0}
        isOnboarded={isOnboarded}
      />
      {isOnboarded && (
        <Suspense fallback={<div>Loading...</div>}>
          <GarageClient />
        </Suspense>
      )}
    </div>
  );
}
