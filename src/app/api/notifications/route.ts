import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { notificationsDAL } from "@/dal";

/**
 * GET /api/notifications
 * Fetch paginated notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  const { data: notifications, error } = await tryCatch(
    (async () => {
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const unreadOnly = searchParams.get("unreadOnly") === "true";

      return await notificationsDAL.getUserNotifications({
        page,
        limit,
        unreadOnly,
      });
    })(),
  );

  if (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch notifications" },
      { status: error.message?.includes("Authentication") ? 401 : 500 },
    );
  }

  return NextResponse.json(notifications);
}

/**
 * POST /api/notifications
 * Mark notification(s) as read
 */
export async function POST(request: NextRequest) {
  const { data: body, error: parseError } = await tryCatch(request.json());

  if (parseError) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { notificationId, markAll } = body;

  if (!notificationId && !markAll) {
    return NextResponse.json(
      { error: "Must provide notificationId or markAll" },
      { status: 400 },
    );
  }

  const { error } = await tryCatch(
    (async () => {
      if (markAll) {
        return await notificationsDAL.markAllAsRead();
      } else {
        return await notificationsDAL.markAsRead(notificationId);
      }
    })(),
  );

  if (error) {
    console.error("Failed to mark notification as read:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update notification" },
      { status: error.message?.includes("Authentication") ? 401 : 500 },
    );
  }

  return NextResponse.json({ success: true });
}
