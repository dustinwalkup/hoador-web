export type OnboardingStatus =
  | "not_started"
  | "pending"
  | "restricted"
  | "verified";

export type PayoutReadiness = {
  stripeConnected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingStatus: OnboardingStatus;
};

export type PayoutReadinessUserFields = {
  stripeConnectedAccountId: string | null;
  connectChargesEnabled: boolean;
  connectPayoutsEnabled: boolean;
  connectOnboardingComplete: boolean;
};

export function getPayoutReadiness(
  user: PayoutReadinessUserFields,
): PayoutReadiness {
  const stripeConnected = user.stripeConnectedAccountId !== null;
  const chargesEnabled = user.connectChargesEnabled;
  const payoutsEnabled = user.connectPayoutsEnabled;

  let onboardingStatus: OnboardingStatus;
  if (!stripeConnected) {
    onboardingStatus = "not_started";
  } else if (chargesEnabled && payoutsEnabled) {
    onboardingStatus = "verified";
  } else if (!user.connectOnboardingComplete) {
    onboardingStatus = "pending";
  } else {
    onboardingStatus = "restricted";
  }

  return {
    stripeConnected,
    chargesEnabled,
    payoutsEnabled,
    onboardingStatus,
  };
}
