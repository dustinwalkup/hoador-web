import { getLogger } from "@/lib/logger";
import type { OnboardingStatus } from "./payout-readiness";

export type GatingEvent =
  | "listing_created_without_stripe_connect"
  | "connect_onboarding_started_from_accept"
  | "connect_onboarding_completed_from_accept"
  | "accept_blocked_payment_setup_required"
  | "pending_booking_expired_owner_not_ready";

export type GatingEventProps = {
  userId: string;
  bookingType?: "rental" | "service";
  bookingId?: string;
  listingId?: string;
  onboardingStatus?: OnboardingStatus | "unknown";
  [key: string]: unknown;
};

export function logGatingEvent(
  event: GatingEvent,
  props: GatingEventProps,
): void {
  getLogger().info({ event, ...props }, event);
}
