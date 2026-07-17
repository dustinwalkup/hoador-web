import { MobileConnectBounce } from "@/features/payments/components/mobile-connect-bounce";
import { MOBILE_DEEP_LINKS } from "@/constants/mobile";

/**
 * Stripe Connect onboarding `refresh_url` for the mobile app — reached when the
 * Account Link expired or was reopened. The app requests a fresh link on return.
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.4
 */
export default function MobileConnectRefreshPage() {
  return (
    <MobileConnectBounce
      deepLink={MOBILE_DEEP_LINKS.connectRefresh}
      heading="This link expired"
      description="Head back to the Hoador app to continue setting up payouts — it'll start you off with a fresh link."
    />
  );
}
