import { NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

/**
 * GET /api/messages/unread-count
 * Get total unread message count for the authenticated user
 */
export async function GET() {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const { data: count, error } = await tryCatch(
      messagesDAL.getUnreadMessageCount(userId),
    );

    if (error) {
      console.error("Failed to fetch unread message count:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch unread message count" },
        { status: 500 },
      );
    }

    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
