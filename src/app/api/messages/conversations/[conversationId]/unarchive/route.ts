import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

/**
 * POST /api/messages/conversations/[conversationId]/unarchive
 * Unarchive a conversation
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
    const { error } = await tryCatch(
      messagesDAL.unarchiveConversation(conversationId, userId),
    );

    if (error) {
      return handleApiError(error);
    }

    // Narrowed from the whole conversation row — it carried both user ids and
    // both read timestamps to a caller that only needs the acknowledgement.
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/messages/conversations/[conversationId]/unarchive",
);
