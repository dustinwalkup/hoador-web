import { NextRequest, NextResponse } from "next/server";
import { messagesDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

export async function GET(
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
      messagesDAL.getConversationDetails(conversationId, userId),
    );

    if (error) {
      console.error("Error fetching conversation details:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch conversation details" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
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
