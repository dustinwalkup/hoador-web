import { userDAL } from "@/dal";
import { getAccountStatus } from "@/services/stripe/connect";
import { isRetryablePaymentError } from "@/services/stripe/rental-payments";
import { PaymentSetupRequiredError } from "./errors";
import { logGatingEvent } from "./log-events";
import { getPayoutReadiness, type OnboardingStatus } from "./payout-readiness";

export type AssertConnectReadyOptions = {
  bookingType: "rental" | "service";
  bookingId: string;
};

/**
 * Asserts that the given user is ready to receive payouts at the moment of
 * accepting a booking. Two-layer check:
 *
 * 1. Fast path — cached `connectChargesEnabled` / `connectPayoutsEnabled` columns.
 *    If not both true, throw immediately without calling Stripe.
 * 2. Authoritative path — live `stripe.accounts.retrieve()` to catch capability
 *    regressions and webhook lag. One retry on transient Stripe errors. If the
 *    live response shows regression, cached flags are updated to match before
 *    throwing.
 *
 * On Stripe being unreachable after retry, fail closed (throw with
 * `reason: 'stripe_unreachable'`) rather than allow the accept to proceed.
 */
export async function assertConnectReady(
  userId: string,
  opts: AssertConnectReadyOptions,
): Promise<void> {
  const user = await userDAL.getUserById(userId);
  const readiness = getPayoutReadiness({
    stripeConnectedAccountId: user.stripeConnectedAccountId ?? null,
    connectChargesEnabled: user.connectChargesEnabled,
    connectPayoutsEnabled: user.connectPayoutsEnabled,
    connectOnboardingComplete: user.connectOnboardingComplete,
  });

  if (readiness.onboardingStatus !== "verified") {
    throwPaymentSetupRequired(userId, opts, readiness.onboardingStatus, {
      missingCapabilities: missingCapabilitiesFor(readiness),
    });
  }

  // Cached flags say verified — confirm live before allowing money to move.
  const accountId = user.stripeConnectedAccountId!;
  const live = await retrieveAccountStatusWithRetry(accountId);

  if (live === "unreachable") {
    throwPaymentSetupRequired(userId, opts, "unknown", {
      reason: "stripe_unreachable",
    });
  }

  if (live.chargesEnabled && live.payoutsEnabled) {
    return;
  }

  // Capability regression — sync cached flags before throwing so the next
  // request short-circuits on the fast path.
  await userDAL.updateConnectOnboardingStatus(userId, {
    chargesEnabled: live.chargesEnabled,
    payoutsEnabled: live.payoutsEnabled,
  });

  // Regression case: the user previously had both capabilities, so we surface
  // this as `restricted` (post-onboarding capability loss) rather than `pending`
  // (still in onboarding). We mark connectOnboardingComplete true to get that
  // classification from getPayoutReadiness.
  const liveReadiness = getPayoutReadiness({
    stripeConnectedAccountId: accountId,
    connectChargesEnabled: live.chargesEnabled,
    connectPayoutsEnabled: live.payoutsEnabled,
    connectOnboardingComplete: true,
  });

  throwPaymentSetupRequired(userId, opts, liveReadiness.onboardingStatus, {
    missingCapabilities: missingCapabilitiesFor(liveReadiness),
    regression: true,
  });
}

type AccountStatus = Awaited<ReturnType<typeof getAccountStatus>>;

async function retrieveAccountStatusWithRetry(
  accountId: string,
): Promise<AccountStatus | "unreachable"> {
  try {
    return await getAccountStatus(accountId);
  } catch (error) {
    if (!isRetryablePaymentError(error)) {
      return "unreachable";
    }
    await sleep(1000);
    try {
      return await getAccountStatus(accountId);
    } catch {
      return "unreachable";
    }
  }
}

function missingCapabilitiesFor(readiness: {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}): ("charges" | "payouts")[] {
  const missing: ("charges" | "payouts")[] = [];
  if (!readiness.chargesEnabled) missing.push("charges");
  if (!readiness.payoutsEnabled) missing.push("payouts");
  return missing;
}

function throwPaymentSetupRequired(
  userId: string,
  opts: AssertConnectReadyOptions,
  onboardingStatus: OnboardingStatus | "unknown",
  extra: {
    missingCapabilities?: ("charges" | "payouts")[];
    reason?: "stripe_unreachable";
    regression?: boolean;
  } = {},
): never {
  logGatingEvent("accept_blocked_payment_setup_required", {
    userId,
    bookingType: opts.bookingType,
    bookingId: opts.bookingId,
    onboardingStatus,
    ...(extra.regression ? { regression: true } : {}),
    ...(extra.reason ? { reason: extra.reason } : {}),
  });

  throw new PaymentSetupRequiredError({
    onboardingStatus,
    ...(extra.missingCapabilities && extra.missingCapabilities.length > 0
      ? { missingCapabilities: extra.missingCapabilities }
      : {}),
    ...(extra.reason ? { reason: extra.reason } : {}),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
