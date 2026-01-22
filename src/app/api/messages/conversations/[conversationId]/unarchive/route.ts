import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

/**
 * POST /api/messages/conversations/[conversationId]/unarchive
 * Unarchive a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { conversationId } = await params;
    const { data, error } = await tryCatch(
      messagesDAL.unarchiveConversation(conversationId),
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
