import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { notificationsDAL } from "@/dal";

/**
 * GET /api/notifications/count
 * Get unread notification count for the authenticated user
 */
async function getHandler() {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const count = await notificationsDAL.getUnreadCount(userId);

    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/notifications/count",
);
