import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { messagesDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

/**
 * GET /api/messages/conversations/[conversationId]
 * Read one thread.
 *
 * Query params (both optional):
 * - `limit`  — how many of the newest messages to return. Default 50, clamped
 *              to 1–100.
 * - `before` — keyset cursor for older messages: a message id from this
 *              conversation, or an ISO timestamp.
 *
 * Messages come back oldest-first as they always have, plus `hasMore` saying
 * whether older ones exist. A caller that passes neither param gets the newest
 * 50 messages in the same response shape as before.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § P-E11-4
 */
async function getHandler(
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

    // `limit` is parsed leniently and clamped in the DAL: a garbage value means
    // "the caller said nothing usable" and takes the default, never an
    // unbounded read of the whole thread.
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const before = searchParams.get("before") ?? undefined;

    const { data, error } = await tryCatch(
      messagesDAL.getConversationDetails(conversationId, userId, {
        limit: limitParam ? Number(limitParam) : undefined,
        before,
      }),
    );

    if (error) {
      // Was an unconditional 500, which flattened "no such conversation" and
      // "not yours" into a server error. handleApiError maps the typed DAL
      // errors to 404/403.
      return handleApiError(error);
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/messages/conversations/[conversationId]",
);

async function deleteHandler(
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
      messagesDAL.deleteConversation(conversationId, userId),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/messages/conversations/[conversationId]",
);
