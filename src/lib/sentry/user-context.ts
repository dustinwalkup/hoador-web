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

  Sentry.setUser({
    id: user.id,
    email: user.email || undefined,
    username: user.name || undefined,
  });
}

/**
 * Clear user context in Sentry
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}
