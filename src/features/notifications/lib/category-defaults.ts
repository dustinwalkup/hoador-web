import type { NotificationCategory } from "./notification-type-map";

/**
 * Per-category email/push defaults, used when a user has no
 * `notification_category_preferences` row for the category. No row is written
 * at sign-up, so this is what every member gets until they flip a switch.
 *
 * Every category defaults to ON for both channels except `neighborhood_needs`,
 * whose email stays OFF. Its push defaults ON: amended 2026-10-27,
 * user-approved (it used to be opt-in, off). An explicit stored row always wins.
 *
 * Kept free of DAL imports so the push fan-out query
 * (`PushSubscriptionDAL.getPushTargetsInCommunity`) and `preference-service`
 * read the same defaults without a circular import.
 */
export const CATEGORY_DEFAULTS: Readonly<
  Record<NotificationCategory, { email: boolean; push: boolean }>
> = {
  bookings: { email: true, push: true },
  payments: { email: true, push: true },
  messages: { email: true, push: true },
  disputes: { email: true, push: true },
  reminders: { email: true, push: true },
  neighborhood_needs: { email: false, push: true },
};
