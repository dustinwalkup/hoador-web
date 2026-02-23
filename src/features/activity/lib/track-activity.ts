import { userActivityDAL } from "@/dal";
import type { UserActivityType } from "@/dal/user-activity.dal";

/**
 * Fire-and-forget activity tracking. Logs the activity and updates user.lastActiveAt
 * without blocking the caller. Errors are logged but not thrown.
 *
 * Use this in server actions and API routes after successful mutations.
 */
export function trackActivity(
  userId: string,
  activityType: UserActivityType,
  metadata?: Record<string, unknown>,
  ipAddress?: string | null,
  userAgent?: string | null,
): void {
  userActivityDAL
    .logActivity({
      userId,
      activityType,
      metadata,
      ipAddress,
      userAgent,
    })
    .catch((err) => {
      console.error("[trackActivity] Failed to log activity:", err);
    });
}
