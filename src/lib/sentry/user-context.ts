import * as Sentry from "@sentry/nextjs";
import type { UserProfile } from "@/dal/types";

/**
 * Set user context in Sentry from user profile
 * @param user - UserProfile from DAL
 */
export function setSentryUser(user: UserProfile | null): void {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  // id only: email/name are PII that Sentry must not hold (PRIV-07)
  Sentry.setUser({ id: user.id });
}

/**
 * Clear user context in Sentry
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}
