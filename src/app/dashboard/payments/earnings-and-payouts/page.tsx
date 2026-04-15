export const dynamic = "force-dynamic";
import { PAYMENTS_PAGE_HEADERS } from "@/constants/payments";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/features/auth/utils/session";
import { userDAL } from "@/dal";
import { PaymentsTabs } from "@/features/payments/components";
import { EarningsAndPayoutsPageClient } from "@/features/payments/components";

export const metadata = {
  title: "Earnings & payouts",
  description: "Manage your earnings, payouts, and Stripe Connect account",
};

/**
 * Earnings & Payouts page server component
 * Fetches user data and onboarding status server-side
 */
export default async function EarningsAndPayoutsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container pb-6">
        <PageHeader
          title={PAYMENTS_PAGE_HEADERS["earnings-and-payouts"].title}
          description={
            PAYMENTS_PAGE_HEADERS["earnings-and-payouts"].description
          }
        />
        <PaymentsTabs>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              Please sign in to view earnings and payouts.
            </p>
          </div>
        </PaymentsTabs>
      </div>
    );
  }

  // Fetch onboarding status
  const isOnboarded = await userDAL.isConnectOnboardingComplete(user.id);

  return (
    <div className="container pb-6">
      <PageHeader
        title={PAYMENTS_PAGE_HEADERS["earnings-and-payouts"].title}
        description={PAYMENTS_PAGE_HEADERS["earnings-and-payouts"].description}
      />

      <PaymentsTabs isOnboarded={isOnboarded}>
        <EarningsAndPayoutsPageClient isOnboarded={isOnboarded} />
      </PaymentsTabs>
    </div>
  );
}
