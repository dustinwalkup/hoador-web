/**
 * Durable rate limits (ARCH-07), enforced by `enforceRateLimit` in
 * `src/lib/api/rate-limit.ts`. Starting points — revisit after real traffic.
 */
export const RATE_LIMITS = {
  FORGOT_PASSWORD_PER_EMAIL: { limit: 3, windowSeconds: 15 * 60 },
  FORGOT_PASSWORD_PER_IP: { limit: 10, windowSeconds: 15 * 60 },
  RESEND_VERIFICATION_PER_EMAIL: { limit: 3, windowSeconds: 15 * 60 },
  RESEND_VERIFICATION_PER_IP: { limit: 10, windowSeconds: 15 * 60 },
  SIGNUP_PER_IP: { limit: 5, windowSeconds: 60 * 60 },
  RESET_PASSWORD_PER_IP: { limit: 10, windowSeconds: 15 * 60 },
  PUSH_SUBSCRIBE_PER_USER: { limit: 20, windowSeconds: 60 * 60 },
  PUSH_TEST_PER_USER: { limit: 5, windowSeconds: 60 * 60 },
  SETUP_INTENT_PER_USER: { limit: 10, windowSeconds: 60 * 60 },
} as const;

/** Standing cap on active push subscriptions, not a time window (SEC-13). */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;
