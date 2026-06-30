import { userDAL, notificationCategoryPreferencesDAL } from "@/dal";
import { notificationCategoryEnum } from "@/db/schemas/_enums";
import type { NotificationCategory } from "./notification-type-map";

const CATEGORIES = notificationCategoryEnum.enumValues;

/**
 * Per-category defaults when no user preference row exists.
 * neighborhood_needs defaults email/push to OFF (opt-in) to avoid notification fatigue.
 * All other categories default to ON (opt-out) per existing behavior.
 */
const CATEGORY_DEFAULTS: Record<
  NotificationCategory,
  { email: boolean; push: boolean }
> = {
  bookings: { email: true, push: true },
  payments: { email: true, push: true },
  messages: { email: true, push: true },
  disputes: { email: true, push: true },
  reminders: { email: true, push: true },
  neighborhood_needs: { email: false, push: false },
};

/** Master and per-category notification preferences. */
export interface CategoryPreferencesResult {
  master: { email: boolean; push: boolean };
  categories: Record<NotificationCategory, { email: boolean; push: boolean }>;
}

/**
 * Notification preference service: decides whether to send email or push
 * based on user_preferences and notification_category_preferences.
 * Missing preferences default to true for both channels.
 * Requirements: 1.4, 1.5, 1.8, 1.9
 */

/**
 * Returns true if the user should receive email for the given category.
 * Checks master user_preferences.emailNotifications, then category-specific email toggle.
 */
export async function shouldSendEmail(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const master = await userDAL.getUserPreferences(userId);
  if (!master.emailNotifications) return false;

  const categoryPrefs =
    await notificationCategoryPreferencesDAL.getByUserId(userId);
  const row = categoryPrefs?.find((p) => p.category === category);
  return row?.email ?? CATEGORY_DEFAULTS[category].email;
}

/**
 * Returns true if the user should receive push for the given category.
 * Checks master user_preferences.pushNotifications, then category-specific push toggle.
 */
export async function shouldSendPush(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const master = await userDAL.getUserPreferences(userId);
  if (!master.pushNotifications) return false;

  const categoryPrefs =
    await notificationCategoryPreferencesDAL.getByUserId(userId);
  const row = categoryPrefs?.find((p) => p.category === category);
  return row?.push ?? CATEGORY_DEFAULTS[category].push;
}

/**
 * Returns master notification preferences and per-category email/push toggles.
 * When no row exists for a category, defaults to { email: true, push: true }.
 */
export async function getCategoryPreferences(
  userId: string,
): Promise<CategoryPreferencesResult> {
  const master = await userDAL.getUserPreferences(userId);
  const rows = await notificationCategoryPreferencesDAL.getByUserId(userId);
  const rowByCategory = new Map(
    (rows ?? []).map((r) => [r.category, { email: r.email, push: r.push }]),
  );

  const categories = Object.fromEntries(
    CATEGORIES.map((cat) => [
      cat,
      rowByCategory.get(cat) ?? CATEGORY_DEFAULTS[cat],
    ]),
  ) as Record<NotificationCategory, { email: boolean; push: boolean }>;

  return {
    master: {
      email: master.emailNotifications,
      push: master.pushNotifications,
    },
    categories,
  };
}
