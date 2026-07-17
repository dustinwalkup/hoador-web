import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

/**
 * Stripe instance for server-side operations.
 *
 * No `apiVersion` is pinned: every call uses the account's default version, and
 * that is deliberate — pinning here would silently re-version every existing
 * charge, transfer, and webhook path. See `STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION`
 * for the one call that must override it.
 */
export const PAYMENT_SERVER_INSTANCE = new Stripe(STRIPE_SECRET_KEY);

/**
 * API version for **Customer ephemeral keys only** (mobile PaymentSheet).
 *
 * `ephemeralKeys.create` is the sole Stripe call that requires an explicit
 * version, because the key is consumed by the mobile SDK rather than by this
 * server — it must match what `@stripe/stripe-react-native` can speak, not our
 * account default.
 *
 * It is a **floor, not an exact match**: Stripe requires ≥ `2020-03-02`, and the
 * two native SDKs report different versions against the same backend
 * (`stripe-ios` sends `2020-08-27`, `stripe-android` sends `2020-03-02`). We use
 * `2020-08-27` — the value Stripe's own React Native docs use — which satisfies
 * both. This is why the mobile task did not need to wait on the RN SDK version
 * being pinned (`hoador-mobile` task 3.1).
 *
 * Do NOT "upgrade" this to the account's current version to tidy it up: a newer
 * version here can exceed what the installed mobile SDK understands, and the
 * failure lands on customers' phones, not in CI.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md (F9, D-E2-4)
 */
export const STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION = "2020-08-27";
