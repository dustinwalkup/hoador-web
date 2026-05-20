export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { PAYMENTS_PAGE_HEADERS } from "@/constants/payments";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/features/auth/utils/session";
import { userDAL } from "@/dal";
import { PaymentsTabs } from "@/features/payments/components";
import { EarningsAndPayoutsPageClient } from "@/features/payments/components";
import { getPayoutReadiness } from "@/features/payments/lib/payout-readiness";
import { validateReturnTo } from "@/features/payments/lib/return-to";
import { logGatingEvent } from "@/features/payments/lib/log-events";

export const metadata = {
  title: "Earnings & payouts",
  description: "Manage your earnings, payouts, and Stripe Connect account",
};

interface PageProps {
  searchParams: Promise<{ returnTo?: string }>;
}

/**
 * Earnings & Payouts page server component
 * Fetches user data and onboarding status server-side.
 *
 * When called with a valid `?returnTo=<dashboard-path>` query param, the page
 * enters JIT mode: chrome (tabs, earnings sections) is hidden and only the
 * Stripe Connect onboarding form is rendered, with context copy and a redirect
 * back to `returnTo` on completion. Used by the accept-booking 403 flow.
 */
export default async function EarningsAndPayoutsPage({
  searchParams,
}: PageProps) {
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

  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = validateReturnTo(rawReturnTo);

  const userRecord = await userDAL.getUserById(user.id);
  const readiness = getPayoutReadiness({
    stripeConnectedAccountId: userRecord.stripeConnectedAccountId ?? null,
    connectChargesEnabled: userRecord.connectChargesEnabled,
    connectPayoutsEnabled: userRecord.connectPayoutsEnabled,
    connectOnboardingComplete: userRecord.connectOnboardingComplete,
  });

  // JIT mode: send the verified user straight back to the originating booking.
  if (returnTo && readiness.onboardingStatus === "verified") {
    redirect(returnTo);
  }

  // JIT mode: render only the onboarding form with context copy and skip the
  // normal page chrome (tabs, earnings dashboard, explainer).
  if (returnTo) {
    logGatingEvent("connect_onboarding_started_from_accept", {
      userId: user.id,
      onboardingStatus: readiness.onboardingStatus,
    });

    return (
      <div className="container pb-6">
        <EarningsAndPayoutsPageClient
          isOnboarded={false}
          returnTo={returnTo}
          onboardingStatus={readiness.onboardingStatus}
        />
      </div>
    );
  }

  const isOnboarded = readiness.onboardingStatus === "verified";

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
