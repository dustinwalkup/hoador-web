import { NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";

/**
 * GET /api/messages/unread-count
 * Get total unread message count for the authenticated user
 */
export async function GET() {
  const { data: count, error } = await tryCatch(
    messagesDAL.getUnreadMessageCount(),
  );

  if (error) {
    console.error("Failed to fetch unread message count:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch unread message count" },
      { status: error.message?.includes("Authentication") ? 401 : 500 },
    );
  }

  return NextResponse.json({ count });
}

