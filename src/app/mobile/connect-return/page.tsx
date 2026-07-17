import { MobileConnectBounce } from "@/features/payments/components/mobile-connect-bounce";
import { MOBILE_DEEP_LINKS } from "@/constants/mobile";

/**
 * Stripe Connect onboarding `return_url` for the mobile app.
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.4
 */
export default function MobileConnectReturnPage() {
  return (
    <MobileConnectBounce
      deepLink={MOBILE_DEEP_LINKS.connectReturn}
      heading="Returning to Hoador…"
      description="You can head back to the Hoador app now. We'll finish checking your payout setup there."
    />
  );
}
