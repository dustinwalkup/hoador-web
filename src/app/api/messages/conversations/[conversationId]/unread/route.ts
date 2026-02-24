import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

/**
 * POST /api/messages/conversations/[conversationId]/unread
 * Mark a conversation as unread
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const { conversationId } = await params;
    const { data, error } = await tryCatch(
      messagesDAL.markConversationAsUnread(conversationId, userId),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      success: true,
      data: data[0],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/messages/conversations/[conversationId]/unread",
);
