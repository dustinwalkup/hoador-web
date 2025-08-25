import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

/**
 * Stripe instance for server-side operations.
 */
export const PAYMENT_SERVER_INSTANCE = new Stripe(STRIPE_SECRET_KEY);
