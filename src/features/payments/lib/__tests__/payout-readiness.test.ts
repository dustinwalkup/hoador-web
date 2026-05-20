import { describe, it, expect } from "vitest";
import {
  getPayoutReadiness,
  type PayoutReadinessUserFields,
} from "../payout-readiness";

function userFields(
  overrides: Partial<PayoutReadinessUserFields> = {},
): PayoutReadinessUserFields {
  return {
    stripeConnectedAccountId: null,
    connectChargesEnabled: false,
    connectPayoutsEnabled: false,
    connectOnboardingComplete: false,
    ...overrides,
  };
}

describe("getPayoutReadiness", () => {
  it("returns not_started when stripeConnectedAccountId is null", () => {
    const result = getPayoutReadiness(userFields());

    expect(result).toEqual({
      stripeConnected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingStatus: "not_started",
    });
  });

  it("returns not_started even when capability flags are set but no account id", () => {
    const result = getPayoutReadiness(
      userFields({
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
        connectOnboardingComplete: true,
      }),
    );

    expect(result.onboardingStatus).toBe("not_started");
    expect(result.stripeConnected).toBe(false);
  });

  it("returns pending when account exists but onboarding is not complete and both flags are false", () => {
    const result = getPayoutReadiness(
      userFields({
        stripeConnectedAccountId: "acct_123",
        connectOnboardingComplete: false,
      }),
    );

    expect(result).toEqual({
      stripeConnected: true,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingStatus: "pending",
    });
  });

  it("returns verified when both capability flags are true", () => {
    const result = getPayoutReadiness(
      userFields({
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
        connectOnboardingComplete: true,
      }),
    );

    expect(result).toEqual({
      stripeConnected: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingStatus: "verified",
    });
  });

  it("returns verified when both flags are true even if connectOnboardingComplete is false", () => {
    // Live state from Stripe is the source of truth — if both capabilities are
    // enabled, the user is verified regardless of the stale onboarding flag.
    const result = getPayoutReadiness(
      userFields({
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
        connectOnboardingComplete: false,
      }),
    );

    expect(result.onboardingStatus).toBe("verified");
  });

  it("returns restricted when charges_enabled is true but payouts_enabled is false and onboarding is marked complete", () => {
    const result = getPayoutReadiness(
      userFields({
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: true,
        connectPayoutsEnabled: false,
        connectOnboardingComplete: true,
      }),
    );

    expect(result).toEqual({
      stripeConnected: true,
      chargesEnabled: true,
      payoutsEnabled: false,
      onboardingStatus: "restricted",
    });
  });

  it("returns restricted when payouts_enabled is true but charges_enabled is false and onboarding is marked complete", () => {
    const result = getPayoutReadiness(
      userFields({
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: false,
        connectPayoutsEnabled: true,
        connectOnboardingComplete: true,
      }),
    );

    expect(result.onboardingStatus).toBe("restricted");
  });

  it("returns pending when account exists, onboarding is incomplete, and one flag is enabled", () => {
    // Partial capability before onboarding completes is treated as pending,
    // not restricted — the user is still working through onboarding.
    const result = getPayoutReadiness(
      userFields({
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: true,
        connectPayoutsEnabled: false,
        connectOnboardingComplete: false,
      }),
    );

    expect(result.onboardingStatus).toBe("pending");
  });
});
