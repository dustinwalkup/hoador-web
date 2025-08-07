import { NextRequest } from "next/server";
import { messagesDAL } from "@/lib/dal";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await params;
    const conversation =
      await messagesDAL.getConversationDetails(conversationId);
    return Response.json(conversation);
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    return Response.json(
      { error: "Failed to fetch conversation details" },
      { status: 500 },
    );
  }
}
