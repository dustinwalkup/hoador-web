import { getCurrentUser } from "@/features/auth/utils/session";
import { listingDAL, serviceListingDAL } from "@/dal";
import { getPayoutReadiness } from "@/features/payments/lib/payout-readiness";
import { PayoutReadinessBanner } from "./payout-readiness-banner";

/**
 * Server-side wrapper for {@link PayoutReadinessBanner}.
 *
 * Renders nothing unless the current user has at least one published listing
 * AND their Stripe Connect onboarding status is not `verified`.
 */
export async function PayoutReadinessBannerServer() {
  const user = await getCurrentUser();
  if (!user) return null;

  const readiness = getPayoutReadiness(user);
  if (readiness.onboardingStatus === "verified") return null;

  const [hasRentalListings, hasServiceListings] = await Promise.all([
    listingDAL.hasPublishedListings(user.id),
    serviceListingDAL.hasPublishedListings(user.id),
  ]);

  if (!hasRentalListings && !hasServiceListings) return null;

  return (
    <PayoutReadinessBanner onboardingStatus={readiness.onboardingStatus} />
  );
}
