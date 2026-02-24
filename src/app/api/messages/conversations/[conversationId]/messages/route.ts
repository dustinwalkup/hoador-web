import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL, userDAL } from "@/dal";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  captureNonCriticalError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { sendMessageReceivedNotification } from "@/features/messages/notifications/message-received";

const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message content is required")
    .max(5000, "Message must be less than 5000 characters"),
});

/**
 * POST /api/messages/conversations/[conversationId]/messages
 * Send a message in a conversation
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
    const body = await parseFormData(request);
    const validated = sendMessageSchema.parse(body);

    const { data, error } = await tryCatch(
      messagesDAL.sendMessageInConversation(
        conversationId,
        userId,
        validated.content,
      ),
    );

    if (error) {
      return handleApiError(error);
    }

    // Send notification to recipient (in-app + email + push per preferences)
    try {
      const [sender, recipient] = await Promise.all([
        userDAL.getUserById(userId),
        userDAL.getUserById(data.recipientId),
      ]);
      const senderName =
        [sender.firstName, sender.lastName].filter(Boolean).join(" ") ||
        sender.name ||
        "Someone";

      await sendMessageReceivedNotification({
        userId: data.recipientId,
        to: recipient.email,
        senderName,
        conversationId,
      });
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/messages/conversations/[id]/messages",
        action: "send_notification",
      });
    }

    return NextResponse.json({
      success: true,
      data: data.message,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/messages/conversations/[conversationId]/messages",
);
