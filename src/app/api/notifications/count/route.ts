import { NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { notificationsDAL } from "@/dal";

/**
 * GET /api/notifications/count
 * Get unread notification count for the authenticated user
 */
export async function GET() {
  const { data: count, error } = await tryCatch(
    notificationsDAL.getUnreadCount(),
  );

  if (error) {
    console.error("Failed to fetch unread count:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch unread count" },
      { status: error.message?.includes("Authentication") ? 401 : 500 },
    );
  }

  return NextResponse.json({ count });
}
