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

const startConversationSchema = z
  .object({
    recipientId: z.string().min(1, "Recipient ID is required"),
    /** Tool rental listing (`listings.id`). */
    listingId: z.string().uuid().optional(),
    /** Service listing (`service_listings.id`). */
    serviceListingId: z.string().uuid().optional(),
    listingName: z.string().min(1, "Listing name is required"),
    message: z
      .string()
      .min(10, "Message must be at least 10 characters")
      .max(5000, "Message must be less than 5000 characters"),
  })
  .refine((data) => !(data.listingId && data.serviceListingId), {
    message: "Send at most one of listingId or serviceListingId",
    path: ["listingId"],
  });

/**
 * GET /api/messages/conversations
 * Get user's conversations (paginated).
 *
 * Query params (all optional):
 * - `archived` — `"true"` for the archived tab; anything else means the inbox.
 * - `offset` / `limit` — paging. `limit` defaults to 20 and is clamped to
 *   1–100 in the DAL; garbage takes the default rather than reaching Drizzle.
 * - `search`  — case-insensitive `contains` over the other participant's name
 *   and over the content of any message in the thread, composed with
 *   `archived`. A blank term is not a search.
 *
 * Response shape is unchanged, so a caller that passes no `search` gets exactly
 * what it always did.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § P-E11-3
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
    const search = searchParams.get("search") ?? undefined;

    const { data, error } = await tryCatch(
      messagesDAL.getUserConversationsPaginated(
        userId,
        archived,
        offset,
        limit,
        search,
      ),
    );

    if (error) {
      return handleApiError(error);
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
        validated.serviceListingId,
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
