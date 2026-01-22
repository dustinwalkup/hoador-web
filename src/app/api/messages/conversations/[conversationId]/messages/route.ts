import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";
import {
  handleApiError,
  requireAuthResponse,
  parseFormData,
} from "@/lib/api/route-helpers";

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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { conversationId } = await params;
    const body = await parseFormData(request);
    const validated = sendMessageSchema.parse(body);

    const { data, error } = await tryCatch(
      messagesDAL.sendMessageInConversation(conversationId, validated.content),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
