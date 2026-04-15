import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { messagesDAL, notificationsDAL } from "@/dal";

const BADGE_NOTIFICATION_LIMIT = 10;

/**
 * GET /api/dashboard/badges
 *
 * Single-round-trip consolidation of the three polling endpoints the dashboard
 * UI used to hit every 30s (unread message count, unread notification count,
 * latest notifications dropdown). Paying the auth tax once instead of three
 * times and bumping the client poll to 60s reduces background load ~6.5×.
 */
async function getHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const [unreadMessages, unreadNotifications, notifications] =
      await Promise.all([
        messagesDAL.getUnreadMessageCount(userId),
        notificationsDAL.getUnreadCount(userId),
        notificationsDAL.getUserNotifications(userId, {
          page: 1,
          limit: BADGE_NOTIFICATION_LIMIT,
          unreadOnly: false,
        }),
      ]);

    return NextResponse.json({
      unreadMessages,
      unreadNotifications,
      notifications,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/dashboard/badges");
