import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { z } from "zod";
import { messagesDAL, userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  captureNonCriticalError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { sendMessageReceivedNotification } from "@/features/messages/notifications/message-received";

const startConversationSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  listingId: z.string().min(1, "Listing ID is required"),
  listingName: z.string().min(1, "Listing name is required"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message must be less than 5000 characters"),
});

/**
 * GET /api/messages/conversations
 * Get user's conversations (paginated)
 */
async function getHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const archived = searchParams.get("archived") === "true";
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    const { data, error } = await tryCatch(
      messagesDAL.getUserConversationsPaginated(
        userId,
        archived,
        offset,
        limit,
      ),
    );

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch conversations" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/messages/conversations",
);

/**
 * POST /api/messages/conversations
 * Start a new conversation with a user
 */
async function postHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const body = await parseFormData(request);
    const validated = startConversationSchema.parse(body);

    const { data, error } = await tryCatch(
      messagesDAL.sendMessageToUser(
        userId,
        validated.recipientId,
        validated.message,
        validated.listingId,
      ),
    );

    if (error) {
      return handleApiError(error);
    }

    // Send notification to recipient (in-app + email + push per preferences)
    try {
      const [sender, recipient] = await Promise.all([
        userDAL.getUserById(userId),
        userDAL.getUserById(validated.recipientId),
      ]);
      const senderName =
        [sender.firstName, sender.lastName].filter(Boolean).join(" ") ||
        sender.name ||
        "Someone";

      await sendMessageReceivedNotification({
        userId: validated.recipientId,
        to: recipient.email,
        senderName,
        conversationId: data.conversationId,
      });
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/messages/conversations",
        action: "send_notification",
      });
    }

    return NextResponse.json({
      success: true,
      conversationId: data.conversationId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/messages/conversations",
);
