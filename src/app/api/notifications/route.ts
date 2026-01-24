import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { notificationsDAL } from "@/dal";

/**
 * GET /api/notifications
 * Fetch paginated notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const isReadParam = searchParams.get("isRead");
    const type = searchParams.get("type") || undefined;

    // Parse isRead parameter
    let isRead: boolean | undefined;
    if (isReadParam !== null) {
      isRead = isReadParam === "true";
    }

    const notifications = await notificationsDAL.getUserNotifications(userId, {
      page,
      limit,
      unreadOnly,
      isRead,
      type,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/notifications
 * Mark notification(s) as read or toggle read status
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const body = await request.json();
    const { notificationId, markAll, toggleRead, currentReadStatus } = body;

    if (!notificationId && !markAll) {
      return NextResponse.json(
        { error: "Must provide notificationId or markAll" },
        { status: 400 },
      );
    }

    if (markAll) {
      await notificationsDAL.markAllAsRead(userId);
    } else if (toggleRead && currentReadStatus !== undefined) {
      await notificationsDAL.toggleReadStatus(
        notificationId,
        userId,
        currentReadStatus,
      );
    } else {
      await notificationsDAL.markAsRead(notificationId, userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
